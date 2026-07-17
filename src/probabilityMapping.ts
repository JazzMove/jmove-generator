/**
 * Probability mapping - derives key musical probabilities from style parameters
 * instead of hardcoding them. Each function maps creativity/density/conversation/
 * harmonicFreedom (all 0-100) to a probability (0-1) for specific musical decisions.
 *
 * These replace scattered magic numbers with parameter-driven values, making the
 * generator's behavior tunable without code changes.
 */

// ── Clamp helper ──
function p(val: number): number {
  return Math.max(0, Math.min(1, val));
}

// ── Piano Probabilities ──

/** Probability of piano anticipating next chord on beat 4-and.
 *  harmonicFreedom drives this: conservative (5%) to adventurous (40%). */
export function anticipationProb(harmonicFreedom: number): number {
  return p(0.05 + (harmonicFreedom / 100) * 0.35);
}

/** Probability of inserting a chromatic passing chord between changes.
 *  harmonicFreedom: 0 = never, 100 = 30% chance. */
export function passingChordProb(harmonicFreedom: number): number {
  return p((harmonicFreedom / 100) * 0.30);
}

/** Probability of using a broken voicing (splitting chord into 2+2).
 *  creativity: low = rarely, high = often. */
export function brokenVoicingProb(creativity: number): number {
  return p(0.10 + (creativity / 100) * 0.15);
}

/** Probability of adding a grace note before a chord hit.
 *  creativity: 0 = 5%, 100 = 25%. */
export function graceNoteProb(creativity: number): number {
  return p(0.05 + (creativity / 100) * 0.20);
}

// ── Bass Probabilities ──

/** Probability of beat 1 being root vs non-root (5th or 3rd).
 *  creativity: 0 = 80% root (safe), 100 = 50% root (adventurous). */
export function bassRootProb(creativity: number): number {
  return p(0.80 - (creativity / 100) * 0.30);
}

/** Probability of eighth-note enclosure on beat 4.
 *  Derived from syncopation granular (0-100): 0 = never, 100 = 40%. */
export function enclosureProb(syncopation: number): number {
  return p((syncopation / 100) * 0.40);
}

/** Probability of chromatic passing tone (vs diatonic).
 *  chromaticApproach granular: 0 = mostly diatonic, 100 = mostly chromatic. */
export function chromaticPassingProb(chromaticApproach: number): number {
  return p(0.30 + (chromaticApproach / 100) * 0.50);
}

// ── Drum Probabilities ──

/** Kick-hihat interlock probability.
 *  conversation: high = more interlocking, low = independent. */
export function kickHihatInterlockProb(conversation: number): number {
  return p(0.40 + (conversation / 100) * 0.30);
}

/** Fill probability scaling by fillIntensity granular.
 *  0 = fills very rare, 100 = fills frequent. */
export function fillProbScale(fillIntensity: number): number {
  return Math.max(0.1, fillIntensity / 50); // 0→0.1, 50→1.0, 100→2.0
}

// ── Ensemble Probabilities ──

/** Alignment snap threshold in seconds.
 *  Higher conversation = tighter snap (closer playing). */
export function alignmentThreshold(conversation: number): number {
  // 0 = 20ms (loose), 100 = 10ms (tight)
  return 0.020 - (conversation / 100) * 0.010;
}

/** Probability of instrument dropping for an air gap.
 *  airGaps: 0 = never, 100 = very frequent. */
export function airGapDropProb(airGaps: number): number {
  return p((airGaps / 100) * 0.30);
}
