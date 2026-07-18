/** Bass style generators - per-style measure generation. Extracted from walkingBass.ts for G29. */

import { tempoSwingMultiplier, instrumentSwingFactor } from "./swingUtils";
import { enclosureProb } from "./probabilityMapping";
import type { BassNote, ChordEvent, PhraseArc } from "./types";
import {
  _rng, _bassGranular, _bassEnergy,
  rootToMidi, getChordTones, getScaleTones,
  approachTone, passingTone, clamp, pick, filterDissonant,
  scaleDegreeToMidi, nudgeTowardTarget, closestOctave, recordAndReturn,
  getBassLow, getBassHigh,
} from "./bassHelpers";

export function generateSwingMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
  swingAmount?: number,
  tempo?: number,
  style?: string,
  prevDirection?: "up" | "down" | null,
  arc?: PhraseArc,
): BassNote[] {
  // Place root in register close to previous note (smooth bar transitions).
  // When a bassTargetPitch is planned, blend between voice-leading proximity
  // and macro register target (soft constraint, 30% weight).
  let rootPitch = rootToMidi(chord.root);
  if (prevPitch !== null) {
    while (rootPitch < prevPitch - 6) rootPitch += 12;
    while (rootPitch > prevPitch + 6) rootPitch -= 12;
    rootPitch = nudgeTowardTarget(clamp(rootPitch));
  }
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const chordTones = getChordTones(chord.root, chord.quality);
  const isLastChord = !nextChord;

  // ── Contour-based approach: compute beat 4 (target) FIRST ──

  // Beat 1: root ~65%, 5th ~25%, 3rd ~10% (varies by style).
  // Non-root beat 1 creates motion and avoids the "MIDI bass" plodding feel.
  // Real bassists (Ron Carter, Ray Brown) use non-root tones ~30-40% of time.
  //
  // Harmonic-aware adjustment:
  //   - Tonic resolution (I after V): 85% root for strong arrival
  //   - Dominant chord: allow more 3rd/7th for tension
  //   - Default: standard 65/25/10 split
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

  // Harmonic-aware beat 1 thresholds
  const analysis = chord.analysis;
  const isResolution = analysis?.cadenceRole === "resolution"
    || (analysis?.isPartOfIiVI && analysis?.iiViPosition === "I");
  const isDominantChord = analysis?.function === "dominant";
  // Tonic resolution: strong root (85%), diminish non-root to 10/5
  // Dominant chord: allow more variety - root 55%, 5th 25%, 3rd 20%
  const rootThresh = isResolution ? 0.85 : isDominantChord ? 0.55 : 0.65;
  const fifthThresh = isResolution ? 0.95 : isDominantChord ? 0.80 : 0.90;

  // First chord always root (establish tonality)
  if (!prevPitch) {
    beat1 = rootPitch;
  } else if (beat1Roll < rootThresh) {
    beat1 = rootPitch;
  } else if (beat1Roll < fifthThresh) {
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
    // Harmonic-aware approach selection:
    //   V→I: leading tone (half-step below I root) - strongest resolution
    //   ii→V: 5th of V from below or b7 of ii as common tone - sets up dominant
    const isVtoI = analysis?.function === "dominant"
      && nextChord?.analysis?.cadenceRole === "resolution";
    const isIiToV = analysis?.isPartOfIiVI && analysis?.iiViPosition === "ii"
      && nextChord?.analysis?.iiViPosition === "V";
    if (isVtoI && _rng() < 0.45) {
      // Leading tone = one semitone below target
      beat4 = clamp(target - 1);
      recordAndReturn(beat4, target);
    } else if (isIiToV && _rng() < 0.35) {
      // ii→V: approach from a half-step below V root (ascending chromatic)
      // or use the b7 of ii (= 4th of V) for strong voice leading
      beat4 = _rng() < 0.6 ? clamp(target - 1) : clamp(target + 5);
      recordAndReturn(beat4, target);
    } else if (third !== null && (target - third === 1 || target - third === -11)) {
      beat4 = third;
      recordAndReturn(beat4, target);
    } else {
      let fromAbove = beat1 > target;
      if (_rng() < 0.3) fromAbove = !fromAbove;
      const nextScale = nextChord ? getScaleTones(nextChord.root, nextChord.quality) : scaleTones;
      beat4 = approachTone(target, fromAbove, nextScale, style, arc);
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
  const enclosureProbVal = enclosureProb(_bassGranular?.syncopation ?? 37.5) * tempoEnclosureScale;
  const nearBoundary = pitches[3] <= getBassLow() + 2 || pitches[3] >= getBassHigh() - 2;
  const doEnclosure = !isLastChord && !nearBoundary && _rng() < enclosureProbVal;

  if (doEnclosure) {
    const target = pitches[3];
    const above = clamp(target + 1);
    const below = clamp(target - 1);
    if (above !== below && above !== pitches[2] && below !== pitches[2]) {
      const [first, second] = _rng() < 0.5 ? [above, below] : [below, above];

      const beat4Time = chord.time + beatDuration * 3;
      const eighthDur = beatDuration * 0.5;
      const effSwing = (swingAmount ?? 100) * tempoSwingMultiplier(tempo ?? 120, _bassEnergy) * instrumentSwingFactor("bass");
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

export function generateBossaMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch?: number | null,
): BassNote[] {
  const root = rootToMidi(chord.root);
  const rootPitch = nudgeTowardTarget(prevPitch != null ? closestOctave(root, prevPitch) : root);
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

export function generateLatinMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch?: number | null,
): BassNote[] {
  const root = rootToMidi(chord.root);
  const rootPitch = nudgeTowardTarget(prevPitch != null ? closestOctave(root, prevPitch) : root);
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

export function generateFusionMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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

export function generateEcmMeasure(
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

export function generateHardBopMeasure(
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

  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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

  // Beat 4: approach tone (was hardcoded chromatic from below — now uses full vocabulary)
  const nextScale = nextChord ? getScaleTones(nextChord.root, nextChord.quality) : scaleTones;
  // HardBop still favors aggressive chromatic from below (60%), but allows variety
  if (_rng() < 0.6) {
    pitches.push(recordAndReturn(clamp(target - 1), target));
  } else {
    pitches.push(approachTone(target, ascending, nextScale, "hardBop"));
  }

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: i === 3 ? beatDuration * 0.5 : beatDuration * 0.9,
    velocity: i === 0 ? 110 : i === 3 ? 85 : 95,
  }));
}

// ── COOL JAZZ ──

export function generateCoolJazzMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
  prevDirection?: "up" | "down" | null,
): BassNote[] {
  // Smooth walk: softer, longer legato, prefers stepwise motion
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);

  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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

  // Beat 4: gentle approach (was hardcoded chromatic — now uses diatonic-heavy vocabulary)
  const nextScale = nextChord ? getScaleTones(nextChord.root, nextChord.quality) : scaleTones;
  pitches.push(approachTone(target, !ascending, nextScale, "coolJazz"));

  return pitches.map((p, i) => ({
    pitch: p,
    time: chord.time + i * beatDuration,
    duration: beatDuration * 0.95, // long legato
    velocity: i === 0 ? 80 : i === 3 ? 60 : 70,
  }));
}

// ── MODAL ──

export function generateModalMeasure(
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

export function generateJazzWaltzMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
  prevDirection?: "up" | "down" | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);

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

export function generateShuffleBluesMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);

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

// ── NEO-SOUL ──

export function generateNeoSoulMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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

export function generateContemporaryJazzMeasure(
  chord: ChordEvent,
  nextChord: ChordEvent | null,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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

export function generateMathRockMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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

export function generateIdmMeasure(
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

export function generateHoldsworthMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const _scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);

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

export function generateAlfaMistMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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

export function generateMethenyMeasure(
  chord: ChordEvent,
  beatDuration: number,
  prevPitch: number | null,
): BassNote[] {
  const rootMidi = rootToMidi(chord.root);
  const chordTones = getChordTones(chord.root, chord.quality);
  const _scaleTones = getScaleTones(chord.root, chord.quality);
  const startPitch = nudgeTowardTarget(prevPitch !== null ? closestOctave(rootMidi, prevPitch) : rootMidi);
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
