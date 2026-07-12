/**
 * Shared utilities for jazz backing track generators.
 */

import type { SongSection, InstrumentRole } from "./types";

export type { InstrumentRole };

/**
 * Tempo-dependent swing ratio scaling.
 * Real jazz: slow tempos = heavy triplet swing, fast tempos = nearly straight.
 * Returns multiplier for swingAmount (0-100 parameter).
 */
export function tempoSwingMultiplier(tempo: number): number {
  if (tempo <= 80) return 1.5;    // ballad: heavy swing (~3:1 ratio)
  if (tempo <= 100) return 1.3;   // medium-slow: (~2.5:1 ratio)
  if (tempo <= 180) return 1.0;
  if (tempo <= 240) return 1.0 - ((tempo - 180) / 60) * 0.4; // linear 1.0 → 0.6
  return 0.3;
}

/**
 * Per-instrument swing scaling factor.
 * Real jazz: ride swings hardest, bass walks straighter, piano between.
 * Applied as multiplier on top of tempoSwingMultiplier.
 */
export function instrumentSwingFactor(role: InstrumentRole): number {
  switch (role) {
    case "drums": return 1.0;
    case "piano": return 0.85;
    case "bass":  return 0.70;
  }
}

/**
 * Dynamic arc multiplier across a chorus.
 * Creates natural volume contour: subdued opening → build → peak → slight taper.
 */
export function dynamicMultiplier(measureIndex: number, totalMeasures: number, style?: string, sections?: SongSection[]): number {
  if (totalMeasures <= 0) return 1.0;

  // Section-aware: macro arc (section energy) × micro arc (within-section style curve)
  if (sections && sections.length > 0) {
    const section = sections.find(s => measureIndex >= s.startMeasure && measureIndex < s.endMeasure);
    if (section) {
      const sectionLen = section.endMeasure - section.startMeasure;
      const localIdx = measureIndex - section.startMeasure;
      // Micro arc: existing style curve applied within this section
      const micro = dynamicMultiplier(localIdx, sectionLen, style);
      // Macro arc: section's energy level scales the micro curve.
      // Floor at 0.3 matches getSectionEnergy clamping — prevents silent output.
      return micro * Math.max(0.3, section.dynamicLevel);
    }
  }

  const pct = measureIndex / totalMeasures;

  // Alfa Mist: dramatic build from whisper to full energy (45% range)
  if (style === "alfaMist") {
    if (pct < 0.15) return 0.60;
    if (pct < 0.50) return 0.60 + ((pct - 0.15) / 0.35) * 0.30; // 0.60 → 0.90
    if (pct < 0.80) return 0.90 + ((pct - 0.50) / 0.30) * 0.15; // 0.90 → 1.05
    return 1.05 - ((pct - 0.80) / 0.20) * 0.10; // 1.05 → 0.95 taper
  }

  // Pat Metheny: light, floating, even — gentle contour, no dramatic builds.
  // Bright Size Life feel: intimate opening, slight swell, graceful return.
  if (style === "metheny") {
    if (pct < 0.10) return 0.82;
    if (pct < 0.40) return 0.82 + ((pct - 0.10) / 0.30) * 0.13; // 0.82 → 0.95
    if (pct < 0.75) return 0.95 + ((pct - 0.40) / 0.35) * 0.05; // 0.95 → 1.00
    return 1.00 - ((pct - 0.75) / 0.25) * 0.08; // 1.00 → 0.92
  }

  // Hard Bop: Art Blakey energy — aggressive build, strong peak (30% range)
  if (style === "hardBop") {
    if (pct < 0.10) return 0.75;
    if (pct < 0.40) return 0.75 + ((pct - 0.10) / 0.30) * 0.15; // 0.75 → 0.90
    if (pct < 0.75) return 0.90 + ((pct - 0.40) / 0.35) * 0.15; // 0.90 → 1.05
    return 1.05 - ((pct - 0.75) / 0.25) * 0.10; // 1.05 → 0.95
  }

  // Ballad: slow bloom, tender arc (15% range)
  if (style === "ballad") {
    if (pct < 0.20) return 0.85;
    if (pct < 0.65) return 0.85 + ((pct - 0.20) / 0.45) * 0.10; // 0.85 → 0.95
    if (pct < 0.85) return 0.95 + ((pct - 0.65) / 0.20) * 0.05; // 0.95 → 1.00
    return 1.00 - ((pct - 0.85) / 0.15) * 0.05; // 1.00 → 0.95
  }

  // ECM: nearly flat, barely perceptible movement (10% range)
  if (style === "ecm") {
    if (pct < 0.20) return 0.92;
    if (pct < 0.70) return 0.92 + ((pct - 0.20) / 0.50) * 0.08; // 0.92 → 1.00
    return 1.00 - ((pct - 0.70) / 0.30) * 0.02; // 1.00 → 0.98
  }

  // Cool Jazz: gentle, steady, relaxed (12% range)
  if (style === "coolJazz") {
    if (pct < 0.15) return 0.90;
    if (pct < 0.60) return 0.90 + ((pct - 0.15) / 0.45) * 0.10; // 0.90 → 1.00
    if (pct < 0.85) return 1.00;
    return 1.00 - ((pct - 0.85) / 0.15) * 0.02; // 1.00 → 0.98
  }

  // Fusion: strong build with reset at 60% (25% range)
  if (style === "fusion") {
    if (pct < 0.10) return 0.80;
    if (pct < 0.60) return 0.80 + ((pct - 0.10) / 0.50) * 0.25; // 0.80 → 1.05
    if (pct < 0.70) return 1.05 - ((pct - 0.60) / 0.10) * 0.10; // 1.05 → 0.95 reset
    if (pct < 0.90) return 0.95 + ((pct - 0.70) / 0.20) * 0.05; // 0.95 → 1.00 rebuild
    return 1.00 - ((pct - 0.90) / 0.10) * 0.05; // 1.00 → 0.95
  }

  // Neo-Soul: slow burn, peaks late (35% range)
  if (style === "neoSoul") {
    if (pct < 0.20) return 0.68;
    if (pct < 0.60) return 0.68 + ((pct - 0.20) / 0.40) * 0.17; // 0.68 → 0.85
    if (pct < 0.85) return 0.85 + ((pct - 0.60) / 0.25) * 0.18; // 0.85 → 1.03
    return 1.03 - ((pct - 0.85) / 0.15) * 0.08; // 1.03 → 0.95
  }

  // Bossa Nova: gentle, even, minimal arc (10% range)
  if (style === "bossa") {
    if (pct < 0.15) return 0.92;
    if (pct < 0.70) return 0.92 + ((pct - 0.15) / 0.55) * 0.08; // 0.92 → 1.00
    return 1.00 - ((pct - 0.70) / 0.30) * 0.02; // 1.00 → 0.98
  }

  // Latin: steady energy, slight build (15% range)
  if (style === "latin") {
    if (pct < 0.10) return 0.88;
    if (pct < 0.50) return 0.88 + ((pct - 0.10) / 0.40) * 0.12; // 0.88 → 1.00
    if (pct < 0.80) return 1.00 + ((pct - 0.50) / 0.30) * 0.03; // 1.00 → 1.03
    return 1.03 - ((pct - 0.80) / 0.20) * 0.05; // 1.03 → 0.98
  }

  // Funk: steady pocket, minimal arc (8% range)
  if (style === "funk") {
    if (pct < 0.10) return 0.94;
    if (pct < 0.70) return 0.94 + ((pct - 0.10) / 0.60) * 0.06; // 0.94 → 1.00
    if (pct < 0.85) return 1.00 + ((pct - 0.70) / 0.15) * 0.02; // 1.00 → 1.02
    return 1.02 - ((pct - 0.85) / 0.15) * 0.04; // 1.02 → 0.98
  }

  // Contemporary Jazz: gradual build, natural arc (20% range)
  if (style === "contemporaryJazz") {
    if (pct < 0.15) return 0.82;
    if (pct < 0.55) return 0.82 + ((pct - 0.15) / 0.40) * 0.13; // 0.82 → 0.95
    if (pct < 0.80) return 0.95 + ((pct - 0.55) / 0.25) * 0.07; // 0.95 → 1.02
    return 1.02 - ((pct - 0.80) / 0.20) * 0.07; // 1.02 → 0.95
  }

  // Holdsworth: builds from quiet introspection to intense peak, then pulls back (22% range)
  if (style === "holdsworth") {
    if (pct < 0.15) return 0.82;
    if (pct < 0.45) return 0.82 + ((pct - 0.15) / 0.30) * 0.12; // 0.82 → 0.94
    if (pct < 0.75) return 0.94 + ((pct - 0.45) / 0.30) * 0.10; // 0.94 → 1.04
    return 1.04 - ((pct - 0.75) / 0.25) * 0.10; // 1.04 → 0.94
  }

  // Shuffle Blues: steady groove, slight bump at turnaround (15% range)
  if (style === "shuffleBlues") {
    if (pct < 0.10) return 0.88;
    if (pct < 0.60) return 0.88 + ((pct - 0.10) / 0.50) * 0.10; // 0.88 → 0.98
    if (pct < 0.80) return 0.98 + ((pct - 0.60) / 0.20) * 0.05; // 0.98 → 1.03
    return 1.03 - ((pct - 0.80) / 0.20) * 0.08; // 1.03 → 0.95
  }

  // Jazz Waltz: elegant arc, natural 3/4 breathing (15% range)
  if (style === "jazzWaltz") {
    if (pct < 0.15) return 0.87;
    if (pct < 0.55) return 0.87 + ((pct - 0.15) / 0.40) * 0.10; // 0.87 → 0.97
    if (pct < 0.80) return 0.97 + ((pct - 0.55) / 0.25) * 0.05; // 0.97 → 1.02
    return 1.02 - ((pct - 0.80) / 0.20) * 0.07; // 1.02 → 0.95
  }

  // Modal: meditative, patient build (12% range)
  if (style === "modal") {
    if (pct < 0.25) return 0.90;
    if (pct < 0.65) return 0.90 + ((pct - 0.25) / 0.40) * 0.08; // 0.90 → 0.98
    if (pct < 0.85) return 0.98 + ((pct - 0.65) / 0.20) * 0.04; // 0.98 → 1.02
    return 1.02 - ((pct - 0.85) / 0.15) * 0.04; // 1.02 → 0.98
  }

  // Math Rock: angular, less predictable — slight build only (10% range)
  if (style === "mathRock") {
    if (pct < 0.15) return 0.92;
    if (pct < 0.70) return 0.92 + ((pct - 0.15) / 0.55) * 0.08; // 0.92 → 1.00
    if (pct < 0.85) return 1.00 + ((pct - 0.70) / 0.15) * 0.02; // 1.00 → 1.02
    return 1.02 - ((pct - 0.85) / 0.15) * 0.04; // 1.02 → 0.98
  }

  // IDM: generative, flat with subtle drift (8% range)
  if (style === "idm") {
    if (pct < 0.20) return 0.94;
    if (pct < 0.75) return 0.94 + ((pct - 0.20) / 0.55) * 0.06; // 0.94 → 1.00
    return 1.00 + ((pct - 0.75) / 0.25) * 0.02; // 1.00 → 1.02 (doesn't taper — stays floating)
  }

  // Default fallback (swing and unknown styles)
  if (pct < 0.15) return 0.88;
  if (pct < 0.60) return 0.88 + ((pct - 0.15) / 0.45) * 0.12; // linear 0.88 → 1.0
  if (pct < 0.85) return 1.0;
  return 0.92;
}
