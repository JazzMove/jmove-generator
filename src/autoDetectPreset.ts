/**
 * Auto-detect the best practice preset for a given score.
 *
 * Analyzes: time signature, tempo, iReal style string, chord content (blues patterns,
 * modal harmony, ii-V-I density, sus/quartal chords) to score each preset.
 * Returns the highest-scoring preset as the recommended default.
 */

import type { QuantizedScore, MeasureChord, StylePreset } from "./types";
import { STYLE_PRESETS } from "./stylePresets";
import { irealStyleToPracticeStyle } from "./styleMapping";

export function autoDetectPreset(score: QuantizedScore): StylePreset {
  const tempo = score.tempo || 120;
  const timeSig = score.timeSignature || [4, 4];
  const irealStyle = score.style ? irealStyleToPracticeStyle(score.style) : null;

  // Gather all chords across measures
  const allChords: MeasureChord[] = score.measures.flatMap((m) => m.chords ?? []);
  const uniqueRoots = new Set(allChords.map((c) => c.root));
  const chordsPerMeasure = score.measures.length > 0
    ? allChords.length / score.measures.length
    : 1;

  // Analyze chord qualities
  const qualities = allChords.map((c) => c.quality);
  const dom7Count = qualities.filter((q) => q === "7" || q === "9" || q === "13").length;
  const min7Count = qualities.filter((q) => q.startsWith("m") && !q.startsWith("maj")).length;
  const susCount = qualities.filter((q) => q.includes("sus")).length;
  const altCount = qualities.filter((q) => q.includes("alt") || q.includes("b9") || q.includes("#9")).length;

  // Detect blues progression (I7-IV7-V7 pattern with dominant 7ths)
  const isBlues = dom7Count > allChords.length * 0.5 && uniqueRoots.size <= 5;

  // Detect modal (few chord changes, static harmony)
  const isModal = chordsPerMeasure <= 1.2 && uniqueRoots.size <= 3;

  // Detect ii-V-I density (lots of chord motion in 4ths)
  const hasIiVI = chordsPerMeasure >= 1.5 && min7Count > 0 && dom7Count > 0;

  // Score each preset
  let bestPreset = STYLE_PRESETS[0];
  let bestScore = -Infinity;

  for (const preset of STYLE_PRESETS) {
    // Skip hybrid presets for auto-detection (prefer pure styles)
    if (preset.instrumentStyles) continue;

    let score_ = 0;

    // 1. iReal style match (strongest signal)
    if (irealStyle && preset.style === irealStyle) {
      score_ += 100;
    }

    // 2. Time signature
    if (timeSig[0] === 3 && preset.style === "jazzWaltz") {
      score_ += 80;
    } else if (timeSig[0] === 3 && preset.style !== "jazzWaltz") {
      score_ -= 50; // penalize non-waltz for 3/4
    }

    // 3. Tempo fit (how well tempo lands in preset's range)
    const [lo, hi] = preset.tempoRange;
    if (tempo >= lo && tempo <= hi) {
      // Bonus for being in the sweet spot (middle of range)
      const mid = (lo + hi) / 2;
      const closeness = 1 - Math.abs(tempo - mid) / (hi - lo);
      score_ += 30 * closeness;
    } else {
      // Penalty for being outside range
      const dist = tempo < lo ? lo - tempo : tempo - hi;
      score_ -= Math.min(40, dist * 0.5);
    }

    // 4. Blues detection
    if (isBlues && preset.style === "shuffleBlues") score_ += 60;
    if (isBlues && preset.style === "swing") score_ += 20; // blues can also swing

    // 5. Modal detection
    if (isModal && (preset.style === "modal" || preset.style === "ecm")) score_ += 50;
    if (isModal && preset.style === "hardBop") score_ -= 20;

    // 6. Dense ii-V-I → swing family (strong signal for traditional jazz)
    if (hasIiVI && (preset.style === "swing" || preset.style === "hardBop" || preset.style === "coolJazz")) score_ += 40;
    if (hasIiVI && (preset.style === "modal" || preset.style === "latin" || preset.style === "bossa" || preset.style === "funk" || preset.style === "fusion")) score_ -= 20;

    // 7. Altered dominants → hardBop
    if (altCount > allChords.length * 0.2 && preset.style === "hardBop") score_ += 30;

    // 8. Sus chords → modal/ecm
    if (susCount > allChords.length * 0.3) {
      if (preset.style === "modal" || preset.style === "ecm") score_ += 35;
    }

    // 9. Very slow + sparse → ballad or ecm
    if (tempo < 70 && chordsPerMeasure <= 1.5) {
      if (preset.style === "ballad" || preset.style === "ecm") score_ += 40;
    }

    // 10. Fast → hardBop (>170 with chord motion)
    if (tempo > 170 && hasIiVI && preset.style === "hardBop") score_ += 35;

    // 11. Neo-soul: mid-tempo, m7/9 density
    if (tempo >= 70 && tempo <= 110 && min7Count > allChords.length * 0.3 && preset.style === "neoSoul") score_ += 25;

    // 12. Contemporary jazz: moderate tempo, ii-V-I with few roots
    if (hasIiVI && uniqueRoots.size <= 6 && tempo >= 80 && tempo <= 140 && preset.style === "contemporaryJazz") score_ += 20;

    // 13. Math rock / IDM: primarily via irealStyle match (hard to auto-detect from harmony)
    if (irealStyle === "mathRock" && preset.style === "mathRock") score_ += 100;
    if (irealStyle === "idm" && preset.style === "idm") score_ += 100;

    if (score_ > bestScore) {
      bestScore = score_;
      bestPreset = preset;
    }
  }

  return bestPreset;
}
