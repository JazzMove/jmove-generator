/**
 * Piano Comping Generator — jazz piano voicings with rhythmic patterns.
 *
 * Voicing types (Bill Evans style):
 *   Type A: 3-7-9-5 (rootless, 3rd on bottom)
 *   Type B: 7-9-3-13 (rootless, 7th on bottom)
 *
 * Voice leading: minimizes total semitone motion between consecutive chords.
 * Rhythm templates: swing (syncopated), bossa (montuno), ballad (whole notes).
 * Humanization: ±5ms timing jitter, ±5 velocity variation.
 */

import { tempoSwingMultiplier, dynamicMultiplier, instrumentSwingFactor } from "./swingUtils";
import { getGrooveTemplate, applyGroove, rubatoOffset } from "./grooveTemplates";
import { isDominant as isDominantQuality } from "./chordQuality";
import type { CompNote, PianoStyle, PianoCompingOptions, ChordEvent, PianoGranular } from "./types";
import {
  PIANO_LOW_DEFAULT, PIANO_HIGH_DEFAULT,
  SWING_RHYTHMS, BOSSA_RHYTHMS, LATIN_RHYTHMS, BALLAD_RHYTHMS,
  FUSION_RHYTHMS, ECM_RHYTHMS, HARD_BOP_RHYTHMS, COOL_JAZZ_RHYTHMS,
  MODAL_RHYTHMS, JAZZ_WALTZ_RHYTHMS, SHUFFLE_BLUES_RHYTHMS,
  NEO_SOUL_RHYTHMS, CONTEMP_JAZZ_RHYTHMS, MATH_ROCK_RHYTHMS,
  IDM_RHYTHMS, HOLDSWORTH_RHYTHMS, ALFA_MIST_RHYTHMS, METHENY_RHYTHMS,
  FIVE_FOUR_RHYTHMS, SIX_EIGHT_RHYTHMS, SEVEN_EIGHT_RHYTHMS,
  NINE_EIGHT_RHYTHMS, SIX_FOUR_RHYTHMS, SEVEN_FOUR_RHYTHMS, ELEVEN_EIGHT_RHYTHMS,
  type RhythmHit,
} from "./pianoVoicingData";
import {
  initVoicingState, restoreVoicingState,
  pickVoicing, toShellVoicing, isResolvingDominant,
} from "./pianoVoicings";

export type { CompNote, PianoStyle, PianoCompingOptions, ChordEvent };

// ── Module-level PRNG ──
let _rng: () => number = Math.random;
let _pianoGranular: PianoGranular | undefined;
let _pianoEnergy: number = 0.7;
let _pianoArc: import("./types").PhraseArc | null = null;

function getPianoLow(): number {
  if (!_pianoGranular) return PIANO_LOW_DEFAULT;
  const reg = _pianoGranular.pianoRegister ?? 50;
  const shift = Math.round((reg - 50) / 50 * 7);
  return PIANO_LOW_DEFAULT + shift;
}

function getPianoHigh(): number {
  if (!_pianoGranular) return PIANO_HIGH_DEFAULT;
  const reg = _pianoGranular.pianoRegister ?? 50;
  const shift = Math.round((reg - 50) / 50 * 7);
  return PIANO_HIGH_DEFAULT + shift;
}

/** Get rhythm templates for a given time signature. Returns null for standard meters. */
function getOddMeterRhythms(timeSig: [number, number]): RhythmHit[][] | null {
  const [n, d] = timeSig;
  if (n === 5 && d === 4) return FIVE_FOUR_RHYTHMS;
  if (n === 6 && d === 8) return SIX_EIGHT_RHYTHMS;
  if (n === 7 && d === 8) return SEVEN_EIGHT_RHYTHMS;
  if (n === 9 && d === 8) return NINE_EIGHT_RHYTHMS;
  if (n === 6 && d === 4) return SIX_FOUR_RHYTHMS;
  if (n === 7 && d === 4) return SEVEN_FOUR_RHYTHMS;
  if (n === 11 && d === 8) return ELEVEN_EIGHT_RHYTHMS;
  return null;
}

function pickRhythm(
  style: string,
  density?: number,
  recentIndices?: number[],
  timeSig?: [number, number],
): { rhythm: RhythmHit[]; index: number } {
  // Use odd-meter specific rhythms when applicable
  const oddMeterRhythms = timeSig ? getOddMeterRhythms(timeSig) : null;
  const isOddMeter = oddMeterRhythms !== null
    && !(timeSig![0] === 4 && timeSig![1] === 4)
    && !(timeSig![0] === 3 && timeSig![1] === 4 && style === "jazzWaltz");

  const STYLE_RHYTHMS: Record<string, RhythmHit[][]> = {
    swing: SWING_RHYTHMS,
    bossa: BOSSA_RHYTHMS,
    latin: LATIN_RHYTHMS,
    ballad: BALLAD_RHYTHMS,
    fusion: FUSION_RHYTHMS,
    ecm: ECM_RHYTHMS,
    hardBop: HARD_BOP_RHYTHMS,
    coolJazz: COOL_JAZZ_RHYTHMS,
    modal: MODAL_RHYTHMS,
    jazzWaltz: JAZZ_WALTZ_RHYTHMS,
    shuffleBlues: SHUFFLE_BLUES_RHYTHMS,
    neoSoul: NEO_SOUL_RHYTHMS,
    contemporaryJazz: CONTEMP_JAZZ_RHYTHMS,
    mathRock: MATH_ROCK_RHYTHMS,
    idm: IDM_RHYTHMS,
    holdsworth: HOLDSWORTH_RHYTHMS,
    alfaMist: ALFA_MIST_RHYTHMS,
    metheny: METHENY_RHYTHMS,
  };

  const patterns = isOddMeter ? oddMeterRhythms! : (STYLE_RHYTHMS[style] ?? SWING_RHYTHMS);

  // Density bias: prefer sparser patterns when density < 50, busier when > 50
  if (density !== undefined && patterns.length > 1) {
    const sorted = [...patterns].sort((a, b) => a.length - b.length);
    const idx = Math.floor((density / 100) * (sorted.length - 0.01));
    if (_rng() < 0.7) {
      const picked = sorted[Math.min(idx, sorted.length - 1)];
      return { rhythm: picked, index: patterns.indexOf(picked) };
    }
  }

  // Anti-repetition: weight down recently used patterns
  if (recentIndices && recentIndices.length > 0 && patterns.length > 2) {
    const weights = patterns.map((_, i) => {
      if (i === recentIndices[0]) return 0.25;
      if (recentIndices.length > 1 && i === recentIndices[1]) return 0.5;
      return 1.0;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = _rng() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return { rhythm: patterns[i], index: i };
    }
  }

  const idx = Math.floor(_rng() * patterns.length);
  return { rhythm: patterns[idx], index: idx };
}

function humanizeTime(time: number, enabled: boolean, style?: string, beatOffset?: number): number {
  if (!enabled) return time;
  const template = getGrooveTemplate(style ?? "swing");
  const isAnticipation = beatOffset !== undefined && beatOffset >= 3.5;
  const element = isAnticipation ? template.pianoAnticipation : template.piano;
  return applyGroove(time, element, _rng, _pianoEnergy, _pianoArc);
}

function humanizeVelocity(vel: number, enabled: boolean): number {
  if (!enabled) return Math.max(30, Math.min(127, vel));
  return Math.max(30, Math.min(127, vel + Math.floor((_rng() - 0.5) * 10)));
}

/** Expand multi-pitch CompNotes into staggered single-pitch notes.
 *  Simulates natural pianist finger roll - bottom note first.
 *  Non-uniform spacing: accelerating roll (faster at start, slower at end) mimics
 *  real finger mechanics. Exponent randomized slightly per chord for natural feel.
 *  Slight velocity taper: upper notes softer. */
function strumSpread(notes: CompNote[], totalMs: number): CompNote[] {
  const result: CompNote[] = [];
  for (const note of notes) {
    if (note.pitches.length <= 2) {
      result.push(note);
      continue;
    }
    const sorted = [...note.pitches].sort((a, b) => a - b);
    const n = sorted.length;
    const totalSec = totalMs / 1000;
    // Randomize exponent: 1.3-1.7 (accelerating roll, faster start, slower finish)
    const exponent = 1.3 + _rng() * 0.4;
    // Proportional velocity decay: cap total drop at ~15% of base velocity.
    const maxTotalDrop = Math.max(4, Math.round(note.velocity * 0.15));
    const maxPerStep = Math.max(1, Math.round(maxTotalDrop / Math.max(1, n - 1)));
    let velDrop = 0;
    for (let i = 0; i < n; i++) {
      const t = i === 0 ? 0 : Math.pow(i / (n - 1), exponent) * totalSec;
      result.push({
        pitches: [sorted[i]],
        time: note.time + t,
        duration: note.duration - t,
        velocity: Math.max(30, note.velocity - velDrop),
      });
      velDrop += 1 + Math.round(_rng() * (maxPerStep - 1));
    }
  }
  return result;
}

// ── Beat Position Metadata ──
// WeakMap tracks raw beat-in-bar for each note (set at creation, before humanization).
// Used by broken voicings to reliably detect strong beats without time-rounding errors.
const _noteBeat = new WeakMap<CompNote, number>();

// ── Broken Voicings ──

const BROKEN_VOICING_STYLES = new Set(["swing", "hardBop", "coolJazz", "neoSoul", "contemporaryJazz", "alfaMist", "holdsworth"]);

function applyBrokenVoicings(
  notes: CompNote[],
  style: string,
  beatDuration: number = 0.5,
  brokenProb: number = 0.20,
): CompNote[] {
  if (!BROKEN_VOICING_STYLES.has(style)) return notes;

  const result: CompNote[] = [];
  for (const note of notes) {
    // Skip non-4-note chords, 80% of chords, and beats near strong positions.
    // Tolerance 0.5 catches swing-displaced "ands" that land near beats 1/3
    // (e.g. rawBeatOffset 1.5 swings to ~1.9, perceptually on beat 2).
    const rawBeat = _noteBeat.get(note);
    const beatInMeasure = rawBeat !== undefined
      ? rawBeat % 4
      : (beatDuration > 0 ? (note.time / beatDuration) % 4 : 0);
    const nearStrongBeat = beatInMeasure <= 0.5 || beatInMeasure >= 3.5
      || Math.abs(beatInMeasure - 2) <= 0.5;
    if (note.pitches.length !== 4 || _rng() >= brokenProb || nearStrongBeat) {
      result.push(note);
      continue;
    }

    const sorted = [...note.pitches].sort((a, b) => a - b);
    // Broken voicing gap: 40-80ms (tight pianist chord break)
    const breakGap = 0.04 + _rng() * 0.04;

    // Skip broken voicing if second group would have no duration
    if (note.duration <= breakGap + 0.05) {
      result.push(note);
      continue;
    }

    // Group 1: bottom 2 notes on the beat
    result.push({
      pitches: [sorted[0], sorted[1]],
      time: note.time,
      duration: note.duration,
      velocity: note.velocity,
    });

    // Group 2: top 2 notes slightly after (broken chord, not full "and")
    result.push({
      pitches: [sorted[2], sorted[3]],
      time: note.time + breakGap,
      duration: Math.max(0.05, note.duration - breakGap),
      velocity: Math.max(40, note.velocity - 5),
    });
  }
  return result;
}

/** Infer time signature from measure duration and beat duration. */
function inferCompTimeSig(measureDuration: number, beatDuration: number): [number, number] {
  const beats = measureDuration / beatDuration;
  if (Math.abs(beats - 4) < 0.1) return [4, 4];
  if (Math.abs(beats - 3) < 0.1) return [3, 4];
  if (Math.abs(beats - 5) < 0.1) return [5, 4];
  if (Math.abs(beats - 6) < 0.1) return [6, 4];
  if (Math.abs(beats - 7) < 0.1) return [7, 4];
  if (Math.abs(beats - 3.5) < 0.1) return [7, 8];
  if (Math.abs(beats - 4.5) < 0.1) return [9, 8];
  if (Math.abs(beats - 5.5) < 0.1) return [11, 8];
  return [4, 4];
}

// ── Motif Evolution ──

/** Evolve a rhythm pattern on repeat bars. Real pianists don't copy patterns exactly -
 *  they displace, fragment, merge, and reshape motifs. Creativity parameter weights
 *  conservative mutations (drop/extend) vs adventurous ones (displacement/fragmentation).
 *  `barsLeft` controls drift magnitude: early repeats stay close, later ones diverge. */
function evolveMotif(
  base: RhythmHit[],
  barsLeft: number,
  creativity: number,
  rng: () => number,
): RhythmHit[] {
  if (creativity < 0.05 || rng() > 0.3 + creativity * 0.5) return base;

  const evolved = base.map(([beat, dur]) => [beat, dur] as RhythmHit);
  const idx = Math.floor(rng() * evolved.length);
  // More mutations accumulate as bars progress (barsLeft decreases)
  const driftFactor = Math.max(0.5, 1.0 - barsLeft * 0.15);

  const mutation = rng();
  if (mutation < 0.15 && evolved.length > 1) {
    // Drop a hit (creates space)
    evolved.splice(idx, 1);
  } else if (mutation < 0.30) {
    // Shift timing slightly (±0.25 beats, scaled by drift)
    const shift = (rng() - 0.5) * 0.5 * driftFactor;
    evolved[idx] = [Math.max(0, Math.min(3.75, evolved[idx][0] + shift)), evolved[idx][1]];
  } else if (mutation < 0.40) {
    // Extend or shorten duration
    const scale = 0.7 + rng() * 0.6;
    evolved[idx] = [evolved[idx][0], Math.max(0.05, evolved[idx][1] * scale)];
  } else if (mutation < 0.50 && evolved.length < 4) {
    // Add a ghost hit
    const ghostBeat = rng() * 3.5;
    evolved.push([ghostBeat, 0.4]);
    evolved.sort((a, b) => a[0] - b[0]);
  } else if (mutation < 0.60 && creativity > 0.3) {
    // Rhythmic displacement: shift entire pattern by 8th or 16th note
    const displace = rng() < 0.5 ? 0.5 : 0.25;
    const dir = rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < evolved.length; i++) {
      const newBeat = evolved[i][0] + displace * dir;
      if (newBeat >= 0 && newBeat <= 3.75) {
        evolved[i] = [newBeat, evolved[i][1]];
      }
    }
  } else if (mutation < 0.70 && creativity > 0.35 && evolved.length >= 3) {
    // Fragmentation: use only first half of pattern (truncate)
    const halfLen = Math.max(1, Math.ceil(evolved.length / 2));
    evolved.splice(halfLen);
  } else if (mutation < 0.80 && creativity > 0.3 && evolved.length >= 2) {
    // Extension: repeat last hit with slight offset
    const last = evolved[evolved.length - 1];
    const ext: RhythmHit = [Math.min(3.75, last[0] + 0.5 + rng() * 0.25), last[1] * 0.8];
    evolved.push(ext);
  } else if (mutation < 0.90 && creativity > 0.4 && evolved.length >= 2) {
    // Density mutation: split one long note into two short ones
    if (evolved[idx][1] > 0.6) {
      const halfDur = evolved[idx][1] * 0.45;
      const beat2 = Math.min(3.75, evolved[idx][0] + halfDur + 0.1);
      evolved[idx] = [evolved[idx][0], halfDur];
      evolved.splice(idx + 1, 0, [beat2, halfDur]);
    }
  } else if (evolved.length >= 3) {
    // Density mutation: merge two adjacent short notes into one longer note
    const mergeIdx = Math.min(idx, evolved.length - 2);
    const merged: RhythmHit = [evolved[mergeIdx][0], evolved[mergeIdx][1] + evolved[mergeIdx + 1][1]];
    evolved.splice(mergeIdx, 2, merged);
  }

  return evolved;
}

// ── Main Generator ──

/**
 * Generate piano comping from chord events.
 * Returns array of CompNote (chord voicings with timing).
 */
export function generatePianoComping(
  chords: ChordEvent[],
  options: PianoCompingOptions = {},
): CompNote[] {
  if (chords.length === 0) return [];
  const prevRng = _rng;
  const prevGranular = _pianoGranular;
  const prevEnergy = _pianoEnergy;
  const prevArc = _pianoArc;
  _rng = options.random ?? Math.random;
  _pianoGranular = options.granular;

  // Sync voicing engine state with current register and rng
  const savedVoicing = initVoicingState(getPianoLow(), getPianoHigh(), _rng);

  const style = options.style ?? "swing";
  const tempo = options.tempo ?? 120;
  if (tempo <= 0) { restoreVoicingState(savedVoicing); _rng = prevRng; _pianoGranular = prevGranular; _pianoEnergy = prevEnergy; _pianoArc = prevArc; throw new RangeError(`tempo must be > 0, got ${tempo}`); }
  try {
  const humanize = options.humanize ?? true;
  const density = options.density;
  const swingAmount = options.swingAmount ?? 100;
  const strumMs = options.strumMs ?? 20;
  const doStrum = strumMs > 0 && options.strum !== false;
  const beatDuration = 60 / tempo;

  const velScale = style === "ecm" ? 0.88
    : style === "coolJazz" ? 0.85
    : style === "hardBop" ? 1.1
    : style === "fusion" ? 0.9
    : style === "neoSoul" || style === "contemporaryJazz" ? 0.85
    : style === "idm" ? 0.7
    : style === "holdsworth" ? 0.85
    : style === "metheny" ? 0.78
    : style === "alfaMist" ? 0.80
    : 1.0;

  const bandCtx = options.bandContext;
  const pianoGranular = options.granular;
  // voicingDensity: low → shell voicings (2-note), high → full voicings (4-note)
  // At fast tempos (>220), force shell voicings - dense chords blur at speed
  // Fast harmonic rhythm (>=3 chords/bar): force shells - too many dense voicings = clutter
  const voicingThreshold = pianoGranular ? pianoGranular.voicingDensity : 50;
  const hrForceShell = (bandCtx?.harmonicRhythm ?? 1) >= 3;
  const forceShell = tempo > 220 || hrForceShell;
  // Probabilistic shell: lower voicingDensity = more shell voicings
  const shellChance = forceShell ? 1.0
    : voicingThreshold < 25 ? 0.7
    : voicingThreshold < 50 ? 0.3
    : voicingThreshold < 75 ? 0.1
    : voicingThreshold < 95 ? 0.03
    : 0;
  const drumDensityRestBoost = bandCtx && bandCtx.drumDensity > 0.6
    ? 0.08 * bandCtx.drumDensity : 0;
  // Increase rests at fast tempos: uptempo comping should be sparse
  const tempoRestBoost = tempo > 200 ? Math.min(0.20, (tempo - 200) / 500) : 0;
  const baseRestChance = 0.15 * (1 - (density ?? 50) / 100) + drumDensityRestBoost + tempoRestBoost;
  const notes: CompNote[] = [];
  let prevPitches: number[] | null = null;
  let wasRest = false;
  const recentRhythmIndices: number[] = [];

  // ── Register Drift State ──
  // Tracks an octave offset that shifts up during builds/climaxes and down during releases/drops.
  // Real pianists move register for narrative — low for intimate, high for energy.
  let registerShift = 0; // semitones to add to voicings (multiples of 12)
  const voicingTypeRef: [number] = [-1]; // mutable ref for voicing variety tracking

  // ── Musicality Parameters ──
  // Only active in ensemble mode (bandContext provided). Standalone calls get safe defaults.
  const creativity = bandCtx ? (bandCtx.creativity ?? 35) / 100 : 0;
  const conversation = bandCtx ? (bandCtx.conversation ?? 30) / 100 : 0;
  const harmonicFreedom = bandCtx ? (bandCtx.harmonicFreedom ?? 25) / 100 : 0;
  const intent = bandCtx?.currentPhraseIntent ?? null;

  // ── Motif Memory (all styles, not just alfaMist) ──
  // Holds same rhythm pattern for multiple bars. Creates compositional coherence.
  // alfaMist: hip-hop loop mentality. metheny: sustained concept. holdsworth: conversational development.
  let loopRhythm: RhythmHit[] | null = null;
  let loopBarsLeft = 0;
  // Base lock duration from intent, fallback to style-based defaults
  const motifLockBase = intent?.motifLockBars ??
    (style === "metheny" || style === "ecm" ? 4
    : style === "alfaMist" ? 3
    : style === "holdsworth" ? 2
    : style === "fusion" ? 2
    : creativity < 0.3 ? 3 : 2);

  // ── Harmonic Anticipation State ──
  // Probability of playing next chord voicing on beat 4-and, creating forward motion.
  // anticipation granular (0-100) maps directly to probability; falls back to harmonicFreedom
  const anticipationProb = intent?.anticipationChance
    ?? (pianoGranular ? pianoGranular.anticipation / 100 : harmonicFreedom * 0.35);
  // Passing chord probability: insert chromatic approach chord between changes
  const passingChordProb = intent?.passingChordChance ?? harmonicFreedom * 0.25;

  const inferredTimeSig: [number, number] | undefined = chords.length > 0
    ? inferCompTimeSig(chords[0].duration, beatDuration)
    : undefined;

  // Measure duration for phrase intent lookups
  const measureDuration = options.measureInfo?.measureDuration ?? (chords.length > 0 ? chords[0].duration : beatDuration * 4);

  // ── Velocity Contour ──
  // Per-beat velocity shape within a bar. Real pianists don't play binary loud/soft —
  // they create a dynamic curve. Beat 1 accented, mid-bar lighter, beat 3 lifts, beat 4 falls.
  const velContour = (beatPos: number, beatsPerBar: number): number => {
    if (beatsPerBar <= 0) return 78;
    const pct = beatPos / beatsPerBar;
    // Accent beat 1, dip mid-bar, slight lift beat 3 area, taper at end
    // Base curve: 85 → 68 → 75 → 65 (in 4/4), with ±6 humanized jitter
    const base = 85 - 20 * Math.sin(pct * Math.PI) + 10 * Math.sin(pct * 2 * Math.PI);
    const jitter = (_rng() - 0.5) * 12; // ±6 velocity
    return Math.round(base + jitter);
  };
  const beatsPerBar = inferredTimeSig ? inferredTimeSig[0] : 4;

  for (let ci = 0; ci < chords.length; ci++) {
    const chord = chords[ci];
    const nextChord = ci + 1 < chords.length ? chords[ci + 1] : null;

    // ── Phrase Intent: Air Gap / Rest Decisions ──
    const measureIdx = Math.floor(chord.time / measureDuration);
    const phraseIntent = bandCtx?.phraseMap
      ? getPhraseIntentForMeasure(measureIdx, bandCtx.phraseMap)
      : intent;

    // Update module-level groove evolution state for humanizeTime
    _pianoEnergy = bandCtx?.sectionEnergy ?? 0.7;
    _pianoArc = (phraseIntent?.arc as import("./types").PhraseArc) ?? null;

    // Intent-driven rest: if this measure is in pianoRests, skip it
    if (phraseIntent?.pianoRests?.includes(measureIdx)) {
      wasRest = true;
      continue;
    }

    // Intent-driven drop: play very softly with minimal voicing
    const isDrop = phraseIntent?.dropMeasures?.includes(measureIdx) ?? false;

    // ── Conversation Awareness ──
    // When another instrument is the "leader", piano lays back (sparser, softer).
    // When piano is the leader, play more actively.
    const isLeader = phraseIntent?.conversationLeader === "piano";
    const isListening = phraseIntent?.conversationLeader != null && !isLeader;
    // Scale effect with conversation parameter: low conversation = instruments play independently,
    // high conversation = dramatic leader/listener contrast
    const conversationDensityMult = isLeader ? 1 + 0.3 * conversation : isListening ? 1 - 0.5 * conversation : 1.0;

    // Form-aware density
    const formPct = chords.length > 1 ? ci / chords.length : 0.5;
    const formDensityMult = formPct < 0.15 ? 0.6
      : formPct < 0.50 ? 0.8
      : formPct < 0.80 ? 1.0
      : 0.9;

    // Crescendo boost within phrase
    const crescendoMult = phraseIntent?.crescendo ? (0.85 + formPct * 0.2) : 1.0;

    // Feel changes: double-time = fewer rests (busier), half-time = more rests (spacious)
    const pianoFeel = phraseIntent?.feel ?? "normal";
    const feelRestMult = pianoFeel === "doubleTime" ? 0.5 : pianoFeel === "halfTime" ? 2.0 : 1.0;

    const restChance = (baseRestChance / formDensityMult) / conversationDensityMult * feelRestMult;

    // Rest bar: skip chord (never first, never last, never consecutive)
    const isLast = ci === chords.length - 1;
    if (ci > 0 && !isLast && !wasRest && _rng() < restChance) {
      wasRest = true;
      continue;
    }
    wasRest = false;

    // ── ii-V-I Awareness ──
    // On V-I resolutions, bias voicing toward altered tones for tension.
    // Uses harmonic analysis when available, falls back to ad-hoc detection.
    const isResolving = chord.analysis
      ? (chord.analysis.isPartOfIiVI && chord.analysis.iiViPosition === "V")
        || (chord.analysis.function === "dominant" && chord.analysis.cadenceType === "authentic")
        || chord.analysis.isSecondaryDominant
      : !!(nextChord && isDominantQuality(chord.quality)
        && isResolvingDominant(chord.root, nextChord.root));

    // Pre-roll shell decision once per chord - anticipation/passing use same density
    const chordShell = _rng() < shellChance;
    const pitches = pickVoicing(chord.root, chord.quality, prevPitches, style, chordShell, voicingTypeRef, isResolving);
    prevPitches = pitches;

    // ── Register Drift ──
    // Shift voicings up during builds/climaxes, down during releases/drops.
    // registerRange (0-100) scales max drift: 0=no shift, 50=±12, 100=±24 semitones
    const maxRegShift = pianoGranular ? Math.round(pianoGranular.registerRange / 100 * 24) : 24;
    const regDriftProb = pianoGranular ? 0.1 + (pianoGranular.registerRange / 100) * 0.3 : 0.3;
    const arc = phraseIntent?.arc;
    if (arc === "build" || arc === "climax" || arc === "shout" || arc === "solo") {
      if (registerShift < maxRegShift) registerShift += (_rng() < regDriftProb ? 12 : 0);
    } else if (arc === "release" || arc === "drop" || arc === "outro" || arc === "breakdown") {
      if (registerShift > -maxRegShift) registerShift -= (_rng() < regDriftProb ? 12 : 0);
    } else {
      // Sustain: drift back toward center
      if (registerShift > 0 && _rng() < 0.2) registerShift -= 12;
      if (registerShift < 0 && _rng() < 0.2) registerShift += 12;
    }

    // ── Motif Memory: Rhythm Selection ──
    // All styles now benefit from motif lock — holds pattern for N bars.
    // Creates the "composed" feel that separates algorithmic from musical.
    let rhythm: RhythmHit[];
    if (loopBarsLeft > 0 && loopRhythm) {
      // Motif evolution: on repeat bars, slightly modify pattern instead of exact copy.
      // A human pianist evolves a motif — adds a ghost hit, shifts timing, drops a note.
      rhythm = evolveMotif(loopRhythm, loopBarsLeft, creativity, _rng);
      loopBarsLeft--;
    } else {
      // rhythmicActivity overrides density for rhythm pattern selection
      // At fast tempos (>200), cap effective density to prefer sparser patterns
      const tempoDensityCap = tempo > 200 ? Math.max(20, 100 - (tempo - 200) * 0.5) : 100;
      const rawRhythmDensity = pianoGranular ? pianoGranular.rhythmicActivity : density;
      const rhythmDensity = rawRhythmDensity !== undefined ? Math.min(rawRhythmDensity, tempoDensityCap) : Math.min(50, tempoDensityCap);
      const picked = pickRhythm(style, rhythmDensity, recentRhythmIndices, inferredTimeSig);
      rhythm = picked.rhythm;
      recentRhythmIndices.unshift(picked.index);
      if (recentRhythmIndices.length > 2) recentRhythmIndices.pop();
      loopRhythm = rhythm;
      // Lock duration: base + random variation. Higher creativity = more variation.
      loopBarsLeft = Math.max(0, motifLockBase - 1 + Math.floor(_rng() * 2));
    }

    // ── Drop Measure: Minimal Voicing ──
    // During drops, play just a sustained shell voicing (2 notes, very soft)
    if (isDrop) {
      const shellPitches = toShellVoicing(pitches);
      notes.push({
        pitches: [...shellPitches],
        time: humanizeTime(chord.time, humanize, style, 0),
        duration: chord.duration * 0.9,
        velocity: humanizeVelocity(Math.round(45 * velScale), humanize),
      });
      continue;
    }

    // Tension-modulated anticipation: boost when current chord has high tension
    // (dominant wanting to resolve) and next chord is a resolution
    const chordTension = chord.analysis?.tension ?? 0.5;
    const tensionAnticipBoost = chordTension > 0.6 ? 1.0 + (chordTension - 0.6) * 1.5 : 1.0;
    const effectiveAnticipProb = Math.min(0.6, anticipationProb * tensionAnticipBoost);

    for (const [rawBeatOffset, durMult] of rhythm) {
      // ── Harmonic Anticipation ──
      // On beat 3.5+, possibly play NEXT chord's voicing (creates forward pull).
      // Controlled by harmonicFreedom parameter, boosted by harmonic tension.
      let usePitches = pitches;
      if (rawBeatOffset >= 3.5 && nextChord) {
        // Original behavior + enhanced by harmonicFreedom
        usePitches = pickVoicing(nextChord.root, nextChord.quality, prevPitches, style, chordShell, voicingTypeRef);
      } else if (rawBeatOffset >= 3.0 && rawBeatOffset < 3.5 && nextChord && _rng() < effectiveAnticipProb) {
        // Early anticipation on beat 3-and (harmonicFreedom + tension-controlled)
        // Creates forward motion - piano "hears" the next chord before it arrives.
        usePitches = pickVoicing(nextChord.root, nextChord.quality, prevPitches, style, chordShell, voicingTypeRef);
      }

      // ── Passing Chord Insertion ──
      // Between current and next chord, insert a chromatic approach voicing.
      // Creates movement and harmonic interest. Controlled by harmonicFreedom.
      if (rawBeatOffset >= 2.5 && rawBeatOffset < 3.0 && nextChord && _rng() < passingChordProb) {
        // Chromatic approach: voice the chord a half-step above next root
        const passingRoot = chromaticApproachRoot(nextChord.root, _rng() < 0.5);
        const passingPitches = pickVoicing(passingRoot, nextChord.quality, prevPitches, style, chordShell, voicingTypeRef);
        const passingTime = chord.time + rawBeatOffset * beatDuration;
        if (passingTime < chord.time + chord.duration) {
          const pn: CompNote = {
            pitches: [...passingPitches],
            time: humanizeTime(passingTime, humanize, style, rawBeatOffset),
            duration: beatDuration * 0.4,
            velocity: humanizeVelocity(Math.round(60 * velScale), humanize),
          };
          _noteBeat.set(pn, rawBeatOffset);
          notes.push(pn);
        }
        continue; // passing chord replaces normal hit at this position
      }

      // Apply swing
      let beatOffset = rawBeatOffset;
      const frac = beatOffset % 1;
      if (Math.abs(frac - 0.5) < 0.01) {
        const effectiveSwing = swingAmount * tempoSwingMultiplier(tempo, bandCtx?.sectionEnergy) * instrumentSwingFactor("piano");
        const swingOffset = (effectiveSwing / 100) * (2 / 3 - 0.5);
        beatOffset = Math.floor(beatOffset) + 0.5 + swingOffset;
      }
      const time = chord.time + beatOffset * beatDuration;
      if (time >= chord.time + chord.duration) break;

      const duration = Math.min(
        durMult * beatDuration,
        chord.time + chord.duration - time,
      );

      const dynMult = options.measureInfo
        ? dynamicMultiplier(Math.floor(chord.time / (options.measureInfo.measureDuration || 1)), options.measureInfo.totalMeasures, style, options.measureInfo.sections)
        : 1.0;
      const hasSectionDynamics = options.measureInfo?.sections && options.measureInfo.sections.length > 0;
      const energyMult = (bandCtx && !hasSectionDynamics) ? (0.7 + bandCtx.sectionEnergy * 0.3) : 1.0;

      // Conversation velocity adjustment
      const convVelMult = isListening ? 1 - 0.3 * conversation : isLeader ? 1 + 0.1 * conversation : 1.0;
      const contourVel = velContour(rawBeatOffset, beatsPerBar);
      const baseVel = Math.max(48, Math.round(contourVel * velScale * dynMult * energyMult * convVelMult * crescendoMult));

      // Apply register drift + bass collision avoidance
      let finalPitches = registerShift !== 0
        ? [...new Set(usePitches.map(p => {
            let shifted = p + registerShift;
            while (shifted > getPianoHigh()) shifted -= 12;
            while (shifted < getPianoLow()) shifted += 12;
            return shifted;
          }))]
        : usePitches;
      // Bass-piano collision avoidance: shift piano voicing away from bass register.
      // When bass is high, push piano up. When bass is mid, prefer upper register.
      // Prevents frequency masking where bass and piano double in same octave.
      if (bandCtx?.bassRegister === "high") {
        const lowestPitch = Math.min(...finalPitches);
        if (lowestPitch < 62) {
          finalPitches = finalPitches.map(p => {
            const shifted = p + 12;
            return shifted > getPianoHigh() ? p : shifted;
          });
        }
      } else if (bandCtx?.bassRegister === "mid") {
        const lowestPitch = Math.min(...finalPitches);
        if (lowestPitch < 55 && lowestPitch + 12 <= getPianoHigh()) {
          finalPitches = finalPitches.map(p => p + 12);
        }
      }
      const n: CompNote = {
        pitches: [...finalPitches],
        time: Math.max(0, humanizeTime(time, humanize, style, rawBeatOffset) + rubatoOffset(style ?? "swing", rawBeatOffset, beatsPerBar, _pianoArc)),
        duration: duration * 0.95,
        velocity: humanizeVelocity(baseVel, humanize),
      };
      _noteBeat.set(n, rawBeatOffset);
      notes.push(n);
    }
  }

  const broken = applyBrokenVoicings(notes, style, beatDuration);

  // Grace notes: alfaMist always, others based on creativity
  const graceProb = style === "alfaMist" ? 0.20
    : style === "holdsworth" ? creativity * 0.12
    : style === "metheny" ? creativity * 0.08
    : style === "neoSoul" ? creativity * 0.15
    : creativity > 0.5 ? creativity * 0.10
    : 0;
  const graced = graceProb > 0 ? applyGraceNotes(broken, graceProb) : broken;

  graced.sort((a, b) => a.time - b.time);
  return doStrum ? strumSpread(graced, strumMs) : graced;
  } finally {
    restoreVoicingState(savedVoicing);
    _rng = prevRng;
    _pianoGranular = prevGranular;
    _pianoEnergy = prevEnergy;
    _pianoArc = prevArc;
  }
}

// ── Phrase Intent Lookup (piano-side) ──
function getPhraseIntentForMeasure(measure: number, phraseMap: { boundaries: number[]; intents?: Array<{ pianoRests: number[]; dropMeasures: number[]; conversationLeader: string | null; crescendo: boolean; anticipationChance: number; passingChordChance: number; motifLockBars: number; arc: string; feel?: string }> }): { pianoRests: number[]; dropMeasures: number[]; conversationLeader: string | null; crescendo: boolean; anticipationChance: number; passingChordChance: number; motifLockBars: number; arc: string; feel?: string } | null {
  if (!phraseMap.intents || phraseMap.intents.length === 0) return null;
  for (let i = phraseMap.boundaries.length - 1; i >= 0; i--) {
    if (measure >= phraseMap.boundaries[i]) {
      return phraseMap.intents[i] ?? null;
    }
  }
  return null;
}

// ── Chromatic Approach Root ──
// Returns root name a half-step above or below target root.
function chromaticApproachRoot(targetRoot: string, fromAbove: boolean): string {
  const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const idx = ROOTS.indexOf(targetRoot);
  if (idx < 0) return targetRoot;
  const offset = fromAbove ? 1 : -1;
  return ROOTS[(idx + offset + 12) % 12];
}

/**
 * Add grace notes: quick half-step-below approach before a chord note.
 * Targets inner voicing tones (3rd/7th position) — not all notes.
 * Grace = single pitch ~30ms before main note, low velocity.
 */
function applyGraceNotes(notes: CompNote[], probability: number): CompNote[] {
  const result: CompNote[] = [];
  for (const note of notes) {
    if (note.pitches.length < 3 || _rng() >= probability) {
      result.push(note);
      continue;
    }
    // Pick an inner tone (not lowest, not highest) to approach from below
    const sorted = [...note.pitches].sort((a, b) => a - b);
    const innerIdx = 1 + Math.floor(_rng() * (sorted.length - 2));
    const target = sorted[innerIdx];
    const gracePitch = target - 1; // half-step below

    if (gracePitch >= getPianoLow() && note.time >= 0.030) {
      // Insert grace note 30ms before main note (skip if too close to time 0)
      result.push({
        pitches: [gracePitch],
        time: note.time - 0.030,
        duration: 0.025,
        velocity: Math.max(40, note.velocity - 15),
      });
    }
    result.push(note);
  }
  return result;
}
