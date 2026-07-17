/**
 * Complexity mapping — derives granular per-instrument controls from general
 * complexity slider (0-100). Manual overrides take precedence.
 */

import type { DrumGranular, PianoGranular, BassGranular } from "./types.js";

// ── Mapping Curves ──
// Each control has [min, default, max] — complexity 0→min, 50→default, 100→max

interface ControlCurve {
  min: number;
  default: number;
  max: number;
}

function lerp(curve: ControlCurve, complexity: number): number {
  const t = Math.max(0, Math.min(100, complexity)) / 100;
  if (t <= 0.5) {
    // 0→50 maps min→default
    return curve.min + (curve.default - curve.min) * (t / 0.5);
  }
  // 50→100 maps default→max
  return curve.default + (curve.max - curve.default) * ((t - 0.5) / 0.5);
}

// ── Drum Curves ──

const DRUM_CURVES: Record<keyof DrumGranular, ControlCurve> = {
  tomFrequency:  { min: 0,  default: 40, max: 85 },
  fillIntensity: { min: 5,  default: 50, max: 90 },
  rideWash:      { min: 10, default: 50, max: 90 },
  ghostDensity:  { min: 5,  default: 40, max: 85 },
  cymbalColor:   { min: 0,  default: 30, max: 75 },
};

// ── Piano Curves ──

const PIANO_CURVES: Record<keyof PianoGranular, ControlCurve> = {
  voicingDensity:  { min: 10, default: 50, max: 90 },
  rhythmicActivity:{ min: 10, default: 50, max: 90 },
  registerRange:   { min: 15, default: 50, max: 90 },
  anticipation:    { min: 5,  default: 35, max: 75 },
  pianoRegister:   { min: 50, default: 50, max: 50 }, // always 50 (center) unless manually overridden
};

// ── Bass Curves ──

const BASS_CURVES: Record<keyof BassGranular, ControlCurve> = {
  chromaticApproach: { min: 10, default: 50, max: 85 },
  registerWidth:     { min: 15, default: 50, max: 90 },
  syncopation:       { min: 0,  default: 30, max: 75 },
  beatVariety:       { min: 10, default: 40, max: 80 },
  bassRegister:      { min: 50, default: 50, max: 50 }, // always 50 (center) unless manually overridden
};

// ── Resolve Functions ──

export function resolveDrumGranular(
  complexity: number = 50,
  overrides?: Partial<DrumGranular>,
): DrumGranular {
  return {
    tomFrequency:  overrides?.tomFrequency  ?? Math.round(lerp(DRUM_CURVES.tomFrequency, complexity)),
    fillIntensity: overrides?.fillIntensity ?? Math.round(lerp(DRUM_CURVES.fillIntensity, complexity)),
    rideWash:      overrides?.rideWash      ?? Math.round(lerp(DRUM_CURVES.rideWash, complexity)),
    ghostDensity:  overrides?.ghostDensity  ?? Math.round(lerp(DRUM_CURVES.ghostDensity, complexity)),
    cymbalColor:   overrides?.cymbalColor   ?? Math.round(lerp(DRUM_CURVES.cymbalColor, complexity)),
  };
}

export function resolvePianoGranular(
  complexity: number = 50,
  overrides?: Partial<PianoGranular>,
): PianoGranular {
  return {
    voicingDensity:  overrides?.voicingDensity  ?? Math.round(lerp(PIANO_CURVES.voicingDensity, complexity)),
    rhythmicActivity:overrides?.rhythmicActivity?? Math.round(lerp(PIANO_CURVES.rhythmicActivity, complexity)),
    registerRange:   overrides?.registerRange   ?? Math.round(lerp(PIANO_CURVES.registerRange, complexity)),
    anticipation:    overrides?.anticipation    ?? Math.round(lerp(PIANO_CURVES.anticipation, complexity)),
    pianoRegister:   overrides?.pianoRegister   ?? 50,
  };
}

export function resolveBassGranular(
  complexity: number = 50,
  overrides?: Partial<BassGranular>,
): BassGranular {
  return {
    chromaticApproach: overrides?.chromaticApproach ?? Math.round(lerp(BASS_CURVES.chromaticApproach, complexity)),
    registerWidth:     overrides?.registerWidth     ?? Math.round(lerp(BASS_CURVES.registerWidth, complexity)),
    syncopation:       overrides?.syncopation       ?? Math.round(lerp(BASS_CURVES.syncopation, complexity)),
    beatVariety:       overrides?.beatVariety       ?? Math.round(lerp(BASS_CURVES.beatVariety, complexity)),
    bassRegister:      overrides?.bassRegister      ?? 50,
  };
}
