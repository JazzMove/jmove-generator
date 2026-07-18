/** Stochastic drum comping and humanization. Extracted from drumPatterns.ts for G29. */

import { getGrooveTemplate, applyGroove, drumPitchToElement } from "./grooveTemplates";
import type { DrumHit, DrumGranular, PhraseArc } from "./types";
import {
  GM_DRUMS,
  MICRO_VARIATION_STYLES,
  type PatternHit,
  type StochasticTable,
  type CompingTendency,
} from "./drumPatternData";

export function pickTendency(table: StochasticTable, rng: () => number = Math.random): CompingTendency {
  const positions = Object.keys(table.slots);
  const count = 2 + Math.floor(rng() * 2); // 2-3 favored positions
  // Fisher-Yates shuffle: deterministic rng consumption (exactly positions.length - 1 calls)
  // unlike sort(() => rng() - 0.5) which varies by engine's sort algorithm.
  const shuffled = [...positions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    favored: shuffled.slice(0, count),
    barsRemaining: 2 + Math.floor(rng() * 3), // 2-4 bars
  };
}

export function generateStochasticComping(
  table: StochasticTable,
  density: number,
  tendency: CompingTendency,
  rng: () => number = Math.random,
  tomScale: number = 1,
): PatternHit[] {
  const densityScale = 0.5 + (density / 100) * 1.0;
  const hits: PatternHit[] = [];
  const TOM_PITCHES: Set<number> = new Set([GM_DRUMS.TOM_HIGH, GM_DRUMS.TOM_MID, GM_DRUMS.TOM_LOW, GM_DRUMS.TOM_FLOOR]);

  for (const [beatStr, slots] of Object.entries(table.slots)) {
    const beat = parseFloat(beatStr);
    for (const slot of slots) {
      const tendencyBoost = tendency.favored.includes(beatStr) ? 2.0 : 1.0;
      const isTom = TOM_PITCHES.has(slot.drum);
      const tomMult = isTom ? tomScale : 1;
      const adjustedProb = Math.min(1.0, slot.probability * densityScale * tendencyBoost * tomMult);
      if (rng() < adjustedProb) {
        hits.push({ drum: slot.drum, beat, velocity: slot.velocity, ghost: slot.ghost });
      }
    }
  }

  // Enforce minHits: add kick on beat 1 if too sparse
  if (hits.length < table.minHits && !hits.some(h => h.beat === 0)) {
    hits.push({ drum: GM_DRUMS.KICK, beat: 0, velocity: 55 });
  }

  // Enforce maxHits: remove lowest-priority hits (ghosts first, then quietest)
  while (hits.length > table.maxHits) {
    hits.sort((a, b) => {
      const ghostA = a.ghost ? 0 : 1;
      const ghostB = b.ghost ? 0 : 1;
      return ghostA - ghostB || a.velocity - b.velocity;
    });
    hits.shift();
  }

  // Snare guarantee: no drummer leaves snare silent for an entire bar (unless drumsMinimal).
  // Runs AFTER maxHits pruning so it can't be removed by the limiter.
  if (!hits.some(h => h.drum === GM_DRUMS.SNARE || h.drum === GM_DRUMS.CROSS_STICK)) {
    const snareBeats = Object.entries(table.slots)
      .filter(([, s]) => s.some(x => x.drum === GM_DRUMS.SNARE))
      .map(([b]) => parseFloat(b));
    if (snareBeats.length > 0) {
      const beat = snareBeats[Math.floor(rng() * snareBeats.length)];
      hits.push({ drum: GM_DRUMS.SNARE, beat, velocity: 30, ghost: true });
    }
  }

  return hits;
}

// ── Helpers ──

export function humanizeTime(time: number, enabled: boolean, style?: string, drumPitch?: number, random?: () => number, energy?: number, arc?: PhraseArc | null): number {
  if (!enabled) return time;
  const template = getGrooveTemplate(style ?? "swing");
  const elementKey = drumPitch !== undefined ? drumPitchToElement(drumPitch) : "ride" as const;
  const element = template[elementKey];
  return applyGroove(time, element, random, energy, arc);
}

export function humanizeVelocity(vel: number, ghost: boolean, enabled: boolean, random?: () => number): number {
  const rng = random ?? Math.random;
  if (ghost) return Math.max(35, Math.min(50, vel + (enabled ? Math.floor((rng() - 0.5) * 10) : 0)));
  if (!enabled) return Math.max(35, Math.min(127, vel));
  return Math.max(35, Math.min(127, vel + Math.floor((rng() - 0.5) * 12)));
}

// ── Beat-to-Beat Micro-Variation ──

// alfaMist excluded: hand-crafted patterns already have dense ghost work
// (sextuplet ghosts, flams, ghost cascades). Extra random ghosts = chaotic layering.
// holdsworth excluded: stochastic table already embeds rich ghost/tom comping —
// micro-variation doubles ghosting and causes density overload.

export function applyMicroVariation(
  hits: DrumHit[],
  measureStart: number,
  beatDuration: number,
  beatsPerMeasure: number,
  style: string,
  density: number,
  humanize: boolean,
  random?: () => number,
  granular?: DrumGranular,
): void {
  const rng = random ?? Math.random;
  if (!MICRO_VARIATION_STYLES.has(style)) return;
  if (density < 30) return;

  // Ghost kick on beat 3 (~15%)
  if (rng() < 0.15 && beatsPerMeasure >= 4) {
    const time = measureStart + 2 * beatDuration;
    const hasKick = hits.some(h => h.pitch === GM_DRUMS.KICK && Math.abs(h.time - time) < beatDuration * 0.1);
    if (!hasKick) {
      hits.push({
        pitch: GM_DRUMS.KICK,
        time: humanizeTime(time, humanize, undefined, undefined, rng),
        duration: 0.08,
        velocity: humanizeVelocity(45, true, humanize, rng),
      });
    }
  }

  // Snare ghost on random "and" (~10%)
  if (rng() < 0.10) {
    const beat = Math.floor(rng() * Math.min(beatsPerMeasure, 4));
    const time = measureStart + (beat + 0.5) * beatDuration;
    const hasSnare = hits.some(h => h.pitch === GM_DRUMS.SNARE && Math.abs(h.time - time) < beatDuration * 0.2);
    if (!hasSnare) {
      hits.push({
        pitch: GM_DRUMS.SNARE,
        time: humanizeTime(time, humanize, undefined, undefined, rng),
        duration: 0.08,
        velocity: humanizeVelocity(35, true, humanize, rng),
      });
    }
  }

  // Hi-hat open splash on "and" of 2 or 4 (~8%)
  if (rng() < 0.08 && beatsPerMeasure >= 4) {
    const beat = rng() < 0.5 ? 1 : 3;
    const time = measureStart + (beat + 0.5) * beatDuration;
    hits.push({
      pitch: GM_DRUMS.HI_HAT_OPEN,
      time: humanizeTime(time, humanize, undefined, undefined, rng),
      duration: 0.08,
      velocity: humanizeVelocity(55, false, humanize, rng),
    });
  }

  // Tom ghost on random offbeat (~8% base, scaled by tomFrequency) — adds melodic color between kick/snare
  // Excluded from swing/coolJazz (too sparse), modal (minimal), jazzWaltz (3/4 too tight)
  const TOM_MICRO_EXCLUDED = ["swing", "coolJazz", "modal", "jazzWaltz"];
  const tomMicroProb = 0.08 * (granular ? granular.tomFrequency / 40 : 1);
  if (rng() < tomMicroProb && !TOM_MICRO_EXCLUDED.includes(style) && beatsPerMeasure >= 4) {
    const tomPitches = [GM_DRUMS.TOM_HIGH, GM_DRUMS.TOM_MID];
    const tomPitch = tomPitches[Math.floor(rng() * tomPitches.length)];
    const beat = Math.floor(rng() * Math.min(beatsPerMeasure, 4));
    const offset = rng() < 0.5 ? 0.25 : 0.75; // 16th-note offbeat positions
    const time = measureStart + (beat + offset) * beatDuration;
    const hasTom = hits.some(h =>
      (h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID ||
       h.pitch === GM_DRUMS.TOM_LOW || h.pitch === GM_DRUMS.TOM_FLOOR) &&
      Math.abs(h.time - time) < beatDuration * 0.2);
    if (!hasTom) {
      hits.push({
        pitch: tomPitch,
        time: humanizeTime(time, humanize, undefined, undefined, rng),
        duration: 0.08,
        velocity: humanizeVelocity(42, true, humanize, rng),
      });
    }
  }
}
