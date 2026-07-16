/**
 * Walking Bass Generator — rule-based walking bass lines from chord progressions.
 *
 * Rules (inspired by jazz walking bass pedagogy):
 *   Beat 1: chord root (or 5th for variety)
 *   Beat 2: chord tone (3rd, 5th, 7th)
 *   Beat 3: passing tone (scale-wise between beat 2 and target)
 *   Beat 4: approach tone (chromatic half-step to next root)
 *
 * Supports styles: swing (quarter notes), bossa (root-5th pattern), latin (tumbao).
 * Range: E1–G3 (MIDI 28–55).
 */

import { tempoSwingMultiplier, dynamicMultiplier, instrumentSwingFactor } from "./swingUtils";
import { getGrooveTemplate, applyGroove } from "./grooveTemplates";
import type { BassNote, BassGranular, WalkingBassOptions, ChordEvent, PhraseIntent } from "./types";

export type { BassNote, WalkingBassOptions, ChordEvent };

// ── Module-level PRNG ──
// Set at generateWalkingBass entry, used by all internal helpers.
// Safe: JS is single-threaded and generation is synchronous.
let _rng: () => number = Math.random;
let _bassGranular: BassGranular | undefined;

// ── Constants ──

const BASS_LOW_DEFAULT = 28;  // E1
const BASS_HIGH_DEFAULT = 55; // G3

// registerWidth (0-100) narrows/widens playable range around midpoint (MIDI 41 = F2)
// 0 → ±6 semitones (MIDI 35-47), 100 → full range (MIDI 28-55)
function getBassLow(): number {
  if (!_bassGranular) return BASS_LOW_DEFAULT;
  const t = _bassGranular.registerWidth / 100;
  return Math.round(BASS_LOW_DEFAULT + (1 - t) * 7); // 0→35, 100→28
}
function getBassHigh(): number {
  if (!_bassGranular) return BASS_HIGH_DEFAULT;
  const t = _bassGranular.registerWidth / 100;
  return Math.round(BASS_HIGH_DEFAULT - (1 - t) * 8); // 0→47, 100→55
}


const ROOT_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

// Chord quality → intervals (semitones from root) for chord tones.
// Covers all iReal Pro qualities + common variants.
const CHORD_TONES: Record<string, number[]> = {
  // Major family
  "": [0, 4, 7],
  "maj7": [0, 4, 7, 11],
  "maj9": [0, 4, 7, 11],
  "maj13": [0, 4, 7, 11],
  "maj7#11": [0, 4, 7, 11],
  "maj7#5": [0, 4, 8, 11],
  "6": [0, 4, 7, 9],
  "69": [0, 4, 7, 9],
  "6/9": [0, 4, 7, 9],
  "add9": [0, 4, 7],
  "5": [0, 7],

  // Minor family
  "m": [0, 3, 7],
  "m7": [0, 3, 7, 10],
  "m9": [0, 3, 7, 10],
  "m6": [0, 3, 7, 9],
  "m6/9": [0, 3, 7, 9],
  "m(maj7)": [0, 3, 7, 11],
  "m11": [0, 3, 7, 10],

  // Dominant family
  "7": [0, 4, 7, 10],
  "9": [0, 4, 7, 10],
  "13": [0, 4, 7, 10],
  "7b9": [0, 4, 7, 10],
  "7#9": [0, 4, 7, 10],
  "7b5": [0, 4, 6, 10],
  "7#5": [0, 4, 8, 10],
  "7alt": [0, 4, 8, 10],
  "7b13": [0, 4, 7, 10],
  "7#11": [0, 4, 7, 10],
  "7b9b13": [0, 4, 7, 10],
  "7#9b13": [0, 4, 7, 10],
  "7b9#11": [0, 4, 7, 10],
  "7#9#11": [0, 4, 7, 10],
  "7#9b5": [0, 4, 6, 10],
  "7b9b5": [0, 4, 6, 10],
  "aug7": [0, 4, 8, 10],

  // Suspended family (NO major 3rd!)
  "7sus": [0, 5, 7, 10],
  "7sus4": [0, 5, 7, 10],
  "9sus4": [0, 5, 7, 10],
  "13sus4": [0, 5, 7, 10],
  "sus4": [0, 5, 7],
  "sus2": [0, 2, 7],

  // Diminished / half-dim
  "dim": [0, 3, 6],
  "dim7": [0, 3, 6, 9],
  "m7b5": [0, 3, 6, 10],

  // Augmented
  "aug": [0, 4, 8],
};

/** Resolve unknown quality string to closest match. */
function resolveQuality(q: string): number[] {
  // Direct match
  if (CHORD_TONES[q]) return CHORD_TONES[q];

  // Strip slash bass
  const slashIdx = q.indexOf("/");
  const base = slashIdx >= 0 ? q.slice(0, slashIdx) : q;
  if (CHORD_TONES[base]) return CHORD_TONES[base];

  // Smart fallback: parse quality string for base type
  if (base.includes("dim")) return CHORD_TONES["dim7"];
  if (base.includes("aug")) return CHORD_TONES["aug"];
  if (base.includes("sus")) return CHORD_TONES["7sus"]; // NEVER use major 3rd for sus!
  if (base.startsWith("m") && !base.startsWith("maj")) {
    return base.includes("7") ? CHORD_TONES["m7"] : CHORD_TONES["m"];
  }
  if (base.includes("7") || base.includes("9") || base.includes("13")) {
    return base.includes("maj") ? CHORD_TONES["maj7"] : CHORD_TONES["7"];
  }

  // Absolute fallback: major triad (only for truly unknown like "5", "add9")
  return CHORD_TONES[""] ?? [0, 4, 7];
}

// Scale tones for passing notes
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];       // ionian
const MINOR_SCALE = [0, 2, 3, 5, 7, 9, 10];       // dorian (jazz standard for m7)
const DOMINANT_SCALE = [0, 2, 4, 5, 7, 9, 10];    // mixolydian

// ── Helpers ──

function rootToMidi(root: string): number {
  const semitones = ROOT_SEMITONES[root];
  if (semitones === undefined) return 48; // C3 fallback
  // Place in bass range — find closest to E2 (MIDI 40)
  let midi = 36 + semitones; // octave 2
  if (midi < getBassLow()) midi += 12;
  if (midi > getBassHigh()) midi -= 12;
  return midi;
}

/** Get chord tones in MIDI range for given root + quality. */
function getChordTones(root: string, quality: string): number[] {
  const rootMidi = rootToMidi(root);
  const intervals = resolveQuality(quality);

  const tones: number[] = [];
  for (const interval of intervals) {
    let pitch = rootMidi + interval;
    // Keep in range
    while (pitch > getBassHigh()) pitch -= 12;
    while (pitch < getBassLow()) pitch += 12;
    tones.push(pitch);
  }
  return tones;
}

/** Get scale tones spanning the FULL bass range (all octaves). */
function getScaleTones(root: string, quality: string): number[] {
  const rootPC = ROOT_SEMITONES[root] ?? 0;
  const q = quality.replace(/\/.*$/, ""); // strip slash

  let scale: number[];
  if (q.includes("dim")) {
    scale = [0, 2, 3, 5, 6, 8, 9, 11]; // diminished scale
  } else if (q.includes("sus")) {
    scale = DOMINANT_SCALE; // mixolydian (no 3rd emphasis)
  } else if (q.startsWith("m") && !q.startsWith("maj")) {
    scale = MINOR_SCALE;
  } else if (q === "7" || q === "9" || q === "13" || q.startsWith("7") || q === "aug7") {
    scale = DOMINANT_SCALE;
  } else {
    scale = MAJOR_SCALE;
  }

  // Generate ALL scale tones across the full bass range
  const tones: number[] = [];
  for (let octave = 1; octave <= 4; octave++) {
    const base = 12 * (octave + 1) + rootPC; // C2=36, so octave 1 → 24+rootPC
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
type ApproachWeights = { chromatic: number; diatonic: number; doubleChrm: number };

const APPROACH_VOCAB: Record<string, ApproachWeights> = {
  swing:             { chromatic: 0.75, diatonic: 0.15, doubleChrm: 0.10 },
  hardBop:           { chromatic: 0.70, diatonic: 0.15, doubleChrm: 0.15 },
  coolJazz:          { chromatic: 0.55, diatonic: 0.35, doubleChrm: 0.10 },
  shuffleBlues:      { chromatic: 0.85, diatonic: 0.10, doubleChrm: 0.05 },
  contemporaryJazz:  { chromatic: 0.50, diatonic: 0.20, doubleChrm: 0.30 },
};

/** Approach tone to target with per-style vocabulary. */
function approachTone(target: number, fromAbove: boolean, scaleTones?: number[], style?: string): number {
  const base = APPROACH_VOCAB[style ?? ""] ?? { chromatic: 0.80, diatonic: 0.12, doubleChrm: 0.08 };
  // chromaticApproach (0-100): bias toward chromatic (high) or diatonic (low)
  // At 50 = neutral (use style defaults). Scale chromatic weight by chromaticApproach/50.
  let weights = base;
  if (_bassGranular) {
    const bias = _bassGranular.chromaticApproach / 50; // 0-2 range, 1=neutral
    const chrm = Math.min(0.95, base.chromatic * bias);
    const remaining = 1 - chrm;
    const diaRatio = base.diatonic / (base.diatonic + base.doubleChrm) || 0.5;
    weights = { chromatic: chrm, diatonic: remaining * diaRatio, doubleChrm: remaining * (1 - diaRatio) };
  }
  const roll = _rng();

  // Double chromatic: two half-steps from same direction (e.g., Eb-D approaching C from above)
  if (roll < weights.doubleChrm) {
    const step1 = fromAbove ? target + 2 : target - 2;
    if (step1 >= getBassLow() && step1 <= getBassHigh()) return step1;
  }

  // Diatonic: nearest scale tone above/below target
  if (roll < weights.doubleChrm + weights.diatonic) {
    if (scaleTones && scaleTones.length > 0) {
      // Find the nearest scale tone in the approach direction
      const candidates = scaleTones.filter(t =>
        fromAbove ? t > target : t < target
      );
      if (candidates.length > 0) {
        candidates.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
        const diatonic = candidates[0];
        if (diatonic >= getBassLow() && diatonic <= getBassHigh()) {
          return diatonic;
        }
      }
    }
  }

  // Chromatic half-step (default/most common)
  const approach = fromAbove ? target + 1 : target - 1;
  if (approach >= getBassLow() && approach <= getBassHigh()) return approach;
  return fromAbove ? target - 1 : target + 1;
}

/** Find a passing tone between two pitches, preferring scale tones. */
function passingTone(from: number, to: number, scaleTones: number[], chordTones: number[]): number {
  // If from and to are very close (≤2 semitones), use a nearby scale tone instead
  if (Math.abs(to - from) <= 2) {
    // Pick a scale tone near 'from' that isn't 'from' or 'to'
    const nearby = scaleTones
      .filter((t) => t !== from && t !== to && Math.abs(t - from) <= 4)
      .sort((a, b) => Math.abs(a - from) - Math.abs(b - from));
    if (nearby.length > 0) return nearby[0];
    // If no scale tone, use a chord tone
    const ct = chordTones.filter((t) => t !== from && t !== to);
    if (ct.length > 0) return pick(ct);
    return from; // absolute fallback
  }

  // Standard case: find scale tone between from and to
  const direction = to > from ? 1 : -1;
  const candidates = scaleTones.filter((t) => {
    if (direction > 0) return t > from && t < to;
    return t < from && t > to;
  });

  if (candidates.length > 0) {
    // Filter out tritone/b2 from root region, then sort by proximity to midpoint
    const rootPC = from % 12;
    const safe = candidates.filter(p => {
      const interval = ((p % 12) - rootPC + 12) % 12;
      return interval !== 6 && interval !== 1;
    });
    const pool = safe.length > 0 ? safe : candidates;
    const mid = (from + to) / 2;
    pool.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    // beatVariety (0-100): scales probability of picking non-nearest tone (0→10%, 40→35%, 100→80%)
    const varietyProb = _bassGranular ? 0.10 + (_bassGranular.beatVariety / 100) * 0.70 : 0.35;
    if (pool.length >= 2 && _rng() < varietyProb) {
      return pool[Math.min(Math.floor(_rng() * 3), pool.length - 1)];
    }
    return pool[0];
  }

  // Fallback: chromatic approach (half step toward target)
  return from + direction;
}

/** Clamp pitch to bass range. */
function clamp(pitch: number): number {
  while (pitch > getBassHigh()) pitch -= 12;
  while (pitch < getBassLow()) pitch += 12;
  return pitch;
}

/** Filter out pitches that form tritone (6) or minor 2nd (1) interval with root.
 *  Falls back to unfiltered if all candidates removed (e.g., dim chords where b5 IS the chord). */
function filterDissonant(candidates: number[], rootPitch: number): number[] {
  if (candidates.length <= 1) return candidates;
  const rootPC = rootPitch % 12;
  const filtered = candidates.filter(p => {
    const interval = ((p % 12) - rootPC + 12) % 12;
    return interval !== 6 && interval !== 1;
  });
  return filtered.length > 0 ? filtered : candidates;
}

/** Pick random from array (deterministic seed for testing not needed here). */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(_rng() * arr.length)];
}

// ── Walking Pattern Templates ──
// Each pattern = [beat1, beat2, beat3, beat4] as SCALE DEGREE INDICES.
// Index 0 = root, 1 = 2nd, 2 = 3rd, 3 = 4th, 4 = 5th, 5 = 6th, 6 = 7th.
// Negative indices = one octave below (e.g., -1 = 7th below root).
// Special value 99 = chromatic approach to next root.

// Ascending patterns — stepwise (max 3rd on beat 2, smooth walk up)
const ASCENDING_PATTERNS: number[][] = [
  [0, 1, 2, 99],    // R-2-3-approach (most common scalar walk)
  [0, 1, 2, 99],    // (double weight — most idiomatic)
  [0, 2, 3, 99],    // R-3-4-approach
  [0, 1, 3, 99],    // R-2-4-approach (skip 3rd)
  [0, 2, 4, 99],    // R-3-5-approach (arpeggio up)
  [0, 3, 4, 99],    // R-4-5-approach
  [0, 4, 2, 99],    // R-5-3-approach (leap to 5th then step back)
  [0, 1, -1, 99],   // R-2-chromatic below root (enclosure feel)
  [0, 2, 1, 99],    // R-3-2-approach (step back before approach)
  [0, 4, 3, 99],    // R-5-4-approach (arpeggio descent)
];

// Descending patterns — stepwise down from root
const DESCENDING_PATTERNS: number[][] = [
  [0, -1, -2, 99],  // R-7below-6below-approach (most common)
  [0, -1, -2, 99],  // (double weight)
  [0, -1, -3, 99],  // R-7below-5below-approach
  [0, -2, -3, 99],  // R-6below-5below-approach
  [0, -1, -4, 99],  // R-7below-4below-approach
  [0, -2, -4, 99],  // R-6below-4below-approach
  [0, -3, -1, 99],  // R-5below-7below-approach (leap down, step back up)
  [0, -1, 1, 99],   // R-7below-2above (enclosure-style)
  [0, -2, -1, 99],  // R-6below-7below-approach (step up before approach)
  [0, -4, -2, 99],  // R-4below-6below-approach (arpeggio)
];

// ── Swing Style (4 quarter notes per bar) ──

/** Get scale tone at given degree index relative to root.
 *  Index 0=root, 1=2nd, 2=3rd, 3=4th, 4=5th, 5=6th, 6=7th.
 *  Negative indices go below root (e.g., -1 = 7th below = root - scale step). */
function scaleDegreeToMidi(rootPitch: number, degreeIdx: number, scaleTones: number[]): number {
  if (degreeIdx === 0) return rootPitch;

  // scaleTones is sorted array of all pitches in range
  const rootIdx = scaleTones.indexOf(rootPitch);
  if (rootIdx < 0) {
    // Root not in scaleTones (shouldn't happen), find closest
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
  // Out of range: wrap by octave
  if (targetIdx < 0) return clamp(scaleTones[0] - 2);
  return clamp(scaleTones[scaleTones.length - 1] + 2);
}

function generateSwingMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
  swingAmount?: number,
  tempo?: number,
  style?: string,
  prevDirection?: "up" | "down" | null,
): BassNote[] {
  // Place root in register close to previous note (smooth bar transitions)
  let rootPitch = rootToMidi(chord.root);
  if (prevPitch !== null) {
    while (rootPitch < prevPitch - 6) rootPitch += 12;
    while (rootPitch > prevPitch + 6) rootPitch -= 12;
    rootPitch = clamp(rootPitch);
  }
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const chordTones = getChordTones(chord.root, chord.quality);
  const isLastChord = !nextChord;

  // ── Contour-based approach: compute beat 4 (target) FIRST ──

  // Beat 1: root ~65%, 5th ~25%, 3rd ~10% (varies by style).
  // Non-root beat 1 creates motion and avoids the "MIDI bass" plodding feel.
  // Real bassists (Ron Carter, Ray Brown) use non-root tones ~30-40% of time.
  let beat1: number;
  const beat1Roll = _rng();
  // Place 5th and 3rd close to prevPitch for smooth voice leading
  let fifthPitch = clamp(rootPitch + 7);
  if (prevPitch !== null) {
    while (fifthPitch > prevPitch + 6) fifthPitch -= 12;
    while (fifthPitch < prevPitch - 6) fifthPitch += 12;
    fifthPitch = clamp(fifthPitch);
  }
  let thirdPitch: number | null = null;
  if (chordTones.length > 1) {
    let tp = clamp(rootPitch + (chordTones[1] - chordTones[0]));
    if (prevPitch !== null) {
      while (tp > prevPitch + 6) tp -= 12;
      while (tp < prevPitch - 6) tp += 12;
    }
    thirdPitch = clamp(tp);
  }
  // First chord always root (establish tonality)
  if (!prevPitch) {
    beat1 = rootPitch;
  } else if (beat1Roll < 0.65) {
    beat1 = rootPitch;
  } else if (beat1Roll < 0.90) {
    beat1 = fifthPitch;
  } else if (thirdPitch !== null) {
    // 3rd on beat 1 - smooth voice leading from previous bar's beat 4
    beat1 = thirdPitch;
  } else {
    beat1 = rootPitch;
  }

  // Guard: if non-root beat 1 creates a large leap from approach note,
  // fall back to root (which is always close via register placement)
  if (prevPitch !== null && beat1 !== rootPitch && Math.abs(beat1 - prevPitch) > 7) {
    beat1 = rootPitch;
  }

  // Beat 4: approach tone to next root
  let beat4: number;
  if (isLastChord) {
    beat4 = rootPitch;
  } else {
    const nextRoot = rootToMidi(nextChord.root);
    let target = nextRoot;
    while (target < beat1 - 7) target += 12;
    while (target > beat1 + 7) target -= 12;
    target = clamp(target);

    // Two-bar phrasing: bias target octave to alternate contour direction
    if (prevDirection === "up" && target >= beat1 && _rng() < 0.6) {
      const lower = clamp(target - 12);
      if (lower >= getBassLow()) target = lower;
    } else if (prevDirection === "down" && target <= beat1 && _rng() < 0.6) {
      const higher = clamp(target + 12);
      if (higher <= getBassHigh()) target = higher;
    }

    // Jazz idiom: chord's 3rd as approach when half-step below next root
    const third = chordTones.length > 1 ? chordTones[1] : null;
    if (third !== null && (target - third === 1 || target - third === -11)) {
      beat4 = third;
    } else {
      let fromAbove = beat1 > target;
      if (_rng() < 0.3) fromAbove = !fromAbove;
      const nextScale = nextChord ? getScaleTones(nextChord.root, nextChord.quality) : scaleTones;
      beat4 = approachTone(target, fromAbove, nextScale, style);
    }
  }

  // ── Beats 2-3: interpolate smoothly between beat 1 and beat 4 ──
  const direction = beat4 >= beat1 ? 1 : -1;
  const span = Math.abs(beat4 - beat1);

  let beat2: number;
  let beat3: number;

  if (span <= 2) {
    // Very close: use chord tone + nearby scale tone
    const ct = chordTones.filter(t => t !== beat1 && t !== beat4 && Math.abs(t - beat1) <= 5);
    beat2 = ct.length > 0 ? pick(ct) : scaleDegreeToMidi(beat1, direction > 0 ? 1 : -1, scaleTones);
    beat3 = passingTone(beat2, beat4, scaleTones, chordTones);
  } else {
    // Standard contour: divide span into thirds, pick scale/chord tones near each
    const third1 = beat1 + Math.round(span / 3) * direction;
    const third2 = beat1 + Math.round(2 * span / 3) * direction;

    // Beat 2: chord tone near 1/3 position, with variety
    const ct2 = chordTones.filter(t => Math.abs(t - third1) <= 3 && t !== beat1);
    if (ct2.length > 0) {
      ct2.sort((a, b) => Math.abs(a - third1) - Math.abs(b - third1));
      // beatVariety scales second-nearest pick probability
      const bt2Prob = _bassGranular ? 0.10 + (_bassGranular.beatVariety / 100) * 0.70 : 0.35;
      beat2 = (ct2.length >= 2 && _rng() < bt2Prob) ? ct2[1] : ct2[0];
    } else {
      // Fallback: scale degree, filter dissonant
      const deg1 = scaleDegreeToMidi(beat1, direction > 0 ? 1 : -1, scaleTones);
      const deg2 = scaleDegreeToMidi(beat1, direction > 0 ? 2 : -2, scaleTones);
      const opts = filterDissonant([deg1, deg2].filter(t => t !== beat1), beat1);
      beat2 = opts.length > 0 ? opts[Math.floor(_rng() * opts.length)] : deg1;
    }

    // Beat 3: scale tone nearest 2/3 position (passing tone toward beat 4)
    beat3 = passingTone(beat2, beat4, scaleTones, chordTones);
    // If passingTone returns something far from the 2/3 target, try a scale tone directly
    if (Math.abs(beat3 - third2) > 4) {
      const sc3 = scaleTones.filter(t => Math.abs(t - third2) <= 3 && t !== beat2 && t !== beat4);
      if (sc3.length > 0) {
        sc3.sort((a, b) => Math.abs(a - third2) - Math.abs(b - third2));
        beat3 = sc3[0];
      }
    }
  }

  const pitches = [beat1, beat2, beat3, beat4];

  // Validate: no repeated adjacent notes
  for (let i = 1; i < pitches.length; i++) {
    if (pitches[i] === pitches[i - 1]) {
      pitches[i] = clamp(pitches[i] + (direction > 0 ? 2 : -2));
    }
  }

  // Eighth-note enclosure on beat 4 — syncopation (0-100) scales probability: 0→0%, 30→15%, 100→40%
  // Reduce at fast tempos: full probability up to 180, linear decay to 0 at 300
  const t = tempo ?? 120;
  const tempoEnclosureScale = t <= 180 ? 1.0 : Math.max(0, 1.0 - (t - 180) / 120);
  const enclosureProb = (_bassGranular ? _bassGranular.syncopation / 100 * 0.40 : 0.15) * tempoEnclosureScale;
  const nearBoundary = pitches[3] <= getBassLow() + 2 || pitches[3] >= getBassHigh() - 2;
  const doEnclosure = !isLastChord && !nearBoundary && _rng() < enclosureProb;

  if (doEnclosure) {
    const target = pitches[3];
    const above = clamp(target + 1);
    const below = clamp(target - 1);
    if (above !== below && above !== pitches[2] && below !== pitches[2]) {
      const [first, second] = _rng() < 0.5 ? [above, below] : [below, above];

      const beat4Time = chord.time + beatDuration * 3;
      const eighthDur = beatDuration * 0.5;
      const effSwing = (swingAmount ?? 100) * tempoSwingMultiplier(tempo ?? 120) * instrumentSwingFactor("bass");
      const swingOffset = (effSwing / 100) * (2 / 3 - 0.5);

      const baseNotes: BassNote[] = pitches.slice(0, 3).map((pitch, i) => ({
        pitch,
        time: chord.time + beatDuration * i,
        duration: beatDuration * 0.9,
        velocity: i === 0 ? 100 : 85,
      }));
      baseNotes.push(
        { pitch: first, time: beat4Time, duration: eighthDur * 0.85, velocity: 75 },
        { pitch: second, time: beat4Time + eighthDur + swingOffset * beatDuration, duration: eighthDur * 0.85, velocity: 70 },
      );
      return baseNotes;
    }
  }

  return pitches.map((pitch, i) => ({
    pitch,
    time: chord.time + beatDuration * i,
    duration: i === 3 ? beatDuration * 0.6 : beatDuration * 0.9,
    velocity: i === 0 ? 100 : i === 3 ? 70 : 85,
  }));
}

// ── Bossa Style (root-5th with variations, half notes) ──

function generateBossaMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch?: number | null,
): BassNote[] {
  const root = rootToMidi(chord.root);
  const rootPitch = prevPitch != null ? closestOctave(root, prevPitch) : root;
  const chordTones = getChordTones(chord.root, chord.quality);
  const fifth = clamp(rootPitch + 7);
  const third = chordTones.length > 1 ? clamp(rootPitch + (chordTones[1] - chordTones[0])) : fifth;

  // Bossa bass patterns beyond basic root-5th (Joao Gilberto, Ron Carter bossa):
  // Pattern 0: root → 5th (standard, 50%)
  // Pattern 1: root → 3rd (color, 25%)
  // Pattern 2: root → chromatic approach to next root (leading tone, 15%)
  // Pattern 3: 5th → root (inverted, 10%) — only after first chord
  const roll = _rng();
  let p1: number, p2: number;
  if (prevPitch == null || roll < 0.50) {
    // First chord always root-5th; standard pattern 50% otherwise
    p1 = rootPitch; p2 = fifth;
  } else if (roll < 0.75) {
    p1 = rootPitch; p2 = third;
  } else if (roll < 0.90) {
    p1 = rootPitch; p2 = clamp(rootPitch - 1);
  } else {
    p1 = fifth; p2 = rootPitch;
  }

  return [
    { pitch: p1, time: chord.time, duration: beatDuration * 2 * 0.9, velocity: 95 },
    { pitch: p2, time: chord.time + beatDuration * 2, duration: beatDuration * 2 * 0.9, velocity: 80 },
  ];
}

// ── Latin/Tumbao Style ──

function generateLatinMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch?: number | null,
): BassNote[] {
  const root = rootToMidi(chord.root);
  const rootPitch = prevPitch != null ? closestOctave(root, prevPitch) : root;
  const chordTones = getChordTones(chord.root, chord.quality);
  const fifth = clamp(rootPitch + 7);
  const third = chordTones.length > 1 ? clamp(rootPitch + (chordTones[1] - chordTones[0])) : fifth;
  const octave = clamp(rootPitch + 12);

  // Tumbao variations (Cachao, Israel Lopez, Oscar D'Leon):
  // Pattern 0: classic root-5-oct-5 (standard, 40%)
  // Pattern 1: root-3-5-root (melodic, 25%)
  // Pattern 2: root-5-3-chromatic (approach, 20%)
  // Pattern 3: anticipated root on beat 4.5 (2-3 clave, 15%) — only after first chord
  const roll = _rng();
  if (prevPitch == null || roll < 0.40) {
    return [
      { pitch: rootPitch, time: chord.time, duration: beatDuration * 1.4, velocity: 100 },
      { pitch: fifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.9, velocity: 80 },
      { pitch: octave, time: chord.time + beatDuration * 2.5, duration: beatDuration * 0.9, velocity: 90 },
      { pitch: fifth, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.4, velocity: 75 },
    ];
  } else if (roll < 0.65) {
    return [
      { pitch: rootPitch, time: chord.time, duration: beatDuration * 1.4, velocity: 100 },
      { pitch: third, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.9, velocity: 80 },
      { pitch: fifth, time: chord.time + beatDuration * 2.5, duration: beatDuration * 0.9, velocity: 85 },
      { pitch: rootPitch, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.4, velocity: 75 },
    ];
  } else if (roll < 0.85) {
    const approach = clamp(rootPitch - 1);
    return [
      { pitch: rootPitch, time: chord.time, duration: beatDuration * 1.4, velocity: 100 },
      { pitch: fifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.9, velocity: 80 },
      { pitch: third, time: chord.time + beatDuration * 2.5, duration: beatDuration * 0.9, velocity: 85 },
      { pitch: approach, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.4, velocity: 70 },
    ];
  } else {
    // Anticipated: skip beat 1, syncopated entry on "and" of 4
    return [
      { pitch: fifth, time: chord.time + beatDuration * 0.5, duration: beatDuration * 0.9, velocity: 85 },
      { pitch: rootPitch, time: chord.time + beatDuration * 1.5, duration: beatDuration * 1.4, velocity: 100 },
      { pitch: octave, time: chord.time + beatDuration * 3, duration: beatDuration * 0.9, velocity: 90 },
    ];
  }
}

// ── FUSION ──

function generateFusionMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const ct = chordTones.length > 1 ? clamp(startPitch + (chordTones[1] - chordTones[0])) : clamp(startPitch + 5);
  const fifth = clamp(startPitch + 7);
  const octave = clamp(startPitch + 12);

  const r = _rng();
  if (r < 0.3) {
    // Pattern A: Syncopated 16th groove (Jaco-style off-beat emphasis)
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.7, velocity: 100 },
      { pitch: ct, time: chord.time + beatDuration * 0.75, duration: beatDuration * 0.5, velocity: 80 },
      { pitch: fifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.4, velocity: 85 },
      { pitch: startPitch, time: chord.time + beatDuration * 2, duration: beatDuration * 0.6, velocity: 95 },
      { pitch: clamp(startPitch + 3), time: chord.time + beatDuration * 2.75, duration: beatDuration * 0.4, velocity: 75 },
      { pitch: ct, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.4, velocity: 70 },
    ];
  }
  if (r < 0.55) {
    // Pattern B: Chromatic approach to beat 3 (Weather Report pocket)
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.9, velocity: 100 },
      { pitch: clamp(fifth - 1), time: chord.time + beatDuration * 1.0, duration: beatDuration * 0.4, velocity: 70 },
      { pitch: fifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.8, velocity: 90 },
      { pitch: ct, time: chord.time + beatDuration * 2.5, duration: beatDuration * 0.5, velocity: 80 },
      { pitch: startPitch, time: chord.time + beatDuration * 3.0, duration: beatDuration * 0.9, velocity: 85 },
    ];
  }
  if (r < 0.8) {
    // Pattern C: Octave jump groove (Marcus Miller snap)
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.5, velocity: 100 },
      { pitch: octave, time: chord.time + beatDuration * 0.5, duration: beatDuration * 0.3, velocity: 75 },
      { pitch: startPitch, time: chord.time + beatDuration * 1.0, duration: beatDuration * 0.8, velocity: 90 },
      { pitch: fifth, time: chord.time + beatDuration * 2.0, duration: beatDuration * 0.7, velocity: 85 },
      { pitch: ct, time: chord.time + beatDuration * 2.75, duration: beatDuration * 0.5, velocity: 75 },
      { pitch: startPitch, time: chord.time + beatDuration * 3.25, duration: beatDuration * 0.6, velocity: 80 },
    ];
  }
  // Pattern D: Space groove — fewer notes, longer durations (breathing room)
  return [
    { pitch: startPitch, time: chord.time, duration: beatDuration * 1.2, velocity: 100 },
    { pitch: fifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 1.0, velocity: 85 },
    { pitch: ct, time: chord.time + beatDuration * 3.0, duration: beatDuration * 0.8, velocity: 75 },
  ];
}

// ── ECM ──

function generateEcmMeasure(
  chord: ChordEvent,
  beatDuration: number,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const fifth = clamp(rootMidi + 7);
  const ninth = clamp(rootMidi + 14);  // color tone
  const fourth = clamp(rootMidi + 5);  // sus quality

  const r = _rng();
  if (r < 0.35) {
    // Sustained root — pedal point (Peacock style)
    return [
      { pitch: rootMidi, time: chord.time, duration: beatDuration * 3.8, velocity: 70 },
    ];
  }
  if (r < 0.6) {
    // Root + 5th on beat 3
    return [
      { pitch: rootMidi, time: chord.time, duration: beatDuration * 1.9, velocity: 70 },
      { pitch: fifth, time: chord.time + beatDuration * 2, duration: beatDuration * 1.8, velocity: 58 },
    ];
  }
  if (r < 0.8) {
    // Root + 9th — adds Nordic harmonic color (Christensen trio)
    return [
      { pitch: rootMidi, time: chord.time, duration: beatDuration * 2.5, velocity: 70 },
      { pitch: ninth, time: chord.time + beatDuration * 2.5, duration: beatDuration * 1.3, velocity: 55 },
    ];
  }
  // Root → 4th (sus quality, creates tension without resolution)
  return [
    { pitch: rootMidi, time: chord.time, duration: beatDuration * 1.5, velocity: 70 },
    { pitch: fourth, time: chord.time + beatDuration * 2, duration: beatDuration * 1.8, velocity: 55 },
  ];
}

// ── HARD BOP ──

function generateHardBopMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
  prevDirection?: "up" | "down" | null,
): BassNote[] {
  // Same as swing walk but louder, more aggressive approach
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const scaleTones = getScaleTones(chord.root, chord.quality);

  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const pitches: number[] = [_rng() < 0.8 ? startPitch : clamp(startPitch + 7)];

  // Determine direction based on next root, biased by two-bar phrasing
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);
  let ascending = target >= startPitch;
  if (prevDirection === "up" && _rng() < 0.65) ascending = false;
  else if (prevDirection === "down" && _rng() < 0.65) ascending = true;

  // Beat 2: chord tone — pick directionally toward target, sorted by proximity to beat 1
  const nearCT = chordTones
    .filter(t => t !== startPitch && Math.abs(t - startPitch) <= 5)
    .sort((a, b) => Math.abs(a - pitches[0]) - Math.abs(b - pitches[0]));
  if (nearCT.length > 0) {
    // Prefer chord tone in target direction
    const dirCT = nearCT.filter(t => ascending ? t > pitches[0] : t < pitches[0]);
    pitches.push(dirCT.length > 0 ? dirCT[0] : nearCT[0]);
  } else {
    pitches.push(clamp(startPitch + (ascending ? 4 : -3)));
  }

  // Beat 3: scale passing tone — step toward target from beat 2
  const prevP = pitches[pitches.length - 1];
  const nearScale = scaleTones
    .filter(t => t !== prevP && Math.abs(t - prevP) <= 4)
    .filter(t => ascending ? t > prevP : t < prevP)
    .sort((a, b) => Math.abs(a - prevP) - Math.abs(b - prevP));
  pitches.push(nearScale.length > 0 ? nearScale[0] : clamp(prevP + (ascending ? 2 : -2)));

  // Beat 4: chromatic approach (from below for driving feel)
  pitches.push(clamp(target - 1));

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: i === 3 ? beatDuration * 0.5 : beatDuration * 0.9,
    velocity: i === 0 ? 110 : i === 3 ? 85 : 95,
  }));
}

// ── COOL JAZZ ──

function generateCoolJazzMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
  prevDirection?: "up" | "down" | null,
): BassNote[] {
  // Smooth walk: softer, longer legato, prefers stepwise motion
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);

  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const pitches: number[] = [startPitch];

  // Determine direction based on target, biased by two-bar phrasing
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);
  let ascending = target >= startPitch;
  if (prevDirection === "up" && _rng() < 0.65) ascending = false;
  else if (prevDirection === "down" && _rng() < 0.65) ascending = true;

  // Steps 2-3: scale-wise (prefer small intervals, stepwise motion)
  const nearby = scaleTones
    .filter(t => ascending
      ? (t > startPitch && t <= startPitch + 5)
      : (t < startPitch && t >= startPitch - 5))
    .sort((a, b) => ascending ? a - b : b - a);
  if (nearby.length >= 2) {
    pitches.push(nearby[0]);
    pitches.push(nearby[1]);
  } else if (nearby.length === 1) {
    pitches.push(nearby[0]);
    pitches.push(clamp(nearby[0] + (ascending ? 2 : -2)));
  } else {
    pitches.push(clamp(startPitch + (ascending ? 2 : -2)));
    pitches.push(clamp(startPitch + (ascending ? 4 : -4)));
  }

  // Beat 4: gentle chromatic approach
  pitches.push(clamp(target - 1));

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: beatDuration * 0.95, // long legato
    velocity: i === 0 ? 80 : i === 3 ? 60 : 70,
  }));
}

// ── MODAL ──

function generateModalMeasure(
  chord: ChordEvent,
  beatDuration: number,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const fifth = clamp(rootMidi + 7);
  const ninth = clamp(rootMidi + 14);
  const fourth = clamp(rootMidi + 5);

  const r = _rng();
  if (r < 0.25) {
    // Sustained root — full pedal (Chambers on Kind of Blue)
    return [
      { pitch: rootMidi, time: chord.time, duration: beatDuration * 3.8, velocity: 75 },
    ];
  }
  if (r < 0.5) {
    // Root held 3 beats + chromatic approach on beat 4
    return [
      { pitch: rootMidi, time: chord.time, duration: beatDuration * 2.9, velocity: 75 },
      { pitch: clamp(rootMidi + 2), time: chord.time + beatDuration * 3, duration: beatDuration * 0.7, velocity: 60 },
    ];
  }
  if (r < 0.75) {
    // Root + 5th on beat 3 (classic modal walk)
    return [
      { pitch: rootMidi, time: chord.time, duration: beatDuration * 1.9, velocity: 75 },
      { pitch: fifth, time: chord.time + beatDuration * 2, duration: beatDuration * 0.9, velocity: 65 },
      { pitch: fourth, time: chord.time + beatDuration * 3, duration: beatDuration * 0.7, velocity: 60 },
    ];
  }
  // Root + 9th — modal color (Ron Carter on Maiden Voyage)
  return [
    { pitch: rootMidi, time: chord.time, duration: beatDuration * 2.2, velocity: 75 },
    { pitch: ninth, time: chord.time + beatDuration * 2.5, duration: beatDuration * 1.3, velocity: 58 },
  ];
}

// ── JAZZ WALTZ (3/4) ──

function generateJazzWaltzMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
  prevDirection?: "up" | "down" | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;

  // 3 notes per bar: root, scale tone, approach to next root
  const pitches: number[] = [startPitch];

  // Determine direction based on target, biased by two-bar phrasing
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);
  let ascending = target >= startPitch;
  if (prevDirection === "up" && _rng() < 0.65) ascending = false;
  else if (prevDirection === "down" && _rng() < 0.65) ascending = true;

  // Beat 2: scale tone (nearby, stepwise, directional)
  const nearby = scaleTones
    .filter(t => ascending
      ? (t > startPitch && t <= startPitch + 5)
      : (t < startPitch && t >= startPitch - 5))
    .sort((a, b) => Math.abs(a - startPitch) - Math.abs(b - startPitch));
  pitches.push(nearby.length > 0 ? nearby[Math.floor(_rng() * Math.min(nearby.length, 2))] : clamp(startPitch + (ascending ? 3 : -3)));

  // Beat 3: chromatic approach to next bar
  pitches.push(clamp(target - 1));

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: beatDuration * 0.9,
    velocity: i === 0 ? 90 : i === 2 ? 65 : 75,
  }));
}

// ── SHUFFLE BLUES ──

function generateShuffleBluesMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;

  const thirdInterval = chordTones.length > 1 ? chordTones[1] - chordTones[0] : 4;
  const third = clamp(startPitch + thirdInterval);
  const fifth = clamp(startPitch + 7);
  const sixth = clamp(startPitch + 9);  // major 6th
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);

  // Pick pattern randomly for variety
  const roll = _rng();
  let pitches: number[];

  if (roll < 0.30) {
    // Classic: root → 3rd → 5th → approach
    pitches = [startPitch, third, fifth, clamp(target - 1)];
  } else if (roll < 0.55) {
    // Boogie-woogie: root → 5th → 6th → 5th
    pitches = [startPitch, fifth, sixth, fifth];
  } else if (roll < 0.75) {
    // Walking 6ths: root → 6th → octave → approach
    const octave = clamp(startPitch + 12);
    pitches = [startPitch, sixth, octave, clamp(target - 1)];
  } else if (roll < 0.90) {
    // Ascending walk: root → 3rd → 5th → 6th
    pitches = [startPitch, third, fifth, sixth];
  } else {
    // Turnaround: root → 5th → 3rd → chromatic approach (descending contour)
    pitches = [startPitch, fifth, third, clamp(target - 1)];
  }

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: beatDuration * 0.85,
    velocity: i === 0 ? 100 : i === 2 ? 90 : i === 3 ? 75 : 85,
  }));
}

/** Constrain consecutive bass note intervals to max `maxStep` semitones.
 *  Skips last note — typically an approach tone that must stay near next root.
 *  Real jazz bassists rarely jump > perfect 4th between beats within a measure. */
function constrainStepwise(notes: BassNote[], maxStep = 5): void {
  const limit = notes.length - 1; // skip approach note (last)
  for (let i = 1; i < limit; i++) {
    const interval = Math.abs(notes[i].pitch - notes[i - 1].pitch);
    if (interval > maxStep) {
      const dir = notes[i].pitch > notes[i - 1].pitch ? 1 : -1;
      let clamped = clamp(notes[i - 1].pitch + dir * maxStep);
      // Avoid creating repeated notes with prev or next
      if (clamped === notes[i - 1].pitch) clamped = clamp(clamped + dir);
      if (i + 1 < notes.length && clamped === notes[i + 1].pitch) clamped = clamp(clamped + dir);
      notes[i].pitch = clamped;
    }
  }
}

// Helper for new styles
function closestOctave(root: number, ref: number): number {
  let best = root;
  for (let oct = -2; oct <= 2; oct++) {
    const candidate = root + oct * 12;
    if (candidate >= getBassLow() && candidate <= getBassHigh() && Math.abs(candidate - ref) < Math.abs(best - ref)) {
      best = candidate;
    }
  }
  return clamp(best);
}

// ── NEO-SOUL ──

function generateNeoSoulMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const ct = chordTones.length > 1 ? clamp(startPitch + (chordTones[1] - chordTones[0])) : clamp(startPitch + 5);

  // Marcus Miller-style: root + staccato 16th fills, chromatic approaches
  const patterns = [
    // Pattern A: groove root with staccato repeat
    [
      { pitch: startPitch, time: 0, dur: 0.5, vel: 95 },
      { pitch: startPitch, time: 0.75, dur: 0.3, vel: 70 },
      { pitch: ct, time: 1.5, dur: 0.4, vel: 80 },
      { pitch: startPitch, time: 2, dur: 0.6, vel: 90 },
      { pitch: clamp(startPitch - 1), time: 3, dur: 0.3, vel: 75 },
      { pitch: startPitch, time: 3.5, dur: 0.4, vel: 70 },
    ],
    // Pattern B: syncopated 16th groove
    [
      { pitch: startPitch, time: 0, dur: 0.4, vel: 95 },
      { pitch: ct, time: 0.5, dur: 0.3, vel: 75 },
      { pitch: startPitch, time: 1.25, dur: 0.4, vel: 80 },
      { pitch: clamp(startPitch + 7), time: 2, dur: 0.5, vel: 85 },
      { pitch: ct, time: 2.75, dur: 0.3, vel: 70 },
      { pitch: clamp(startPitch - 1), time: 3.5, dur: 0.4, vel: 75 },
    ],
    // Pattern C: sparser groove
    [
      { pitch: startPitch, time: 0, dur: 0.8, vel: 95 },
      { pitch: ct, time: 1.5, dur: 0.5, vel: 80 },
      { pitch: startPitch, time: 2.5, dur: 0.6, vel: 85 },
      { pitch: clamp(startPitch - 1), time: 3.5, dur: 0.4, vel: 70 },
    ],
  ];

  const chosen = patterns[Math.floor(_rng() * patterns.length)];
  return chosen.map(n => ({
    pitch: n.pitch,
    time: chord.time + n.time * beatDuration,
    duration: n.dur * beatDuration,
    velocity: n.vel,
  }));
}

// ── CONTEMPORARY JAZZ ──

function generateContemporaryJazzMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const thirdInt = chordTones.length > 1 ? chordTones[1] - chordTones[0] : 4;

  // Avishai Cohen style: melodic walking with wider intervals and 8th-note runs
  const doEighthRun = _rng() < 0.4;

  if (doEighthRun) {
    // 8th-note run on beats 3-4
    const fifth = clamp(startPitch + 7);
    const third = clamp(startPitch + thirdInt);
    const scaleTone = clamp(startPitch + 5); // perfect 4th as passing tone
    const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
    const approach = clamp(closestOctave(nextRoot, startPitch) - 1);
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.9, velocity: 95 },
      { pitch: fifth, time: chord.time + beatDuration, duration: beatDuration * 0.9, velocity: 85 },
      { pitch: third, time: chord.time + beatDuration * 2, duration: beatDuration * 0.45, velocity: 80 },
      { pitch: scaleTone, time: chord.time + beatDuration * 2.5, duration: beatDuration * 0.45, velocity: 75 },
      { pitch: approach, time: chord.time + beatDuration * 3, duration: beatDuration * 0.45, velocity: 80 },
      { pitch: clamp(approach + 1), time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.45, velocity: 75 },
    ];
  }

  // Standard melodic walk with wider intervals
  const third = clamp(startPitch + thirdInt);
  const fifth = clamp(startPitch + 7);
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);
  const approach = clamp(target - (_rng() < 0.5 ? 1 : -1));

  return [
    { pitch: startPitch, time: chord.time, duration: beatDuration * 0.9, velocity: 95 },
    { pitch: fifth, time: chord.time + beatDuration, duration: beatDuration * 0.9, velocity: 85 },
    { pitch: third, time: chord.time + beatDuration * 2, duration: beatDuration * 0.9, velocity: 80 },
    { pitch: approach, time: chord.time + beatDuration * 3, duration: beatDuration * 0.85, velocity: 75 },
  ];
}

// ── MATH ROCK ──

function generateMathRockMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const octUp = clamp(startPitch + 12);
  const fifth = clamp(startPitch + 7);

  // Repetitive precision riffs — octave patterns, tight staccato
  const patterns = [
    // Pattern A: root-octave-root-octave (power feel)
    [
      { pitch: startPitch, time: 0, dur: 0.2, vel: 100 },
      { pitch: octUp, time: 0.5, dur: 0.2, vel: 90 },
      { pitch: startPitch, time: 1, dur: 0.2, vel: 100 },
      { pitch: octUp, time: 1.5, dur: 0.2, vel: 90 },
      { pitch: startPitch, time: 2, dur: 0.2, vel: 100 },
      { pitch: fifth, time: 2.5, dur: 0.2, vel: 85 },
      { pitch: startPitch, time: 3, dur: 0.2, vel: 95 },
      { pitch: octUp, time: 3.5, dur: 0.2, vel: 90 },
    ],
    // Pattern B: angular staccato 16ths
    [
      { pitch: startPitch, time: 0, dur: 0.2, vel: 100 },
      { pitch: startPitch, time: 0.25, dur: 0.2, vel: 85 },
      { pitch: fifth, time: 0.75, dur: 0.2, vel: 90 },
      { pitch: startPitch, time: 1.25, dur: 0.2, vel: 95 },
      { pitch: octUp, time: 2, dur: 0.2, vel: 90 },
      { pitch: fifth, time: 2.5, dur: 0.2, vel: 85 },
      { pitch: startPitch, time: 3, dur: 0.2, vel: 100 },
      { pitch: octUp, time: 3.25, dur: 0.2, vel: 85 },
    ],
    // Pattern C: pedal with accents
    [
      { pitch: startPitch, time: 0, dur: 0.2, vel: 100 },
      { pitch: startPitch, time: 0.5, dur: 0.2, vel: 80 },
      { pitch: startPitch, time: 1, dur: 0.2, vel: 80 },
      { pitch: fifth, time: 1.5, dur: 0.2, vel: 90 },
      { pitch: startPitch, time: 2, dur: 0.2, vel: 100 },
      { pitch: startPitch, time: 2.5, dur: 0.2, vel: 80 },
      { pitch: octUp, time: 3, dur: 0.2, vel: 95 },
      { pitch: startPitch, time: 3.5, dur: 0.2, vel: 85 },
    ],
  ];

  const chosen = patterns[Math.floor(_rng() * patterns.length)];
  return chosen.map(n => ({
    pitch: n.pitch,
    time: chord.time + n.time * beatDuration,
    duration: n.dur * beatDuration,
    velocity: n.vel,
  }));
}

// ── IDM ──

function generateIdmMeasure(
  chord: ChordEvent,
  beatDuration: number,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const fifth = clamp(rootMidi + 7);
  const octBelow = clamp(rootMidi - 12);

  // Sub-bass pedal: sustained root, occasional octave drop
  if (_rng() < 0.5) {
    // Just root, sustained whole note
    return [
      { pitch: rootMidi, time: chord.time, duration: beatDuration * 3.8, velocity: 60 },
    ];
  }
  if (_rng() < 0.5) {
    // Root + octave below drop
    return [
      { pitch: rootMidi, time: chord.time, duration: beatDuration * 1.8, velocity: 60 },
      { pitch: octBelow, time: chord.time + beatDuration * 2, duration: beatDuration * 1.8, velocity: 55 },
    ];
  }
  // Root + fifth
  return [
    { pitch: rootMidi, time: chord.time, duration: beatDuration * 2.5, velocity: 60 },
    { pitch: fifth, time: chord.time + beatDuration * 3, duration: beatDuration * 0.8, velocity: 50 },
  ];
}

// ── HOLDSWORTH ──
// Jimmy Johnson style: melodic counterpoint, wide intervals, chord tones
// with pedal options. Not traditional walking — articulated, staccato.

function generateHoldsworthMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const _scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;

  const third = chordTones.length > 1
    ? clamp(startPitch + (chordTones[1] - chordTones[0]))
    : clamp(startPitch + 4);
  const fifth = chordTones.length > 2
    ? clamp(startPitch + (chordTones[2] - chordTones[0]))
    : clamp(startPitch + 7);
  const seventh = chordTones.length > 3
    ? clamp(startPitch + (chordTones[3] - chordTones[0]))
    : clamp(startPitch + 10);
  const ninth = clamp(startPitch + 14);
  const eleventh = clamp(startPitch + 17);

  const r = _rng();
  let notes: BassNote[];

  // 20% pedal tone with chromatic approach — Johnson anchoring
  if (r < 0.20) {
    const pickup = clamp(startPitch + (_rng() < 0.5 ? -1 : 2));
    notes = [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 2.8, velocity: 80 },
      { pitch: pickup, time: chord.time + beatDuration * 3, duration: beatDuration * 0.5, velocity: 65 },
      { pitch: startPitch, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.4, velocity: 60 },
    ];
  // 20% wide leap counterpoint: root → 7th → 3rd (Jimmy Johnson skip motion)
  } else if (r < 0.40) {
    notes = [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.7, velocity: 85 },
      { pitch: seventh, time: chord.time + beatDuration * 1.25, duration: beatDuration * 0.6, velocity: 72 },
      { pitch: third, time: chord.time + beatDuration * 2.5, duration: beatDuration * 0.7, velocity: 78 },
    ];
  // 20% upper structure: 9th and 11th extensions (harmonic sophistication)
  } else if (r < 0.60) {
    notes = [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.5, velocity: 82 },
      { pitch: fifth, time: chord.time + beatDuration * 1, duration: beatDuration * 0.5, velocity: 72 },
      { pitch: ninth, time: chord.time + beatDuration * 2, duration: beatDuration * 0.5, velocity: 68 },
      { pitch: eleventh, time: chord.time + beatDuration * 3, duration: beatDuration * 0.5, velocity: 62 },
    ];
  // 20% chromatic approach line — leading into next bar
  } else if (r < 0.80) {
    const chromTarget = clamp(startPitch + (_rng() < 0.5 ? 7 : 12));
    const chrom1 = clamp(chromTarget - 2);
    const chrom2 = clamp(chromTarget - 1);
    notes = [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 1.5, velocity: 82 },
      { pitch: chrom1, time: chord.time + beatDuration * 2, duration: beatDuration * 0.45, velocity: 70 },
      { pitch: chrom2, time: chord.time + beatDuration * 2.75, duration: beatDuration * 0.45, velocity: 68 },
      { pitch: chromTarget, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.4, velocity: 65 },
    ];
  // 20% syncopated staccato groove — short, punchy, rhythmic
  } else {
    notes = [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.4, velocity: 85 },
      { pitch: fifth, time: chord.time + beatDuration * 0.75, duration: beatDuration * 0.35, velocity: 72 },
      { pitch: third, time: chord.time + beatDuration * 2, duration: beatDuration * 0.4, velocity: 75 },
      { pitch: startPitch, time: chord.time + beatDuration * 3.25, duration: beatDuration * 0.35, velocity: 68 },
    ];
  }

  // Scale note positions to fill actual measure length (11/8, 7/8, etc.)
  // Patterns assume 4 quarter beats; stretch to actual chord duration when longer
  const assumedLen = beatDuration * 4;
  const measureLen = chord.duration > 0 ? chord.duration : assumedLen;
  if (measureLen > assumedLen * 1.1) {
    const scale = measureLen / assumedLen;
    for (const n of notes) {
      n.time = chord.time + (n.time - chord.time) * scale;
      n.duration *= scale;
    }
  }

  return notes;
}

// ── ALFA MIST ──
// Kaya Thomas-Dyke style: upright + electric bass, root-based with chromatic
// approaches and melodic fills. Locks with Dilla-influenced kick placement.
// Supportive role — "rock-solid low end" (Bring Backs review).
// NOT walking bass — syncopated groove with jazz color tones.

function generateAlfaMistMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  // Electric patterns use higher register (MIDI 43-48 center vs upright 36-43)
  // Kaya Thomas-Dyke's electric bass sits higher than her upright work.
  const electricPitch = startPitch < 43 ? clamp(startPitch + 12) : startPitch;
  const fifth = chordTones.length > 2
    ? clamp(startPitch + (chordTones[2] - chordTones[0]))
    : clamp(startPitch + 7);
  const electricFifth = chordTones.length > 2
    ? clamp(electricPitch + (chordTones[2] - chordTones[0]))
    : clamp(electricPitch + 7);
  const third = chordTones.length > 1
    ? clamp(startPitch + (chordTones[1] - chordTones[0]))
    : clamp(startPitch + 3);
  const electricThird = chordTones.length > 1
    ? clamp(electricPitch + (chordTones[1] - chordTones[0]))
    : clamp(electricPitch + 3);

  const r = _rng();

  // 15% syncopated root groove: locks with broken-beat kick, dotted-eighth feel
  if (r < 0.15) {
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.75, velocity: 85 },
      { pitch: startPitch, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.4, velocity: 68 },
      { pitch: fifth, time: chord.time + beatDuration * 2.75, duration: beatDuration * 0.5, velocity: 75 },
    ];
  }

  // 15% chromatic approach fill: root → chromatic below third → third → root
  if (r < 0.30) {
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.7, velocity: 85 },
      { pitch: clamp(third - 1), time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.3, velocity: 62 },
      { pitch: third, time: chord.time + beatDuration * 2.25, duration: beatDuration * 0.5, velocity: 75 },
      { pitch: startPitch, time: chord.time + beatDuration * 3.25, duration: beatDuration * 0.5, velocity: 70 },
    ];
  }

  // 15% upright sustained pedal: long root note, breathing space (sparse, deep)
  if (r < 0.45) {
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 3.2, velocity: 78 },
      { pitch: fifth, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.4, velocity: 60 },
    ];
  }

  // 15% dead note groove (ELECTRIC register): ghost root + accent (hip-hop bass)
  // Kaya Thomas-Dyke electric — sits higher, more funky articulation.
  if (r < 0.60) {
    return [
      { pitch: electricPitch, time: chord.time, duration: beatDuration * 0.6, velocity: 85 },
      { pitch: electricPitch, time: chord.time + beatDuration * 0.75, duration: beatDuration * 0.12, velocity: 38 }, // ghost
      { pitch: electricFifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.5, velocity: 72 },
      { pitch: electricPitch, time: chord.time + beatDuration * 2.5, duration: beatDuration * 0.6, velocity: 80 },
      { pitch: electricPitch, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.12, velocity: 36 }, // ghost
    ];
  }

  // 12% melodic stepwise: root → 3rd → 5th, smooth voice leading (upright character)
  if (r < 0.72) {
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 1.2, velocity: 80 },
      { pitch: third, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.8, velocity: 70 },
      { pitch: fifth, time: chord.time + beatDuration * 2.75, duration: beatDuration * 1.0, velocity: 72 },
    ];
  }

  // 13% anticipation groove (ELECTRIC register): pickup 16th feel
  if (r < 0.85) {
    return [
      { pitch: electricPitch, time: chord.time, duration: beatDuration * 0.5, velocity: 82 },
      { pitch: electricThird, time: chord.time + beatDuration * 1.25, duration: beatDuration * 0.4, velocity: 68 },
      { pitch: electricPitch, time: chord.time + beatDuration * 2, duration: beatDuration * 0.8, velocity: 78 },
      { pitch: clamp(electricPitch - 1), time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.35, velocity: 65 },
    ];
  }

  // 15% driving electric groove (Variables-era energy): urgent rhythm, bouncy 8ths
  // "Urgent driving rhythms" + "funky basslines" (Kaya Thomas-Dyke, Bring Backs/Variables).
  return [
    { pitch: electricPitch, time: chord.time, duration: beatDuration * 0.4, velocity: 90 },
    { pitch: electricPitch, time: chord.time + beatDuration * 0.5, duration: beatDuration * 0.3, velocity: 62 }, // 8th repeat
    { pitch: electricFifth, time: chord.time + beatDuration * 1, duration: beatDuration * 0.4, velocity: 78 },
    { pitch: electricThird, time: chord.time + beatDuration * 1.75, duration: beatDuration * 0.35, velocity: 70 },
    { pitch: electricPitch, time: chord.time + beatDuration * 2.5, duration: beatDuration * 0.5, velocity: 85 },
    { pitch: clamp(electricPitch - 2), time: chord.time + beatDuration * 3.25, duration: beatDuration * 0.3, velocity: 68 }, // chromatic approach
    { pitch: clamp(electricPitch - 1), time: chord.time + beatDuration * 3.75, duration: beatDuration * 0.2, velocity: 72 }, // leading tone
  ];
}

// ── PAT METHENY (Jaco Pastorius) ──
// Melodic counterpoint — bass as second melody voice, NOT walking.
// Fretless singing quality, 16th-note runs, wide intervals, harmonics.
// Quarter-note triplet motifs, trills outlining arpeggios.
// Research: Bright Size Life bass transcriptions, Jaco Pastorius Method.

function generateMethenyMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const _scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const fifth = chordTones.length > 2
    ? clamp(startPitch + (chordTones[2] - chordTones[0]))
    : clamp(startPitch + 7);
  const third = chordTones.length > 1
    ? clamp(startPitch + (chordTones[1] - chordTones[0]))
    : clamp(startPitch + 4);
  const seventh = chordTones.length > 3
    ? clamp(startPitch + (chordTones[3] - chordTones[0]))
    : clamp(startPitch + 11);

  const r = _rng();

  // 20% singing melody: root → 5th → octave (wide leaps, fretless singing)
  if (r < 0.20) {
    const octave = clamp(startPitch + 12);
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 1.2, velocity: 82 },
      { pitch: fifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.8, velocity: 75 },
      { pitch: octave, time: chord.time + beatDuration * 2.75, duration: beatDuration * 1.0, velocity: 70 },
    ];
  }

  // 20% 16th-note run: chromatic approach into chord tone (Jaco virtuosity)
  if (r < 0.40) {
    const approach1 = clamp(third - 2);
    const approach2 = clamp(third - 1);
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 0.8, velocity: 82 },
      { pitch: approach1, time: chord.time + beatDuration * 1.25, duration: beatDuration * 0.2, velocity: 65 },
      { pitch: approach2, time: chord.time + beatDuration * 1.5, duration: beatDuration * 0.2, velocity: 68 },
      { pitch: third, time: chord.time + beatDuration * 1.75, duration: beatDuration * 0.8, velocity: 78 },
      { pitch: fifth, time: chord.time + beatDuration * 3, duration: beatDuration * 0.7, velocity: 72 },
    ];
  }

  // 20% quarter-note triplet motif (Jaco signature from Bright Size Life solo)
  if (r < 0.60) {
    const tripletDur = beatDuration * (2 / 3);
    return [
      { pitch: startPitch, time: chord.time, duration: tripletDur * 0.9, velocity: 80 },
      { pitch: third, time: chord.time + tripletDur, duration: tripletDur * 0.9, velocity: 75 },
      { pitch: fifth, time: chord.time + tripletDur * 2, duration: tripletDur * 0.9, velocity: 72 },
      { pitch: seventh, time: chord.time + beatDuration * 2.5, duration: beatDuration * 1.2, velocity: 70 },
    ];
  }

  // 20% sustained pedal + melodic pickup (fretless sustain, slide feel)
  if (r < 0.80) {
    return [
      { pitch: startPitch, time: chord.time, duration: beatDuration * 2.5, velocity: 78 },
      { pitch: clamp(startPitch + 2), time: chord.time + beatDuration * 3, duration: beatDuration * 0.3, velocity: 62 },
      { pitch: fifth, time: chord.time + beatDuration * 3.5, duration: beatDuration * 0.4, velocity: 68 },
    ];
  }

  // 20% arpeggio outline: root → 3rd → 7th → 5th (wide intervals, melodic)
  return [
    { pitch: startPitch, time: chord.time, duration: beatDuration * 0.7, velocity: 82 },
    { pitch: third, time: chord.time + beatDuration * 1, duration: beatDuration * 0.6, velocity: 75 },
    { pitch: seventh, time: chord.time + beatDuration * 2, duration: beatDuration * 0.6, velocity: 70 },
    { pitch: fifth, time: chord.time + beatDuration * 3, duration: beatDuration * 0.7, velocity: 72 },
  ];
}

/** Infer time signature from measure duration and beat duration. */
function inferTimeSignature(measureDuration: number, beatDuration: number): [number, number] {
  const beats = measureDuration / beatDuration;
  // Check common signatures (allow ±0.1 tolerance for floating point)
  if (Math.abs(beats - 4) < 0.1) return [4, 4];
  if (Math.abs(beats - 3) < 0.1) return [3, 4];
  if (Math.abs(beats - 5) < 0.1) return [5, 4];
  if (Math.abs(beats - 6) < 0.1) return [6, 4];
  if (Math.abs(beats - 7) < 0.1) return [7, 4];
  if (Math.abs(beats - 3.5) < 0.1) return [7, 8];
  if (Math.abs(beats - 4.5) < 0.1) return [9, 8];
  if (Math.abs(beats - 5.5) < 0.1) return [11, 8];
  return [4, 4]; // fallback
}

// ── ODD METER BASS ──

/**
 * Generate bass for 5/4: 5 walking quarter notes per bar.
 * Grouping: 3+2 — root on 1, chord tone on 2, passing on 3, approach on 4-5.
 */
function generate5_4Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);
  const ascending = target >= startPitch;

  const patterns = ascending ? ASCENDING_PATTERNS : DESCENDING_PATTERNS;
  const pat = patterns[Math.floor(_rng() * patterns.length)];

  // 5 notes: R, scale, scale, passing, approach
  const pitches: number[] = [startPitch];

  // Beat 2-3: scale degrees
  for (let j = 1; j <= 2; j++) {
    const deg = pat[Math.min(j, pat.length - 1)];
    if (deg === 99) {
      pitches.push(approachTone(target, !ascending, scaleTones));
    } else {
      pitches.push(scaleDegreeToMidi(startPitch, deg, scaleTones));
    }
  }

  // Beat 4: passing tone toward target
  const prev = pitches[pitches.length - 1];
  const mid = passingTone(prev, target, scaleTones, getChordTones(chord.root, chord.quality));
  pitches.push(mid);

  // Beat 5: chromatic approach
  pitches.push(approachTone(target, prev > target, scaleTones));

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: i === 4 ? beatDuration * 0.6 : beatDuration * 0.9,
    velocity: i === 0 ? 100 : i === 4 ? 70 : 85,
  }));
}

/**
 * Generate bass for 7/8 (3.5 quarter-note beats).
 * Grouping: 2+2+3 eighth notes → root, chord tone, approach (with pickup).
 */
function generate7_8Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const fifth = clamp(startPitch + 7);
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);

  // 3 main notes: root (beat 1), chord tone (beat 2), approach (beat 3)
  return [
    { pitch: startPitch, time: chord.time, duration: beatDuration * 0.9, velocity: 95 },
    { pitch: fifth, time: chord.time + beatDuration * 1, duration: beatDuration * 0.9, velocity: 80 },
    { pitch: approachTone(target, startPitch > target), time: chord.time + beatDuration * 2, duration: beatDuration * 1.3, velocity: 75 },
  ];
}

/**
 * Generate bass for 6/8 (3 quarter-note beats, compound).
 * Two dotted-quarter groups: root + 5th.
 */
function generate6_8Measure(
  chord: ChordEvent,
  beatDuration: number,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const fifth = clamp(rootMidi + 7);

  return [
    { pitch: rootMidi, time: chord.time, duration: beatDuration * 1.4, velocity: 95 },
    { pitch: fifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 1.4, velocity: 80 },
  ];
}

/**
 * Generate bass for 9/8 (4.5 quarter-note beats).
 * 3 groups of 3 eighth notes.
 */
function generate9_8Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const fifth = clamp(startPitch + 7);
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);

  return [
    { pitch: startPitch, time: chord.time, duration: beatDuration * 1.4, velocity: 95 },
    { pitch: fifth, time: chord.time + beatDuration * 1.5, duration: beatDuration * 1.4, velocity: 80 },
    { pitch: approachTone(target, startPitch > target), time: chord.time + beatDuration * 3, duration: beatDuration * 1.3, velocity: 75 },
  ];
}

/**
 * Generate bass for 6/4 (6 quarter-note beats).
 * Walking: 6 quarter notes per bar.
 */
function generate6_4Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);
  const ascending = target >= startPitch;

  const pitches: number[] = [startPitch];
  // Walk up/down scale for beats 2-5, approach on 6
  for (let j = 1; j <= 4; j++) {
    const prev = pitches[pitches.length - 1];
    const near = scaleTones
      .filter(t => ascending ? (t > prev && t <= prev + 4) : (t < prev && t >= prev - 4))
      .sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
    pitches.push(near.length > 0 ? near[0] : clamp(prev + (ascending ? 2 : -2)));
  }
  pitches.push(approachTone(target, !ascending, scaleTones));

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: i === 5 ? beatDuration * 0.6 : beatDuration * 0.9,
    velocity: i === 0 ? 100 : i === 5 ? 70 : 85,
  }));
}

/**
 * Generate bass for 7/4 (7 quarter-note beats).
 * Walking: 7 quarter notes, grouping 4+3.
 */
function generate7_4Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);
  const ascending = target >= startPitch;

  const pitches: number[] = [startPitch];
  for (let j = 1; j <= 5; j++) {
    const prev = pitches[pitches.length - 1];
    const near = scaleTones
      .filter(t => ascending ? (t > prev && t <= prev + 4) : (t < prev && t >= prev - 4))
      .sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
    pitches.push(near.length > 0 ? near[0] : clamp(prev + (ascending ? 2 : -2)));
  }
  pitches.push(approachTone(target, !ascending, scaleTones));

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: i === 6 ? beatDuration * 0.6 : beatDuration * 0.9,
    velocity: i === 0 ? 100 : i === 6 ? 70 : 85,
  }));
}

/**
 * Generate bass for 11/8 (5.5 quarter-note beats).
 * Proper 2+2+3+2+2 eighth-note grouping: 5 notes at group onsets (eighths 0, 2, 4, 7, 9).
 * Uses chord/scale tones with dissonance filtering, not hardcoded intervals.
 */
function generate11_8Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi;
  const nextRoot = nextChord ? rootToMidi(nextChord.root) : rootMidi;
  const target = closestOctave(nextRoot, startPitch);

  const eighth = beatDuration / 2;
  // 2+2+3+2+2 grouping → onsets at eighth positions 0, 2, 4, 7, 9
  const onsets = [0, 2, 4, 7, 9].map(e => chord.time + e * eighth);
  const groupDurs = [2, 2, 3, 2, 2].map(g => g * eighth * 0.85);

  // Note 1: root (strong downbeat anchor)
  const p1 = startPitch;
  // Note 2: chord tone (3rd or 5th, variety via pick)
  const ct = filterDissonant(chordTones.filter(t => t !== p1 && Math.abs(t - p1) <= 7), p1);
  const p2 = ct.length > 0 ? pick(ct) : clamp(p1 + 3);
  // Note 3 (long group): scale tone bridging toward target
  const p3 = passingTone(p2, target, scaleTones, chordTones);
  // Note 4: scale/chord tone stepping toward approach
  const p4Cand = filterDissonant(
    scaleTones.filter(t => Math.abs(t - target) <= 4 && t !== p3 && t !== target),
    startPitch,
  );
  const p4 = p4Cand.length > 0 ? pick(p4Cand) : clamp(target + (_rng() < 0.5 ? 2 : -2));
  // Note 5: approach to next root
  const p5 = approachTone(target, p4 > target);

  const pitches = [p1, p2, p3, p4, p5];
  const velocities = [95, 80, 75, 72, 70];

  return pitches.map((p, i) => ({
    pitch: p,
    time: onsets[i],
    duration: groupDurs[i],
    velocity: velocities[i],
  }));
}

/**
 * Select odd-meter bass generator based on time signature.
 * Returns null for 4/4 (use style-specific generator).
 */
function generateOddMeterBass(
  timeSig: [number, number],
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] | null {
  const [n, d] = timeSig;
  if (n === 5 && d === 4) return generate5_4Measure(chord, nextChord, beatDuration, prevPitch);
  if (n === 7 && d === 8) return generate7_8Measure(chord, nextChord, beatDuration, prevPitch);
  if (n === 6 && d === 8) return generate6_8Measure(chord, beatDuration);
  if (n === 9 && d === 8) return generate9_8Measure(chord, nextChord, beatDuration, prevPitch);
  if (n === 6 && d === 4) return generate6_4Measure(chord, nextChord, beatDuration, prevPitch);
  if (n === 7 && d === 4) return generate7_4Measure(chord, nextChord, beatDuration, prevPitch);
  if (n === 11 && d === 8) return generate11_8Measure(chord, nextChord, beatDuration, prevPitch);
  return null; // not an odd meter, use style default
}

// ── Main Generator ──

/**
 * Generate a walking bass line from a sequence of chord events.
 * Returns MIDI note events ready for Tone.js scheduling.
 */
export function generateWalkingBass(
  chords: ChordEvent[],
  options: WalkingBassOptions = {},
): BassNote[] {
  if (chords.length === 0) return [];
  const prevRng = _rng;
  const prevGranular = _bassGranular;
  _rng = options.random ?? Math.random;
  _bassGranular = options.granular;

  const style = options.style ?? "swing";
  const tempo = options.tempo ?? 120;
  if (tempo <= 0) { _rng = prevRng; _bassGranular = prevGranular; throw new RangeError(`tempo must be > 0, got ${tempo}`); }
  const humanize = options.humanize ?? false;
  const beatDuration = 60 / tempo;

  const notes: BassNote[] = [];
  const beat1Indices = new Set<number>(); // indices of beat-1 notes (root/5th, must not be changed)
  let prevPitch: number | null = null;
  let prevDirection: "up" | "down" | null = null; // two-bar phrasing: track contour direction

  // Detect time signature for odd-meter handling
  const _timeSig: [number, number] | undefined = options.measureInfo
    ? undefined // will use style-specific generators
    : undefined;
  // Infer time signature from chord durations if available
  const inferredTimeSig = chords.length > 0
    ? inferTimeSignature(chords[0].duration, beatDuration)
    : [4, 4] as [number, number];

  // ── Musicality: Phrase Intent Awareness ──
  const bandCtx = options.bandContext;
  const conversation = (bandCtx?.conversation ?? 30) / 100;
  const measureDuration = options.measureInfo?.measureDuration ?? (chords.length > 0 ? chords[0].duration : beatDuration * 4);

  for (let i = 0; i < chords.length; i++) {
    const chord = chords[i];
    const nextChord = i < chords.length - 1 ? chords[i + 1] : null;

    // ── Phrase Intent: Air Gaps and Drops ──
    const measureIdx = Math.floor(chord.time / measureDuration);
    const phraseIntent = bandCtx?.phraseMap?.intents?.length
      ? lookupBassIntent(measureIdx, bandCtx.phraseMap)
      : null;

    // Intent-driven bass rest: extremely rare but powerful (bass drops out)
    if (phraseIntent?.bassRests?.includes(measureIdx)) {
      // Complete silence — no bass for this measure
      continue;
    }

    // Intent-driven drop: play only a sustained pedal root (very quiet)
    if (phraseIntent?.dropMeasures?.includes(measureIdx)) {
      const dropRoot: number = rootToMidi(chord.root);
      const dropPitch: number = prevPitch !== null ? closestOctave(dropRoot, prevPitch) : dropRoot;
      const pedalNote: BassNote = {
        pitch: dropPitch,
        time: chord.time,
        duration: chord.duration * 0.9,
        velocity: 50,
      };
      beat1Indices.add(notes.length);
      notes.push(pedalNote);
      prevPitch = dropPitch;
      continue;
    }

    // Conversation: when bass is "listening" (not the leader), play sparser
    const isLeader = phraseIntent?.conversationLeader === "bass";
    const isListening = phraseIntent?.conversationLeader != null && !isLeader;

    let measureNotes: BassNote[];

    // Try odd-meter generator first (overrides style for non-standard meters).
    // Styles with rich dedicated generators (alfaMist, holdsworth, metheny, neoSoul)
    // keep their own patterns in odd meters — notes fit within the measure and the
    // extra beats provide natural breathing room. Generic odd-meter patterns are too
    // bland for these styles.
    const STYLE_OWNS_ODD_METER = new Set(["alfaMist", "holdsworth", "metheny", "neoSoul"]);
    const useOddMeter = !STYLE_OWNS_ODD_METER.has(style);
    const oddMeterNotes = useOddMeter ? generateOddMeterBass(inferredTimeSig, chord, nextChord, beatDuration, prevPitch) : null;
    if (oddMeterNotes && !(inferredTimeSig[0] === 4 && inferredTimeSig[1] === 4) && !(inferredTimeSig[0] === 3 && inferredTimeSig[1] === 4 && style === "jazzWaltz")) {
      measureNotes = oddMeterNotes;
    } else switch (style) {
      case "bossa":
        measureNotes = generateBossaMeasure(chord, beatDuration, prevPitch);
        break;
      case "latin":
        measureNotes = generateLatinMeasure(chord, beatDuration, prevPitch);
        break;
      case "fusion":
        measureNotes = generateFusionMeasure(chord, beatDuration, prevPitch);
        break;
      case "ecm":
        measureNotes = generateEcmMeasure(chord, beatDuration);
        break;
      case "hardBop":
        measureNotes = generateHardBopMeasure(chord, nextChord, beatDuration, prevPitch, prevDirection);
        break;
      case "coolJazz":
        measureNotes = generateCoolJazzMeasure(chord, nextChord, beatDuration, prevPitch, prevDirection);
        break;
      case "modal":
        measureNotes = generateModalMeasure(chord, beatDuration);
        break;
      case "jazzWaltz":
        measureNotes = generateJazzWaltzMeasure(chord, nextChord, beatDuration, prevPitch, prevDirection);
        break;
      case "shuffleBlues":
        measureNotes = generateShuffleBluesMeasure(chord, nextChord, beatDuration, prevPitch);
        break;
      case "neoSoul":
        measureNotes = generateNeoSoulMeasure(chord, beatDuration, prevPitch);
        break;
      case "contemporaryJazz":
        measureNotes = generateContemporaryJazzMeasure(chord, nextChord, beatDuration, prevPitch);
        break;
      case "mathRock":
        measureNotes = generateMathRockMeasure(chord, beatDuration, prevPitch);
        break;
      case "idm":
        measureNotes = generateIdmMeasure(chord, beatDuration);
        break;
      case "holdsworth":
        measureNotes = generateHoldsworthMeasure(chord, beatDuration, prevPitch);
        break;
      case "alfaMist":
        measureNotes = generateAlfaMistMeasure(chord, beatDuration, prevPitch);
        break;
      case "metheny":
        measureNotes = generateMethenyMeasure(chord, beatDuration, prevPitch);
        break;
      case "swing":
      default:
        measureNotes = generateSwingMeasure(chord, nextChord, beatDuration, prevPitch, options.swingAmount, tempo, style, prevDirection);
        break;
    }

    // Trim notes that overflow chord duration (prevents rapid-fire on short chords).
    // Allow one beat of slack for syncopated anticipation notes (latin/fusion).
    if (chord.duration > 0 && measureNotes.length > 1) {
      const chordEnd = chord.time + chord.duration;
      measureNotes = measureNotes.filter(n => n.time < chordEnd + beatDuration * 0.6);
    }

    // Fix cross-bar repeats: if first note of new bar = last note of prev bar,
    // nudge the approach note (prev bar beat 4) by 1 semitone
    if (notes.length > 0 && measureNotes.length > 0 &&
        measureNotes[0].pitch === notes[notes.length - 1].pitch) {
      const prev = notes[notes.length - 1];
      // Move approach 1 semitone away from beat 1 (chromatic approach from other side)
      prev.pitch = clamp(prev.pitch - 1) === measureNotes[0].pitch
        ? clamp(prev.pitch + 1)
        : clamp(prev.pitch - 1);
    }

    // Enforce stepwise motion within measure (max 5 semitone jump between beats)
    constrainStepwise(measureNotes);

    // Style-biased humanization via groove templates
    if (humanize) {
      const template = getGrooveTemplate(style ?? "swing");
      for (let ni = 0; ni < measureNotes.length; ni++) {
        const n = measureNotes[ni];
        const isOffbeat = ni % 2 !== 0;
        const element = isOffbeat ? template.bassOffbeat : template.bass;
        n.time = applyGroove(n.time, element, _rng);
        n.velocity = Math.max(40, Math.min(127, n.velocity + Math.floor((_rng() - 0.5) * 10)));
      }
    }

    // Drums-first: snap beat 1/3 toward nearest kick for tight pocket
    if (options.kickTimes && options.kickTimes.length > 0) {
      for (let ni = 0; ni < measureNotes.length; ni++) {
        if (ni % 2 !== 0) continue; // only downbeats (0, 2)
        const n = measureNotes[ni];
        let bestDist = Infinity;
        let bestKick = n.time;
        for (const kt of options.kickTimes) {
          const dist = Math.abs(n.time - kt);
          if (dist < bestDist) { bestDist = dist; bestKick = kt; }
          if (kt > n.time + 0.02) break; // sorted, no need to look further
        }
        if (bestDist < 0.015) n.time = bestKick; // snap within 15ms
      }
    }

    // Dynamic arc: scale velocity by chorus position
    // Conversation + arc awareness apply even without measureInfo (standalone calls)
    const convMult = isLeader ? 1 + 0.15 * conversation : isListening ? 1 - 0.25 * conversation : 1.0;
    const bassArc = phraseIntent?.arc;
    const arcMult = bassArc === "climax" ? 1.12
      : bassArc === "build" ? 1.05
      : bassArc === "release" ? 0.9
      : bassArc === "drop" ? 0.78
      : 1.0;
    if (options.measureInfo) {
      const mIdx = Math.floor(chord.time / (options.measureInfo.measureDuration || 1));
      const dynMult = dynamicMultiplier(mIdx, options.measureInfo.totalMeasures, style, options.measureInfo.sections);
      const hasSectionDynamics = options.measureInfo.sections && options.measureInfo.sections.length > 0;
      const energyMult = (options.bandContext && !hasSectionDynamics) ? (0.75 + options.bandContext.sectionEnergy * 0.25) : 1.0;
      for (const n of measureNotes) {
        n.velocity = Math.min(127, Math.max(40, Math.round(n.velocity * dynMult * energyMult * convMult * arcMult)));
      }
    } else if (convMult !== 1.0 || arcMult !== 1.0) {
      for (const n of measureNotes) {
        n.velocity = Math.min(127, Math.max(40, Math.round(n.velocity * convMult * arcMult)));
      }
    }

    // Track contour direction for two-bar phrasing
    if (measureNotes.length >= 2) {
      const first = measureNotes[0].pitch;
      const last = measureNotes[measureNotes.length - 1].pitch;
      prevDirection = last > first ? "up" : last < first ? "down" : prevDirection;
    }

    beat1Indices.add(notes.length); // first note of this measure = beat 1
    notes.push(...measureNotes);
    if (measureNotes.length > 0) {
      prevPitch = measureNotes[measureNotes.length - 1].pitch;
    }
  }

  // Final dedup: no repeated adjacent pitches (enclosures / cross-bar nudging can create them).
  // Never change beat 1 notes (root/5th invariant). Run multiple passes for convergence.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 1; i < notes.length; i++) {
      if (notes[i].pitch !== notes[i - 1].pitch) continue;
      // Determine which note to nudge: never beat 1, prefer earlier (approach) note
      const nudgeIdx = beat1Indices.has(i) ? i - 1
        : beat1Indices.has(i - 1) ? i
        : i - 1; // default: nudge earlier
      const otherIdx = nudgeIdx === i ? i - 1 : i;
      const neighbor = nudgeIdx >= 1 && nudgeIdx - 1 !== otherIdx ? notes[nudgeIdx - 1].pitch : -1;
      const neighbor2 = nudgeIdx < notes.length - 1 && nudgeIdx + 1 !== otherIdx ? notes[nudgeIdx + 1].pitch : -1;
      const down = clamp(notes[nudgeIdx].pitch - 1);
      const up = clamp(notes[nudgeIdx].pitch + 1);
      if (down !== notes[otherIdx].pitch && down !== neighbor && down !== neighbor2) {
        notes[nudgeIdx].pitch = down;
        changed = true;
      } else if (up !== notes[otherIdx].pitch && up !== neighbor && up !== neighbor2) {
        notes[nudgeIdx].pitch = up;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Monophonic enforcement: bass plays one note at a time.
  // Each note sustains until the next one starts (no overlap, no gap).
  for (let i = 0; i < notes.length - 1; i++) {
    notes[i].duration = notes[i + 1].time - notes[i].time;
  }

  _rng = prevRng;
  _bassGranular = prevGranular;
  return notes;
}

// ── Phrase Intent Lookup (bass-side) ──
function lookupBassIntent(measure: number, phraseMap: { boundaries: number[]; intents?: PhraseIntent[] }): PhraseIntent | null {
  if (!phraseMap.intents || phraseMap.intents.length === 0) return null;
  for (let i = phraseMap.boundaries.length - 1; i >= 0; i--) {
    if (measure >= phraseMap.boundaries[i]) {
      return phraseMap.intents[i] ?? null;
    }
  }
  return null;
}

/**
 * Convert QuantizedScore chord progression into ChordEvent array.
 * Convenience helper for connecting import → practice flow.
 */
export function scoreChordsToEvents(
  measures: { chords: { root: string; quality: string; startTime: number }[]; startTime: number; endTime: number }[],
): ChordEvent[] {
  const events: ChordEvent[] = [];

  for (const measure of measures) {
    if (measure.chords.length === 0) continue;

    for (let ci = 0; ci < measure.chords.length; ci++) {
      const chord = measure.chords[ci];
      const nextChord = measure.chords[ci + 1];
      const endTime = nextChord ? nextChord.startTime : measure.endTime;

      events.push({
        root: chord.root,
        quality: chord.quality,
        time: chord.startTime,
        duration: endTime - chord.startTime,
      });
    }
  }

  return events;
}
