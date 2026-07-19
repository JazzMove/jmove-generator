/**
 * Drum Pattern Generator - orchestration layer.
 * Pattern data in drumPatternData.ts, stochastic comping in drumStochastic.ts.
 */

// External imports
import { tempoSwingMultiplier, dynamicMultiplier, instrumentSwingFactor } from "./swingUtils";
import { rubatoOffset } from "./grooveTemplates";
import { fillProbScale } from "./probabilityMapping";
import type { DrumHit, DrumPatternOptions, PhraseIntent, PhraseArc } from "./types";

// Data imports - pattern constants, fill arrays, sets, and types from drumPatternData
import {
  GM_DRUMS,
  // Swing
  SWING_RIDES, SWING_HIHATS, SWING_KICK_SNARE,
  // Bossa
  BOSSA_HIHAT, BOSSA_KICK, BOSSA_CROSS_STICK,
  // Latin
  LATIN_CASCARA, LATIN_KICK, LATIN_HIHAT, LATIN_CLAVE_3, LATIN_CLAVE_2,
  // Ballad
  BALLAD_RIDE, BALLAD_HIHAT, BALLAD_KICK,
  // Funk
  FUNK_HIHAT, FUNK_KICK_SNARE,
  // Fusion
  FUSION_LINEAR_A, FUSION_LINEAR_B, FUSION_TIMEKEEPING, FUSION_KICK_SNARE, FUSION_FILLS,
  // Holdsworth
  HOLDSWORTH_RIDE_A, HOLDSWORTH_RIDE_B, HOLDSWORTH_RIDE_C, HOLDSWORTH_RIDE_D,
  HOLDSWORTH_HIHATS, HOLDSWORTH_KICK_SNARE, HOLDSWORTH_FILLS,
  // Holdsworth 11/8
  HOLDSWORTH_11_8_RIDE_A, HOLDSWORTH_11_8_RIDE_B, HOLDSWORTH_11_8_RIDE_C,
  HOLDSWORTH_11_8_HIHATS, HOLDSWORTH_11_8_KICK_SNARE, HOLDSWORTH_11_8_FILLS,
  HOLDSWORTH_11_8_STOCHASTIC,
  // Alfa Mist
  ALFA_MIST_KICK_SNARE, ALFA_MIST_FILLS,
  ALFA_MIST_RIDES, ALFA_MIST_HIHATS,
  // Metheny
  METHENY_RIDES, METHENY_HIHATS, METHENY_KICK_SNARE,
  // Neo-Soul
  NEO_SOUL_HIHATS, NEO_SOUL_KICK_SNARE,
  // Contemporary
  CONTEMP_RIDES, CONTEMP_HIHATS, CONTEMP_KICK_SNARE,
  // Math Rock
  MATH_HIHAT_5, MATH_HIHAT_3, MATH_KICK_SNARE,
  // IDM
  IDM_HIHAT, IDM_HIHAT_B, IDM_HIHAT_C, IDM_KICK_SNARE,
  // ECM
  ECM_RIDE, ECM_KICK, ECM_HIHAT, ECM_SNARE,
  // Hard Bop
  HARD_BOP_RIDES, HARD_BOP_HIHATS, HARD_BOP_KICK_SNARE,
  // Cool Jazz
  COOL_RIDES, COOL_HIHATS, COOL_KICK_SNARE,
  // Modal
  MODAL_RIDE, MODAL_HIHAT, MODAL_KICK,
  // Waltz
  WALTZ_RIDE, WALTZ_HIHAT, WALTZ_KICK,
  // 5/4
  FIVE_FOUR_RIDE_3_2, FIVE_FOUR_HIHAT, FIVE_FOUR_KICK_SNARE,
  // 7/8
  SEVEN_EIGHT_RIDE_223, SEVEN_EIGHT_RIDE_322, SEVEN_EIGHT_KICK_SNARE,
  // 6/8
  SIX_EIGHT_RIDE, SIX_EIGHT_HIHAT, SIX_EIGHT_KICK_SNARE,
  // 9/8
  NINE_EIGHT_RIDE, NINE_EIGHT_KICK_SNARE,
  // 6/4
  SIX_FOUR_RIDE, SIX_FOUR_HIHAT, SIX_FOUR_KICK_SNARE,
  // 7/4
  SEVEN_FOUR_RIDE, SEVEN_FOUR_HIHAT, SEVEN_FOUR_KICK_SNARE,
  // 11/8
  ELEVEN_EIGHT_RIDE, ELEVEN_EIGHT_KICK_SNARE,
  // Shuffle
  SHUFFLE_RIDE, SHUFFLE_HIHAT, SHUFFLE_KICK_SNARE,
  // Fills
  JAZZ_FILLS, JAZZ_FILLS_BIG, SETUP_FILLS,
  // Sets and tables
  FILL_STYLES, STOCHASTIC_STYLES, STOCHASTIC_TABLES, INTERLOCK_STYLES,
  // Types
  type Pattern,
  type PatternHit,
  type CompingTendency,
  type StylePatternSet,
} from "./drumPatternData";

// Stochastic comping imports (internal - not re-exported)
import { pickTendency, generateStochasticComping } from "./drumStochastic";

// Humanization imports (re-exported for consumers)
import { humanizeTime, humanizeVelocity, applyMicroVariation } from "./drumStochastic";

// Re-exports for backward compatibility (consumers import from ./drumPatterns)
export type { DrumHit, DrumPatternOptions };
export { GM_DRUMS, type StylePatternSet } from "./drumPatternData";
export { humanizeTime, humanizeVelocity, applyMicroVariation } from "./drumStochastic";

// ── Contextual Fill Selection ──

/** Score and select fill based on musical context instead of uniform random.
 *  Considers: energy match (busy fills for high energy), history penalty
 *  (avoid repeating same fill), and arc direction. */
function selectContextualFill(
  pool: Pattern[],
  energy: number,
  arc: PhraseArc | null | undefined,
  lastIdx: number,
  rng: () => number,
): Pattern {
  if (pool.length <= 1) return pool[0];
  // Score each fill candidate
  const scores = pool.map((fill, idx) => {
    let score = 1.0;
    // Fill density: count hits. High energy prefers dense fills, low energy prefers sparse.
    const hitCount = fill.length;
    const densityMatch = energy > 0.6 ? hitCount / 8 : (8 - hitCount) / 8;
    score += densityMatch * 0.5;
    // History penalty: don't repeat the same fill
    if (idx === lastIdx) score *= 0.15;
    // Arc bonus: climax/shout prefer biggest fills (most hits), drop/breakdown prefer sparse
    if ((arc === "climax" || arc === "shout") && hitCount >= 5) score += 0.3;
    if ((arc === "drop" || arc === "breakdown") && hitCount <= 3) score += 0.3;
    if ((arc === "build") && hitCount >= 3 && hitCount <= 5) score += 0.2;
    return score;
  });
  // Weighted random selection by score
  const totalScore = scores.reduce((s, v) => s + v, 0);
  let roll = rng() * totalScore;
  for (let i = 0; i < pool.length; i++) {
    roll -= scores[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ── Pattern Assembly per Style ──

function getSwingPatternSet(rng: () => number = Math.random): StylePatternSet {
  const rideIdx = Math.floor(rng() * SWING_RIDES.length);
  const hhIdx = Math.floor(rng() * SWING_HIHATS.length);
  return {
    base: [...SWING_RIDES[rideIdx], ...SWING_HIHATS[hhIdx]],
    variations: SWING_KICK_SNARE,
    rideVariants: SWING_RIDES,
    hihatVariants: SWING_HIHATS,
  };
}

function getBossaPatternSet(): StylePatternSet {
  return { base: [...BOSSA_HIHAT, ...BOSSA_KICK, ...BOSSA_CROSS_STICK], variations: [[]] };
}

function getLatinPatternSet(): StylePatternSet {
  // Clave excluded from base - added per-measure with 2-bar phase alternation
  return { base: [...LATIN_CASCARA, ...LATIN_KICK, ...LATIN_HIHAT], variations: [[]] };
}

function getBalladPatternSet(): StylePatternSet {
  return { base: [...BALLAD_RIDE, ...BALLAD_HIHAT], variations: BALLAD_KICK };
}

function getFunkPatternSet(): StylePatternSet {
  return { base: [...FUNK_HIHAT], variations: FUNK_KICK_SNARE };
}

function getFusionPatternSet(rng: () => number = Math.random): StylePatternSet {
  // 30% linear patterns (full kit in one array, no separate base)
  if (rng() < 0.3) {
    return { base: [], variations: [FUSION_LINEAR_A, FUSION_LINEAR_B] };
  }
  // Timekeeping rotates between hihat variants and ride bell via rideVariants
  const tkIdx = Math.floor(rng() * FUSION_TIMEKEEPING.length);
  return {
    base: [...FUSION_TIMEKEEPING[tkIdx]],
    variations: FUSION_KICK_SNARE,
    rideVariants: FUSION_TIMEKEEPING,
  };
}

function getAlfaMistPatternSet(rng: () => number = Math.random): StylePatternSet {
  // Initial hi-hat: 50/50 between full 16th shimmer and broken-gap
  const hhIdx = Math.floor(rng() * ALFA_MIST_HIHATS.length);
  // ~30% chance to start on ride (textural, not timekeeping) - mostly hi-hat driven
  const useRide = rng() < 0.3;
  const base = useRide
    ? [...ALFA_MIST_RIDES[Math.floor(rng() * ALFA_MIST_RIDES.length)], ...ALFA_MIST_HIHATS[hhIdx]]
    : [...ALFA_MIST_HIHATS[hhIdx]];
  return {
    base,
    variations: ALFA_MIST_KICK_SNARE,
    rideVariants: ALFA_MIST_RIDES,
    hihatVariants: ALFA_MIST_HIHATS,
  };
}

function getMethenyPatternSet(rng: () => number = Math.random): StylePatternSet {
  // Initial ride+HH chosen randomly; rideVariants/hihatVariants enable rotation every 4-8 bars
  const rideIdx = Math.floor(rng() * METHENY_RIDES.length);
  const hhIdx = Math.floor(rng() * METHENY_HIHATS.length);
  return {
    base: [...METHENY_RIDES[rideIdx], ...METHENY_HIHATS[hhIdx]],
    variations: METHENY_KICK_SNARE,
    rideVariants: METHENY_RIDES,
    hihatVariants: METHENY_HIHATS,
  };
}

function getHoldsworthPatternSet(rng: () => number = Math.random): StylePatternSet {
  // All ride variants have bell - Wackerman always uses bell.
  // Ride rotates every 4-8 bars via rideVariants for timbral arc.
  // HH variants also rotate for variety (Wackerman uses hat conversationally).
  // Ride D (sparse quarters) at index 0 for rideWash bias: low wash -> sparse, high -> dense
  const rideVariants = [HOLDSWORTH_RIDE_D, HOLDSWORTH_RIDE_B, HOLDSWORTH_RIDE_A, HOLDSWORTH_RIDE_C];
  const initialIdx = Math.floor(rng() * rideVariants.length);
  const hhIdx = Math.floor(rng() * HOLDSWORTH_HIHATS.length);
  return {
    base: [...rideVariants[initialIdx], ...HOLDSWORTH_HIHATS[hhIdx]],
    variations: HOLDSWORTH_KICK_SNARE,
    rideVariants: rideVariants,
    hihat: HOLDSWORTH_HIHATS[hhIdx],
    hihatVariants: HOLDSWORTH_HIHATS,
  };
}

function getHoldsworth11_8PatternSet(rng: () => number = Math.random): StylePatternSet {
  // Both ride variants have bell - rotate for timbral variety
  // Ride C (sparse) at index 0 for rideWash bias: low wash -> sparse, high -> dense
  const rideVariants = [HOLDSWORTH_11_8_RIDE_C, HOLDSWORTH_11_8_RIDE_B, HOLDSWORTH_11_8_RIDE_A];
  const initialIdx = Math.floor(rng() * rideVariants.length);
  const hhIdx = Math.floor(rng() * HOLDSWORTH_11_8_HIHATS.length);
  return {
    base: [...rideVariants[initialIdx], ...HOLDSWORTH_11_8_HIHATS[hhIdx]],
    variations: HOLDSWORTH_11_8_KICK_SNARE,
    rideVariants: rideVariants,
    hihat: HOLDSWORTH_11_8_HIHATS[hhIdx],
    hihatVariants: HOLDSWORTH_11_8_HIHATS,
  };
}

function getNeoSoulPatternSet(rng: () => number = Math.random): StylePatternSet {
  // Broken hihat rotation - Dilla/Questlove feel shifts every 4-8 bars
  const hhIdx = Math.floor(rng() * NEO_SOUL_HIHATS.length);
  return {
    base: [...NEO_SOUL_HIHATS[hhIdx]],
    variations: NEO_SOUL_KICK_SNARE,
    rideVariants: NEO_SOUL_HIHATS,
  };
}

function getContemporaryJazzPatternSet(rng: () => number = Math.random): StylePatternSet {
  const rideIdx = Math.floor(rng() * CONTEMP_RIDES.length);
  const hhIdx = Math.floor(rng() * CONTEMP_HIHATS.length);
  return {
    base: [...CONTEMP_RIDES[rideIdx], ...CONTEMP_HIHATS[hhIdx]],
    variations: CONTEMP_KICK_SNARE,
    rideVariants: CONTEMP_RIDES,
    hihatVariants: CONTEMP_HIHATS,
  };
}

function getMathRockPatternSet(rng: () => number = Math.random): StylePatternSet {
  const base = rng() < 0.5 ? [...MATH_HIHAT_5] : [...MATH_HIHAT_3];
  return { base, variations: MATH_KICK_SNARE };
}

function getIdmPatternSet(rng: () => number = Math.random): StylePatternSet {
  const r = rng();
  const base = r < 0.33 ? [...IDM_HIHAT] : r < 0.67 ? [...IDM_HIHAT_B] : [...IDM_HIHAT_C];
  return { base, variations: IDM_KICK_SNARE };
}

function getEcmPatternSet(): StylePatternSet {
  return { base: [...ECM_RIDE, ...ECM_KICK, ...ECM_HIHAT], variations: ECM_SNARE };
}

function getHardBopPatternSet(rng: () => number = Math.random): StylePatternSet {
  const rideIdx = Math.floor(rng() * HARD_BOP_RIDES.length);
  const hhIdx = Math.floor(rng() * HARD_BOP_HIHATS.length);
  return {
    base: [...HARD_BOP_RIDES[rideIdx], ...HARD_BOP_HIHATS[hhIdx]],
    variations: HARD_BOP_KICK_SNARE,
    rideVariants: HARD_BOP_RIDES,
    hihatVariants: HARD_BOP_HIHATS,
  };
}

function getCoolJazzPatternSet(rng: () => number = Math.random): StylePatternSet {
  const rideIdx = Math.floor(rng() * COOL_RIDES.length);
  const hhIdx = Math.floor(rng() * COOL_HIHATS.length);
  return {
    base: [...COOL_RIDES[rideIdx], ...COOL_HIHATS[hhIdx]],
    variations: COOL_KICK_SNARE,
    rideVariants: COOL_RIDES,
    hihatVariants: COOL_HIHATS,
  };
}

function getModalPatternSet(): StylePatternSet {
  return { base: [...MODAL_RIDE, ...MODAL_HIHAT], variations: MODAL_KICK };
}

function getJazzWaltzPatternSet(): StylePatternSet {
  return { base: [...WALTZ_RIDE, ...WALTZ_HIHAT, ...WALTZ_KICK], variations: [[]] };
}

function getFiveFourPatternSet(): StylePatternSet {
  return { base: [...FIVE_FOUR_RIDE_3_2, ...FIVE_FOUR_HIHAT], variations: FIVE_FOUR_KICK_SNARE };
}

function getSevenEighthPatternSet(rng: () => number = Math.random): StylePatternSet {
  const base = rng() < 0.6 ? [...SEVEN_EIGHT_RIDE_223] : [...SEVEN_EIGHT_RIDE_322];
  return { base, variations: SEVEN_EIGHT_KICK_SNARE };
}

function getSixEighthPatternSet(): StylePatternSet {
  return { base: [...SIX_EIGHT_RIDE, ...SIX_EIGHT_HIHAT], variations: SIX_EIGHT_KICK_SNARE };
}

function getNineEighthPatternSet(): StylePatternSet {
  return { base: [...NINE_EIGHT_RIDE], variations: NINE_EIGHT_KICK_SNARE };
}

function getSixFourPatternSet(): StylePatternSet {
  return { base: [...SIX_FOUR_RIDE, ...SIX_FOUR_HIHAT], variations: SIX_FOUR_KICK_SNARE };
}

function getSevenFourPatternSet(): StylePatternSet {
  return { base: [...SEVEN_FOUR_RIDE, ...SEVEN_FOUR_HIHAT], variations: SEVEN_FOUR_KICK_SNARE };
}

function getElevenEighthPatternSet(): StylePatternSet {
  return { base: [...ELEVEN_EIGHT_RIDE], variations: ELEVEN_EIGHT_KICK_SNARE };
}

/** Get meter-specific pattern set. Returns null if no special pattern exists (use style default). */
export function getMeterPatternSet(timeSig: [number, number], random?: () => number): StylePatternSet | null {
  const [n, d] = timeSig;
  if (n === 3 && d === 4) return getJazzWaltzPatternSet();
  if (n === 5 && d === 4) return getFiveFourPatternSet();
  if (n === 6 && d === 8) return getSixEighthPatternSet();
  if (n === 7 && d === 8) return getSevenEighthPatternSet(random);
  if (n === 9 && d === 8) return getNineEighthPatternSet();
  if (n === 6 && d === 4) return getSixFourPatternSet();
  if (n === 7 && d === 4) return getSevenFourPatternSet();
  if (n === 11 && d === 8) return getElevenEighthPatternSet();
  return null;
}

function getShuffleBluesPatternSet(): StylePatternSet {
  return { base: [...SHUFFLE_RIDE, ...SHUFFLE_HIHAT, ...SHUFFLE_KICK_SNARE], variations: [[]] };
}

/** Get the style-specific pattern set (timekeeping base + comping variations) */
export function getStylePatternSet(style: string, rng: () => number = Math.random): StylePatternSet {
  switch (style) {
    case "bossa": return getBossaPatternSet();
    case "latin": return getLatinPatternSet();
    case "ballad": return getBalladPatternSet();
    case "funk": return getFunkPatternSet();
    case "fusion": return getFusionPatternSet(rng);
    case "ecm": return getEcmPatternSet();
    case "hardBop": return getHardBopPatternSet(rng);
    case "coolJazz": return getCoolJazzPatternSet(rng);
    case "modal": return getModalPatternSet();
    case "jazzWaltz": return getJazzWaltzPatternSet();
    case "shuffleBlues": return getShuffleBluesPatternSet();
    case "neoSoul": return getNeoSoulPatternSet(rng);
    case "contemporaryJazz": return getContemporaryJazzPatternSet(rng);
    case "mathRock": return getMathRockPatternSet(rng);
    case "idm": return getIdmPatternSet(rng);
    case "holdsworth": return getHoldsworthPatternSet(rng);
    case "alfaMist": return getAlfaMistPatternSet(rng);
    case "metheny": return getMethenyPatternSet(rng);
    case "swing":
    default: return getSwingPatternSet(rng);
  }
}

// ── Main Generator ──

/**
 * Generate drum pattern for given number of measures.
 * Returns array of DrumHit events with absolute timing.
 *
 * Phrase continuity: kick/snare comping patterns are held for 2-4 bars
 * before switching to a new variation, mimicking how real drummers play.
 */
export function generateDrumPattern(options: DrumPatternOptions = {}): DrumHit[] {
  const rng = options.random ?? Math.random;
  const style = options.style ?? "swing";
  const tempo = options.tempo ?? 120;
  if (tempo <= 0) throw new RangeError(`tempo must be > 0, got ${tempo}`);
  const numMeasures = options.measures ?? 4;
  const timeSig = options.timeSignature ?? [4, 4];
  const humanize = options.humanize ?? true;
  const startTime = options.startTime ?? 0;
  const density = options.density ?? 50;

  const swingAmount = options.swingAmount ?? 100;
  const formMarkers = options.formMarkers ?? [];
  const sectionMarkers = options.sectionMarkers ?? [];
  const bandCtx = options.bandContext;
  const beatDuration = 60 / tempo;
  const beatsPerMeasure = timeSig[0] * (4 / timeSig[1]);
  const measureDuration = beatsPerMeasure * beatDuration;

  // Select pattern set: meter-specific patterns override style when in odd meters
  // (e.g., 5/4 or 7/8 need specific grouping patterns regardless of style)
  // Exception: styles with their own odd-meter patterns (e.g., Holdsworth 11/8)
  // use style-specific patterns to preserve musical character.
  const meterPatternSet = getMeterPatternSet(timeSig, rng);
  const hasStyleOddMeter = style === "holdsworth" && timeSig[0] === 11 && timeSig[1] === 8;
  const isOddMeter = !hasStyleOddMeter && meterPatternSet !== null && !(timeSig[0] === 4 && timeSig[1] === 4) && !(timeSig[0] === 3 && timeSig[1] === 4 && style === "jazzWaltz");

  let patternSet: StylePatternSet;
  if (isOddMeter) {
    patternSet = meterPatternSet;
  } else {
    switch (style) {
      case "bossa": patternSet = getBossaPatternSet(); break;
      case "latin": patternSet = getLatinPatternSet(); break;
      case "ballad": patternSet = getBalladPatternSet(); break;
      case "funk": patternSet = getFunkPatternSet(); break;
      case "fusion": patternSet = getFusionPatternSet(rng); break;
      case "ecm": patternSet = getEcmPatternSet(); break;
      case "hardBop": patternSet = getHardBopPatternSet(rng); break;
      case "coolJazz": patternSet = getCoolJazzPatternSet(rng); break;
      case "modal": patternSet = getModalPatternSet(); break;
      case "jazzWaltz": patternSet = getJazzWaltzPatternSet(); break;
      case "shuffleBlues": patternSet = getShuffleBluesPatternSet(); break;
      case "neoSoul": patternSet = getNeoSoulPatternSet(rng); break;
      case "contemporaryJazz": patternSet = getContemporaryJazzPatternSet(rng); break;
      case "mathRock": patternSet = getMathRockPatternSet(rng); break;
      case "idm": patternSet = getIdmPatternSet(rng); break;
      case "holdsworth": patternSet = (timeSig[0] === 11 && timeSig[1] === 8) ? getHoldsworth11_8PatternSet(rng) : getHoldsworthPatternSet(rng); break;
      case "alfaMist": patternSet = getAlfaMistPatternSet(rng); break;
      case "metheny": patternSet = getMethenyPatternSet(rng); break;
      case "swing":
      default: patternSet = getSwingPatternSet(rng); break;
    }
  }

  // Phrase continuity: hold kick/snare variation for 2-4 bars before switching
  // For stochastic styles, "tendency" replaces fixed variation rotation.
  // In streaming (measures=1), state is restored from options.drumState to maintain
  // continuity across calls.
  const isStochastic = STOCHASTIC_STYLES.has(style);
  // Holdsworth in 11/8 uses its own stochastic table adapted for odd-meter groupings
  const stochasticTable = isStochastic
    ? (style === "holdsworth" && timeSig[0] === 11 && timeSig[1] === 8
       ? HOLDSWORTH_11_8_STOCHASTIC
       : STOCHASTIC_TABLES[style])
    : null;
  const ds = options.drumState;
  // When drumState is provided with sentinel values (variationIdx < 0, tendency null),
  // initialize them using rng so PRNG consumption matches the batch (no drumState) path.
  let tendency: CompingTendency | null = (ds && ds.tendency !== null)
    ? ds.tendency as CompingTendency
    : (isStochastic && stochasticTable ? pickTendency(stochasticTable, rng) : null);

  let variationIdx = (ds && ds.variationIdx >= 0)
    ? ds.variationIdx
    : Math.floor(rng() * patternSet.variations.length);
  let barsOnPattern = ds ? ds.barsOnPattern : 0;
  let patternHoldBars = (ds && ds.patternHoldBars >= 0)
    ? ds.patternHoldBars
    : 2 + Math.floor(rng() * 3);

  // Ride + hihat rotation: when rideVariants present, swap timbre every 4-8 bars
  const rideVariants = patternSet.rideVariants;
  const hhVariants = patternSet.hihatVariants;
  // rideWash biases variant selection: low wash -> sparse (idx 0), high -> dense (higher idx)
  const rideWashBias = options.granular ? options.granular.rideWash / 50 : 1; // 0-2 range, 1=neutral
  let rideIdx = rideVariants ? Math.min(rideVariants.length - 1, Math.floor(rng() * rideVariants.length * rideWashBias)) : -1;
  let hhIdx = hhVariants ? Math.floor(rng() * hhVariants.length) : -1;
  let barsOnRide = 0;
  let rideHoldBars = rideVariants ? (4 + Math.floor(rng() * 5)) : Infinity;

  // Latin clave 2-bar phase tracking: 0 = 3-side, 1 = 2-side
  const isLatin = style === "latin";
  let clavePhase = ds?.clavePhase ?? 0;

  // Brush articulation: ballad, coolJazz, ECM use brushes instead of sticks.
  // Annotates snare hits with sweep/tap/swirl for renderers that support it.
  const BRUSH_STYLES = new Set(["ballad", "coolJazz", "ecm"]);
  const useBrushes = BRUSH_STYLES.has(style);

  const hits: DrumHit[] = [];
  let lastFillIdx = options.drumState?.lastFillIdx ?? -1;

  for (let m = 0; m < numMeasures; m++) {
    // Tendency rotation for stochastic styles
    if (isStochastic && tendency) {
      tendency.barsRemaining--;
      if (tendency.barsRemaining <= 0) {
        tendency = pickTendency(stochasticTable!, rng);
      }
    }

    // Variation rotation for non-stochastic styles
    if (!isStochastic && barsOnPattern >= patternHoldBars && patternSet.variations.length > 1) {
      if (patternSet.variations.length > 2) {
        const candidates = Array.from({ length: patternSet.variations.length }, (_, i) => i)
          .filter((i) => i !== variationIdx);
        variationIdx = candidates[Math.floor(rng() * candidates.length)];
      } else {
        variationIdx = 1 - variationIdx;
      }
      patternHoldBars = 2 + Math.floor(rng() * 3);
      barsOnPattern = 0;
    }

    // Ride + hihat rotation: swap ride bell density every 4-8 bars for timbral arc
    if (rideVariants && barsOnRide >= rideHoldBars) {
      const rideCandidates = Array.from({ length: rideVariants.length }, (_, i) => i)
        .filter((i) => i !== rideIdx);
      // rideWash biases rotation: high wash -> prefer higher (denser) indices
      const rideRotIdx = Math.min(rideCandidates.length - 1, Math.floor(rng() * rideCandidates.length * rideWashBias));
      rideIdx = rideCandidates[rideRotIdx];
      // Also rotate hihat - filter current to guarantee change
      if (hhVariants && hhVariants.length > 1) {
        const hhCandidates = Array.from({ length: hhVariants.length }, (_, i) => i)
          .filter((i) => i !== hhIdx);
        hhIdx = hhCandidates[Math.floor(rng() * hhCandidates.length)];
      }
      const hh = hhVariants ? hhVariants[hhIdx] : (patternSet.hihat ?? []);
      patternSet.base = [...rideVariants[rideIdx], ...hh];
      patternSet.hihat = hh;
      rideHoldBars = 4 + Math.floor(rng() * 5);
      barsOnRide = 0;
    }

    const measureStart = startTime + m * measureDuration;

    // BandContext: section energy scales intensity (0.3=sparse intro, 1.0=dense shout)
    const energy = bandCtx?.sectionEnergy ?? 0.7;
    const feel = bandCtx?.currentPhraseIntent?.feel ?? "normal";

    // ── Musicality: Drums Minimal (ride + pedal hat only) ──
    // When phrase intent says this measure should be minimal, strip to timekeeping only.
    // Creates dramatic breathing room - silence is the most powerful musical tool.
    const absoluteM = Math.round(measureStart / measureDuration);
    // Per-measure phrase intent lookup (not stale currentPhraseIntent)
    const phraseIntent = bandCtx?.phraseMap
      ? lookupDrumIntent(absoluteM, bandCtx.phraseMap)
      : bandCtx?.currentPhraseIntent ?? null;
    const arc = phraseIntent?.arc;
    if (phraseIntent?.drumsMinimal?.includes(absoluteM)) {
      // Minimal drums: just ride quarters and pedal hat on 2&4
      for (let b = 0; b < beatsPerMeasure; b++) {
        const t = measureStart + b * beatDuration;
        hits.push({
          pitch: GM_DRUMS.RIDE,
          time: Math.max(0, humanizeTime(t, humanize, style, GM_DRUMS.RIDE, rng, energy, arc)),
          duration: 0.08,
          velocity: humanizeVelocity(b === 0 ? 55 : 45, false, humanize, rng),
        });
        if (b === 1 || b === 3) {
          hits.push({
            pitch: GM_DRUMS.HI_HAT_PEDAL,
            time: Math.max(0, humanizeTime(t, humanize, style, GM_DRUMS.HI_HAT_PEDAL, rng, energy, arc)),
            duration: 0.05,
            velocity: humanizeVelocity(35, false, humanize, rng),
          });
        }
      }
      barsOnPattern++;
      continue;
    }

    // ── Phrase Arc Dynamics ──
    // Drums respond to phrase arc: build/climax = busier+louder, release = sparser+softer.
    // Without this, drums play identically regardless of musical narrative.
    const isDrop = phraseIntent?.dropMeasures?.includes(absoluteM) ?? false;
    const arcVelMult = isDrop ? 0.7
      : arc === "shout" ? 1.20
      : arc === "climax" ? 1.15
      : arc === "build" || arc === "solo" ? 1.05 + (phraseIntent?.crescendo ? 0.05 : 0)
      : arc === "vamp" ? 1.0
      : arc === "release" || arc === "outro" || arc === "interlude" ? 0.88
      : arc === "drop" || arc === "breakdown" ? 0.75
      : arc === "intro" ? 0.90
      : 1.0;
    // Build/climax: accept more ghost notes (lower threshold). Release/drop: strip ghosts.
    const arcGhostAdjust = isDrop ? 20
      : arc === "shout" ? -10
      : arc === "climax" ? -8
      : arc === "build" || arc === "solo" ? -4
      : arc === "release" || arc === "outro" || arc === "interlude" ? 8
      : arc === "drop" || arc === "breakdown" ? 15
      : arc === "intro" ? 5
      : 0;

    // ── Feel Changes (double-time / half-time) ──
    // Double-time: boost energy and density. Half-time: sparse, laid back.
    const feelVelMult = feel === "doubleTime" ? 1.1 : feel === "halfTime" ? 0.85 : 1.0;
    const feelGhostAdjust = feel === "doubleTime" ? -10 : feel === "halfTime" ? 15 : 0;

    // ── Conversation Awareness ──
    // When drums are the leader, play more actively. When listening, pull back.
    const isLeader = phraseIntent?.conversationLeader === "drums";
    const isListening = phraseIntent?.conversationLeader != null && !isLeader;
    // Leader: louder and more present. Listening: pull back (ride + time only feel)
    const convDrumVelMult = isLeader ? 1.12 : isListening ? 0.82 : 1.0;

    // Crash cymbal on form boundaries - louder at section boundaries
    // Alfa Mist: crashes only on section starts or 30% of phrase boundaries (sparse, not every 4 bars)
    if (formMarkers.includes(m)) {
      const isSectionStart = sectionMarkers.includes(m);
      const crashProb = style === "alfaMist" ? (isSectionStart ? 0.8 : 0.25) : 1.0;
      if (m === 0 || rng() < crashProb) {
        // BandContext: crash velocity scales with energy (soft intros, big climaxes)
        const crashBaseVel = isSectionStart ? 85 : 70;
        const crashVel = Math.round(crashBaseVel * (0.6 + energy * 0.4));
        // cymbalColor: probability to substitute crash with splash or china for timbral variety
        const cymColor = options.granular ? options.granular.cymbalColor : 0;
        let cymbalPitch: number = GM_DRUMS.CRASH;
        if (cymColor > 0 && rng() < cymColor / 100) {
          cymbalPitch = rng() < 0.6 ? GM_DRUMS.SPLASH : GM_DRUMS.CHINA;
        }
        hits.push({
          pitch: cymbalPitch,
          time: Math.max(0, humanizeTime(measureStart, humanize, style, GM_DRUMS.CRASH, rng, energy, arc)),
          duration: isSectionStart ? 0.15 : 0.08,
          velocity: humanizeVelocity(crashVel, false, humanize, rng),
        });
      }
    }

    // Structure-aware fills: size matches form position
    // BandContext: fill probability scales with energy - sparse sections rarely fill
    // In streaming (measures=1), fillHint from ensemble.ts provides lookahead info
    // since the single-measure loop can't look at m+1/m+2.
    //
    // Harmonic-aware: boost fill probability before cadence resolutions.
    // Real drummers set up cadences with fills to mark the arrival.
    let fillPattern: Pattern | null = null;
    const fillHint = options.fillHint;
    const isBeforeCadence = (() => {
      const ha = bandCtx?.harmonicAnalysis;
      if (!ha) return false;
      // Check if next measure's chord is a cadence resolution (V-I arrival)
      const nextMeasureIdx = absoluteM + 1;
      return nextMeasureIdx < ha.chordAnalyses.length
        && ha.chordAnalyses[nextMeasureIdx].cadenceRole === "resolution"
        && ha.chordAnalyses[nextMeasureIdx].cadenceType === "authentic";
    })();
    if (FILL_STYLES.has(style) && (m > 0 || fillHint)) {
      const isBeforeSectionMarker = fillHint === "section" || sectionMarkers.includes(m + 1);
      const isBeforeFormMarker = fillHint === "phrase" || formMarkers.includes(m + 1) || isBeforeCadence;
      const isSetupBar = fillHint === "setup" || sectionMarkers.includes(m + 2);

      // Energy multiplier: at energy 0.3 fills are 40% as likely, at 1.0 fully likely
      const energyFillMult = 0.2 + energy * 0.8;

      // Tempo fill scaling: reduce fill frequency at fast tempos (>220)
      // Fills at fast tempos sound cluttered and unmusical
      const tempoFillScale = tempo > 220 ? Math.max(0.3, 1.0 - (tempo - 220) / 200) : 1.0;

      // Style-specific fill frequency: Wackerman fills frequently and dramatically,
      // Alfa Mist is sparse and broken-beat, others are standard jazz.
      const fillScale = fillProbScale(options.granular?.fillIntensity ?? 50) * tempoFillScale;
      const sectionProb = (style === "alfaMist" ? 0.35 : style === "holdsworth" ? 0.55 : style === "metheny" ? 0.70 : 0.6) * energyFillMult * fillScale;
      const phraseProb = (style === "alfaMist" ? 0.20 : style === "holdsworth" ? 0.30 : style === "metheny" ? 0.50 : 0.4) * energyFillMult * fillScale;

      if (isBeforeSectionMarker && rng() < sectionProb) {
        const pool = style === "holdsworth" ? (hasStyleOddMeter ? HOLDSWORTH_11_8_FILLS : HOLDSWORTH_FILLS)
          : style === "alfaMist" ? ALFA_MIST_FILLS
          : style === "fusion" ? FUSION_FILLS : JAZZ_FILLS_BIG;
        fillPattern = selectContextualFill(pool, energy, arc, lastFillIdx, rng);
        lastFillIdx = pool.indexOf(fillPattern);
      } else if (isBeforeFormMarker && rng() < phraseProb) {
        const pool = style === "holdsworth" ? (hasStyleOddMeter ? HOLDSWORTH_11_8_FILLS : HOLDSWORTH_FILLS)
          : style === "alfaMist" ? ALFA_MIST_FILLS
          : style === "fusion" ? FUSION_FILLS : JAZZ_FILLS;
        fillPattern = selectContextualFill(pool, energy, arc, lastFillIdx, rng);
        lastFillIdx = pool.indexOf(fillPattern);
      } else if (isSetupBar && rng() < 0.25 * energyFillMult) {
        fillPattern = SETUP_FILLS[Math.floor(rng() * SETUP_FILLS.length)];
      }
    }

    // Comping: stochastic per-beat generation for jazz styles, fixed arrays for others
    // Fast harmonic rhythm: reduce comping density to avoid clutter over rapid changes
    const hr = bandCtx?.harmonicRhythm ?? 1;
    const hrDensityScale = hr >= 3 ? 0.6 : hr >= 2 ? 0.8 : 1.0;
    const effectiveDensity = Math.round(density * hrDensityScale);
    const tomScale = options.granular ? options.granular.tomFrequency / 40 : 1;
    let compHits: PatternHit[];
    if (isStochastic && stochasticTable && tendency) {
      compHits = generateStochasticComping(stochasticTable, effectiveDensity, tendency, rng, tomScale);
    } else {
      compHits = patternSet.variations[variationIdx];
    }

    // When fill is active, keep comping hits on beats 1-2 only (fill replaces beats 3-4)
    const variationHits = fillPattern ? compHits.filter((h) => h.beat < 2) : compHits;

    // Latin clave: 2-bar phase alternation (3-side / 2-side)
    const claveHits = isLatin ? (clavePhase === 0 ? LATIN_CLAVE_3 : LATIN_CLAVE_2) : [];

    const pattern = [...patternSet.base, ...claveHits, ...variationHits, ...(fillPattern ?? [])];

    // BandContext: energy-aware ghost note threshold - low energy strips ghosts earlier
    // Arc adjustment: build/climax keep more ghosts (busier), release/drop strip them (sparser)
    // Cap at 40 to always preserve some ghost notes (was uncapped to 55, stripping all ghosts in drops)
    // ghostDensity slider: high = more ghosts survive (lower threshold), low = cleaner sound
    // Fast tempo shift: raise threshold to strip ghosts at speed (>220 BPM)
    const tempoGhostShift = tempo > 220 ? Math.min(15, (tempo - 220) * 0.15) : 0;
    const ghostShift = options.granular ? (options.granular.ghostDensity - 40) * -0.4 : 0;
    const ghostThreshold = bandCtx ? Math.min(40, Math.round(15 + (1 - energy) * 20 + arcGhostAdjust + feelGhostAdjust + ghostShift + tempoGhostShift)) : Math.max(0, Math.round(15 + ghostShift + tempoGhostShift));

    for (const hit of pattern) {
      if (hit.beat >= beatsPerMeasure) continue;

      // Half-time: thin pattern by dropping non-essential hits on offbeats
      if (feel === "halfTime" && hit.beat % 1 !== 0 && hit.drum !== GM_DRUMS.RIDE && hit.drum !== GM_DRUMS.RIDE_BELL) {
        if (rng() < 0.5) continue; // drop 50% of offbeat non-ride hits
      }

      // Density filtering: ghost notes removed at low density (threshold rises in quiet sections)
      if (hit.ghost && density < ghostThreshold) continue;

      // Apply swingAmount to pre-swung skip notes (0.67 positions -> parametric)
      let beat = hit.beat;
      const frac = beat % 1;
      if (Math.abs(frac - 0.67) < 0.02) {
        const effectiveSwing = swingAmount * tempoSwingMultiplier(tempo, bandCtx?.sectionEnergy) * instrumentSwingFactor("drums");
        const swingOffset = (effectiveSwing / 100) * (2 / 3 - 0.5);
        beat = Math.floor(beat) + 0.5 + swingOffset;
      }

      let time = measureStart + beat * beatDuration;
      // Ride skip notes get consistent +5ms lag for natural swing delay
      if (humanize && (hit.drum === GM_DRUMS.RIDE || hit.drum === GM_DRUMS.RIDE_BELL) && Math.abs(frac - 0.67) < 0.02) {
        time += 0.005;
      }
      const absoluteMeasureIdx = Math.round(measureStart / measureDuration);
      const dynMult = options.measureInfo
        ? dynamicMultiplier(absoluteMeasureIdx, options.measureInfo.totalMeasures, undefined, options.measureInfo.sections)
        : 1.0;
      // BandContext: velocity scaled by energy (quiet sections play softer).
      // Skip when dynamicMultiplier already incorporates section.dynamicLevel
      // to avoid double-scaling quiet sections.
      const hasSectionDynamics = options.measureInfo?.sections && options.measureInfo.sections.length > 0;
      const energyVelMult = (bandCtx && !hasSectionDynamics) ? (0.7 + energy * 0.3) : 1.0;
      const drumHit: DrumHit = {
        pitch: hit.drum,
        time: Math.max(0, humanizeTime(time, humanize, style, hit.drum, rng, energy, arc)
          + rubatoOffset(style, hit.beat, beatsPerMeasure, arc)),
        duration: 0.08,
        velocity: humanizeVelocity(Math.round(hit.velocity * dynMult * energyVelMult * arcVelMult * feelVelMult * convDrumVelMult), hit.ghost ?? false, humanize, rng),
      };
      // Brush articulation for ballad/coolJazz/ECM styles
      if (useBrushes) {
        if (hit.drum === GM_DRUMS.SNARE || hit.drum === GM_DRUMS.CROSS_STICK || hit.drum === GM_DRUMS.SIDE_STICK) {
          // Beats 2 and 4: tap articulation (brush strike), others: sweep (continuous motion)
          const isBackbeat = Math.abs(hit.beat - 1) < 0.1 || Math.abs(hit.beat - 3) < 0.1;
          drumHit.brush = isBackbeat ? "tap" : (hit.ghost ? "swirl" : "sweep");
        } else if (hit.drum === GM_DRUMS.RIDE || hit.drum === GM_DRUMS.RIDE_BELL) {
          drumHit.brush = "sweep"; // brush on cymbal = wash
        }
      }
      hits.push(drumHit);
    }

    applyMicroVariation(hits, measureStart, beatDuration, beatsPerMeasure, style, density, humanize, rng, options.granular);

    barsOnPattern++;
    barsOnRide++;
    if (isLatin) clavePhase = 1 - clavePhase; // alternate 3-side / 2-side
  }

  // Persist state for streaming continuity across 1-measure calls
  if (ds) {
    ds.variationIdx = variationIdx;
    ds.barsOnPattern = barsOnPattern;
    ds.patternHoldBars = patternHoldBars;
    ds.tendency = tendency;
    ds.clavePhase = clavePhase;
    ds.lastFillIdx = lastFillIdx;
  }

  hits.sort((a, b) => a.time - b.time);

  interlockKickHihat(hits, style, rng);

  return hits;
}

// ── Phrase Intent Lookup (per-measure, not stale snapshot) ──

function lookupDrumIntent(measure: number, phraseMap: { boundaries: number[]; intents?: PhraseIntent[] }): PhraseIntent | null {
  if (!phraseMap.intents || phraseMap.intents.length === 0) return null;
  for (let i = phraseMap.boundaries.length - 1; i >= 0; i--) {
    if (measure >= phraseMap.boundaries[i]) {
      return phraseMap.intents[i] ?? null;
    }
  }
  return null;
}

// ── Kick-HiHat Interlocking ──

export function interlockKickHihat(hits: DrumHit[], style: string, random?: () => number, prob?: number): void {
  if (!INTERLOCK_STYLES.has(style)) return;
  const rng = random ?? Math.random;
  const interlockProb = prob ?? 0.6;

  const kicks = hits.filter(h => h.pitch === GM_DRUMS.KICK);
  for (const kick of kicks) {
    for (const hit of hits) {
      if (hit.pitch !== GM_DRUMS.HI_HAT_CLOSED) continue;
      if (Math.abs(hit.time - kick.time) > 0.02) continue;

      if (rng() < interlockProb) {
        hit.pitch = GM_DRUMS.HI_HAT_OPEN;
        hit.velocity = Math.min(hit.velocity + 10, 70);
        hit.duration = 0.12;
      } else {
        hit.velocity = Math.max(25, hit.velocity - 20);
      }
    }
  }
}
