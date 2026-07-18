/** Bass odd-meter generators and time signature inference. Extracted from walkingBass.ts for G29. */

import type { BassNote, ChordEvent } from "./types";
import {
  _rng,
  rootToMidi, getChordTones, getScaleTones,
  approachTone, passingTone, clamp, pick, filterDissonant,
  scaleDegreeToMidi, nudgeTowardTarget, closestOctave,
  ASCENDING_PATTERNS, DESCENDING_PATTERNS,
} from "./bassHelpers";

/** Infer time signature from measure duration and beat duration. */
export function inferTimeSignature(measureDuration: number, beatDuration: number): [number, number] {
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

/**
 * Generate bass for 5/4: 5 walking quarter notes per bar.
 * Grouping: 3+2 — root on 1, chord tone on 2, passing on 3, approach on 4-5.
 */
export function generate5_4Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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
export function generate7_8Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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
export function generate6_8Measure(
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
export function generate9_8Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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
export function generate6_4Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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
export function generate7_4Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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
export function generate11_8Measure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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
export function generateOddMeterBass(
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
