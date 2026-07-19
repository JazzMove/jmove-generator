/** Bass state management, constants, helpers, and pattern data. Extracted from walkingBass.ts for G29. */

import { enclosureProb as enclosureProbFn } from "./probabilityMapping";
import { getChordIntervals, getQualityScale } from "./chordQuality";
import type { BassGranular, PhraseArc } from "./types";

// ── Module-level PRNG ──
// Set by walkingBass.ts before each generation call.
// ES module live bindings allow importers to read current values.
export let _rng: () => number = Math.random;
export let _bassGranular: BassGranular | undefined;
export let _harmonicRhythm: number = 1;
export let _bassEnergy: number = 0.7;
export let _bassTargetPitch: number | undefined;

// ── Approach tone history for anti-repetition ──
export type ApproachRecord = { fromAbove: boolean; interval: number };
export let _approachHistory: ApproachRecord[] = [];

export interface SavedBassState {
  rng: () => number;
  granular: BassGranular | undefined;
  history: ApproachRecord[];
  hr: number;
  energy: number;
  target: number | undefined;
}

export function initBassState(
  rng: () => number,
  granular: BassGranular | undefined,
  harmonicRhythm: number,
  energy: number,
): SavedBassState {
  const saved: SavedBassState = {
    rng: _rng, granular: _bassGranular, history: _approachHistory,
    hr: _harmonicRhythm, energy: _bassEnergy, target: _bassTargetPitch,
  };
  _rng = rng;
  _bassGranular = granular;
  _harmonicRhythm = harmonicRhythm;
  _bassEnergy = energy;
  _bassTargetPitch = undefined;
  _approachHistory = [];
  return saved;
}

export function restoreBassState(saved: SavedBassState): void {
  _rng = saved.rng;
  _bassGranular = saved.granular;
  _approachHistory = saved.history;
  _harmonicRhythm = saved.hr;
  _bassEnergy = saved.energy;
  _bassTargetPitch = saved.target;
}

/** Set bass target pitch (called from walkingBass per-chord for phrase arc). */
export function setBassTargetPitch(target: number | undefined): void {
  _bassTargetPitch = target;
}

/** Set bass energy (called from walkingBass per-chord for groove modulation). */
export function setBassEnergy(energy: number): void {
  _bassEnergy = energy;
}

// ── Constants ──

export const BASS_LOW_DEFAULT = 28;  // E1
export const BASS_HIGH_DEFAULT = 55; // G3

export const ROOT_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

// registerWidth (0-100) narrows/widens playable range around midpoint (MIDI 41 = F2)
// 0 → ±6 semitones (MIDI 35-47), 100 → full range (MIDI 28-55)
// bassRegister (0-100) shifts center ±5 semitones (perfect fourth)
// 0 = low (B0-D3), 50 = default (E1-G3), 100 = high (A1-C4)
export function getBassLow(): number {
  if (!_bassGranular) return BASS_LOW_DEFAULT;
  const t = _bassGranular.registerWidth / 100;
  const widthLow = Math.round(BASS_LOW_DEFAULT + (1 - t) * 7);
  const reg = _bassGranular.bassRegister ?? 50;
  const regShift = Math.round((reg - 50) / 50 * 5);
  return widthLow + regShift;
}

export function getBassHigh(): number {
  if (!_bassGranular) return BASS_HIGH_DEFAULT;
  const t = _bassGranular.registerWidth / 100;
  const widthHigh = Math.round(BASS_HIGH_DEFAULT - (1 - t) * 8);
  const reg = _bassGranular.bassRegister ?? 50;
  const regShift = Math.round((reg - 50) / 50 * 5);
  return widthHigh + regShift;
}

// ── Helpers ──

export function rootToMidi(root: string): number {
  const semitones = ROOT_SEMITONES[root];
  if (semitones === undefined) return 48;
  let midi = 36 + semitones;
  if (midi < getBassLow()) midi += 12;
  if (midi > getBassHigh()) midi -= 12;
  return midi;
}

/** Get chord tones in MIDI range for given root + quality. */
export function getChordTones(root: string, quality: string): number[] {
  const rootMidi = rootToMidi(root);
  const intervals = getChordIntervals(quality);

  const tones: number[] = [];
  for (const interval of intervals) {
    let pitch = rootMidi + interval;
    while (pitch > getBassHigh()) pitch -= 12;
    while (pitch < getBassLow()) pitch += 12;
    tones.push(pitch);
  }
  return tones;
}

/** Get scale tones spanning the FULL bass range (all octaves). */
export function getScaleTones(root: string, quality: string): number[] {
  const rootPC = ROOT_SEMITONES[root] ?? 0;
  const scale = getQualityScale(quality);

  const tones: number[] = [];
  for (let octave = 1; octave <= 4; octave++) {
    const base = 12 * (octave + 1) + rootPC;
    for (const interval of scale) {
      const pitch = base + interval;
      if (pitch >= getBassLow() && pitch <= getBassHigh()) {
        tones.push(pitch);
      }
    }
  }
  return [...new Set(tones)].sort((a, b) => a - b);
}

/** Per-style approach tone vocabulary weights. */
export type ApproachWeights = { chromatic: number; diatonic: number; doubleChrm: number };

export const APPROACH_VOCAB: Record<string, ApproachWeights> = {
  swing:             { chromatic: 0.75, diatonic: 0.15, doubleChrm: 0.10 },
  hardBop:           { chromatic: 0.70, diatonic: 0.15, doubleChrm: 0.15 },
  coolJazz:          { chromatic: 0.55, diatonic: 0.35, doubleChrm: 0.10 },
  shuffleBlues:      { chromatic: 0.85, diatonic: 0.10, doubleChrm: 0.05 },
  contemporaryJazz:  { chromatic: 0.50, diatonic: 0.20, doubleChrm: 0.30 },
};

/** Record approach in history and return the pitch. */
export function recordAndReturn(pitch: number, target: number): number {
  _approachHistory.push({ fromAbove: pitch > target, interval: Math.abs(pitch - target) });
  if (_approachHistory.length > 4) _approachHistory.shift();
  return pitch;
}

/** Approach tone to target with per-style vocabulary, anti-repetition, and arc awareness. */
export function approachTone(target: number, fromAbove: boolean, scaleTones?: number[], style?: string, arc?: PhraseArc): number {
  const base = APPROACH_VOCAB[style ?? ""] ?? { chromatic: 0.80, diatonic: 0.12, doubleChrm: 0.08 };
  let weights = base;
  if (_bassGranular) {
    const bias = _bassGranular.chromaticApproach / 50;
    const hrScale = _harmonicRhythm >= 2 ? Math.max(0.4, 1 - (_harmonicRhythm - 1) * 0.3) : 1;
    const chrm = Math.min(0.95, base.chromatic * bias * hrScale);
    const remaining = 1 - chrm;
    const diaRatio = base.diatonic / (base.diatonic + base.doubleChrm) || 0.5;
    weights = { chromatic: chrm, diatonic: remaining * diaRatio, doubleChrm: remaining * (1 - diaRatio) };
  }

  // Anti-repetition: if last 2 approaches from same direction, bias opposite (60%)
  if (_approachHistory.length >= 2) {
    const last2 = _approachHistory.slice(-2);
    if (last2.every(r => r.fromAbove === fromAbove) && _rng() < 0.6) {
      fromAbove = !fromAbove;
    }
  }

  // Anti-repetition: if last 2 approaches same interval, boost variety
  if (_approachHistory.length >= 2) {
    const last2 = _approachHistory.slice(-2);
    if (last2.every(r => r.interval === 1)) {
      const chrm = weights.chromatic * 0.35;
      const extra = weights.chromatic - chrm;
      weights = {
        chromatic: chrm,
        diatonic: weights.diatonic + extra * 0.6,
        doubleChrm: weights.doubleChrm + extra * 0.4,
      };
    }
  }

  // Arc-driven direction bias
  if (arc && _rng() < 0.4) {
    if (arc === "build" || arc === "climax" || arc === "shout" || arc === "solo") fromAbove = false;
    else if (arc === "release" || arc === "drop" || arc === "outro" || arc === "breakdown") fromAbove = true;
  }

  const roll = _rng();

  // Double chromatic
  if (roll < weights.doubleChrm) {
    const step1 = fromAbove ? target + 2 : target - 2;
    if (step1 >= getBassLow() && step1 <= getBassHigh()) return recordAndReturn(step1, target);
  }

  // Diatonic
  if (roll < weights.doubleChrm + weights.diatonic) {
    if (scaleTones && scaleTones.length > 0) {
      const candidates = scaleTones.filter(t =>
        fromAbove ? t > target : t < target
      );
      if (candidates.length > 0) {
        candidates.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
        const diatonic = candidates[0];
        if (diatonic >= getBassLow() && diatonic <= getBassHigh()) {
          return recordAndReturn(diatonic, target);
        }
      }
    }
  }

  // Chromatic half-step (default)
  const approach = fromAbove ? target + 1 : target - 1;
  if (approach >= getBassLow() && approach <= getBassHigh()) return recordAndReturn(approach, target);
  return recordAndReturn(fromAbove ? target - 1 : target + 1, target);
}

/** Find a passing tone between two pitches, preferring scale tones. */
export function passingTone(from: number, to: number, scaleTones: number[], chordTones: number[]): number {
  if (Math.abs(to - from) <= 2) {
    const nearby = scaleTones
      .filter((t) => t !== from && t !== to && Math.abs(t - from) <= 4)
      .sort((a, b) => Math.abs(a - from) - Math.abs(b - from));
    if (nearby.length > 0) return nearby[0];
    const ct = chordTones.filter((t) => t !== from && t !== to);
    if (ct.length > 0) return pick(ct);
    return from;
  }

  const direction = to > from ? 1 : -1;
  const candidates = scaleTones.filter((t) => {
    if (direction > 0) return t > from && t < to;
    return t < from && t > to;
  });

  if (candidates.length > 0) {
    const chromatic = _bassGranular?.chromaticApproach ?? 50;
    const filterDiss = chromatic < 40;
    const rootPC = from % 12;
    const safe = filterDiss
      ? candidates.filter(p => {
          const interval = ((p % 12) - rootPC + 12) % 12;
          return interval !== 6 && interval !== 1;
        })
      : candidates;
    const pool = safe.length > 0 ? safe : candidates;
    const mid = (from + to) / 2;
    pool.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    const varietyProb = _bassGranular ? 0.10 + (_bassGranular.beatVariety / 100) * 0.70 : 0.35;
    if (pool.length >= 2 && _rng() < varietyProb) {
      return pool[Math.min(Math.floor(_rng() * 3), pool.length - 1)];
    }
    return pool[0];
  }

  return from + direction;
}

/** Clamp pitch to bass range. */
export function clamp(pitch: number): number {
  while (pitch > getBassHigh()) pitch -= 12;
  while (pitch < getBassLow()) pitch += 12;
  return pitch;
}

/** Filter out pitches that form tritone (6) or minor 2nd (1) interval with root. */
export function filterDissonant(candidates: number[], rootPitch: number): number[] {
  if (candidates.length <= 1) return candidates;
  const rootPC = rootPitch % 12;
  const filtered = candidates.filter(p => {
    const interval = ((p % 12) - rootPC + 12) % 12;
    return interval !== 6 && interval !== 1;
  });
  return filtered.length > 0 ? filtered : candidates;
}

/** Pick random from array. */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(_rng() * arr.length)];
}

// ── Walking Pattern Templates ──

export const ASCENDING_PATTERNS: number[][] = [
  [0, 1, 2, 99],
  [0, 1, 2, 99],
  [0, 2, 3, 99],
  [0, 1, 3, 99],
  [0, 2, 4, 99],
  [0, 3, 4, 99],
  [0, 4, 2, 99],
];

export const DESCENDING_PATTERNS: number[][] = [
  [0, -1, -2, 99],
  [0, -1, -2, 99],
  [0, -1, -3, 99],
  [0, -2, -3, 99],
  [0, -1, -4, 99],
  [0, -2, -4, 99],
  [0, -3, -1, 99],
  [0, -1, 1, 99],
  [0, -2, -1, 99],
  [0, -4, -2, 99],
];

/** Get scale tone at given degree index relative to root. */
export function scaleDegreeToMidi(rootPitch: number, degreeIdx: number, scaleTones: number[]): number {
  if (degreeIdx === 0) return rootPitch;

  const rootIdx = scaleTones.indexOf(rootPitch);
  if (rootIdx < 0) {
    const closest = scaleTones.reduce((prev, curr) =>
      Math.abs(curr - rootPitch) < Math.abs(prev - rootPitch) ? curr : prev
    );
    const ci = scaleTones.indexOf(closest);
    const targetIdx = ci + degreeIdx;
    if (targetIdx >= 0 && targetIdx < scaleTones.length) return scaleTones[targetIdx];
    return clamp(rootPitch + degreeIdx * 2);
  }

  const targetIdx = rootIdx + degreeIdx;
  if (targetIdx >= 0 && targetIdx < scaleTones.length) {
    return scaleTones[targetIdx];
  }
  if (targetIdx < 0) return clamp(scaleTones[0] - 2);
  return clamp(scaleTones[scaleTones.length - 1] + 2);
}

/** Nudge pitch toward _bassTargetPitch by trying both octave variants (50% chance). */
export function nudgeTowardTarget(pitch: number): number {
  if (_bassTargetPitch == null || Math.abs(pitch - _bassTargetPitch) <= 5) return pitch;
  const up = pitch + 12;
  const down = pitch - 12;
  const upValid = up >= getBassLow() && up <= getBassHigh();
  const downValid = down >= getBassLow() && down <= getBassHigh();
  let best = pitch;
  let bestDist = Math.abs(pitch - _bassTargetPitch);
  if (upValid && Math.abs(up - _bassTargetPitch) < bestDist) {
    best = up; bestDist = Math.abs(up - _bassTargetPitch);
  }
  if (downValid && Math.abs(down - _bassTargetPitch) < bestDist) {
    best = down; bestDist = Math.abs(down - _bassTargetPitch);
  }
  if (best !== pitch && _rng() < 0.5) return best;
  return pitch;
}

/** Constrain consecutive bass note intervals to max `maxStep` semitones. */
export function constrainStepwise(notes: { pitch: number }[], maxStep = 5): void {
  const limit = notes.length - 1;
  for (let i = 1; i < limit; i++) {
    const interval = Math.abs(notes[i].pitch - notes[i - 1].pitch);
    if (interval > maxStep) {
      const dir = notes[i].pitch > notes[i - 1].pitch ? 1 : -1;
      let clamped = clamp(notes[i - 1].pitch + dir * maxStep);
      if (clamped === notes[i - 1].pitch) clamped = clamp(clamped + dir);
      if (i + 1 < notes.length && clamped === notes[i + 1].pitch) clamped = clamp(clamped + dir);
      notes[i].pitch = clamped;
    }
  }
}

export function closestOctave(root: number, ref: number): number {
  let best = root;
  for (let oct = -2; oct <= 2; oct++) {
    const candidate = root + oct * 12;
    if (candidate >= getBassLow() && candidate <= getBassHigh() && Math.abs(candidate - ref) < Math.abs(best - ref)) {
      best = candidate;
    }
  }
  return clamp(best);
}

/** Re-export enclosureProb for swing measure. */
export { enclosureProbFn as enclosureProb };

/** Tritone sub bass approach probability per style.
 *  Chromatic descent from bII root (e.g. Db→C on V→I). */
const TRITONE_SUB_BASS_WEIGHT: Record<string, number> = {
  hardBop: 0.20,
  contemporaryJazz: 0.25,
  fusion: 0.18,
  metheny: 0.15,
  alfaMist: 0.15,
  swing: 0.12,
  holdsworth: 0.12,
  neoSoul: 0.10,
  ecm: 0.10,
  coolJazz: 0.08,
  modal: 0.08,
  bossa: 0.05,
  latin: 0.05,
  ballad: 0.08,
};
export function tritoneSubBassWeight(style?: string): number {
  return TRITONE_SUB_BASS_WEIGHT[style ?? "swing"] ?? 0;
}
