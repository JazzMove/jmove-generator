/**
 * Preset Blending - interpolate between two style presets.
 *
 * All numeric parameters are linearly interpolated. The style string
 * uses the dominant preset (ratio <= 0.5 picks A, ratio > 0.5 picks B).
 * Groove templates can be blended separately via blendGrooveTemplates().
 */

import type {
  StylePreset,
  StyleParameters,
  InstrumentStyles,
  GrooveTemplate,
  ElementTiming,
  DrumGranular,
  PianoGranular,
  BassGranular,
} from "./types";
import { getGrooveTemplate } from "./grooveTemplates";

// ── Helpers ──

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerpRound(a: number, b: number, t: number, min = 0, max = 100): number {
  return clamp(Math.round(lerp(a, b, t)), min, max);
}

// ── Granular Blending ──

const DRUM_KEYS: (keyof DrumGranular)[] = [
  "tomFrequency", "fillIntensity", "rideWash", "ghostDensity", "cymbalColor",
];

const PIANO_KEYS: (keyof PianoGranular)[] = [
  "voicingDensity", "rhythmicActivity", "registerRange", "anticipation", "pianoRegister",
];

const BASS_KEYS: (keyof BassGranular)[] = [
  "chromaticApproach", "registerWidth", "syncopation", "beatVariety", "bassRegister",
];

function blendDrumGranular(a: DrumGranular, b: DrumGranular, t: number): DrumGranular {
  const result = {} as DrumGranular;
  for (const k of DRUM_KEYS) result[k] = lerpRound(a[k], b[k], t);
  return result;
}

function blendPianoGranular(a: PianoGranular, b: PianoGranular, t: number): PianoGranular {
  const result = {} as PianoGranular;
  for (const k of PIANO_KEYS) result[k] = lerpRound(a[k], b[k], t);
  return result;
}

function blendBassGranular(a: BassGranular, b: BassGranular, t: number): BassGranular {
  const result = {} as BassGranular;
  for (const k of BASS_KEYS) result[k] = lerpRound(a[k], b[k], t);
  return result;
}

// ── Parameter Blending ──

function blendParameters(a: StyleParameters, b: StyleParameters, t: number): StyleParameters {
  const params: StyleParameters = {
    swingAmount: lerpRound(a.swingAmount, b.swingAmount, t),
    density: lerpRound(a.density, b.density, t),
    strumMs: lerpRound(a.strumMs ?? 0, b.strumMs ?? 0, t, 0, 30),
    creativity: lerpRound(a.creativity ?? 50, b.creativity ?? 50, t),
    conversation: lerpRound(a.conversation ?? 50, b.conversation ?? 50, t),
    airGaps: lerpRound(a.airGaps ?? 50, b.airGaps ?? 50, t),
    harmonicFreedom: lerpRound(a.harmonicFreedom ?? 50, b.harmonicFreedom ?? 50, t),
    drumComplexity: lerpRound(a.drumComplexity ?? 50, b.drumComplexity ?? 50, t),
    pianoComplexity: lerpRound(a.pianoComplexity ?? 50, b.pianoComplexity ?? 50, t),
    bassComplexity: lerpRound(a.bassComplexity ?? 50, b.bassComplexity ?? 50, t),
  };

  // Granular: blend if both present, use single if one, omit if neither
  if (a.drumGranular && b.drumGranular) {
    params.drumGranular = blendDrumGranular(a.drumGranular, b.drumGranular, t);
  } else if (a.drumGranular || b.drumGranular) {
    params.drumGranular = a.drumGranular ?? b.drumGranular;
  }

  if (a.pianoGranular && b.pianoGranular) {
    params.pianoGranular = blendPianoGranular(a.pianoGranular, b.pianoGranular, t);
  } else if (a.pianoGranular || b.pianoGranular) {
    params.pianoGranular = a.pianoGranular ?? b.pianoGranular;
  }

  if (a.bassGranular && b.bassGranular) {
    params.bassGranular = blendBassGranular(a.bassGranular, b.bassGranular, t);
  } else if (a.bassGranular || b.bassGranular) {
    params.bassGranular = a.bassGranular ?? b.bassGranular;
  }

  return params;
}

// ── Instrument Styles Blending ──

function blendInstrumentStyles(
  a: InstrumentStyles | undefined,
  b: InstrumentStyles | undefined,
  t: number,
): InstrumentStyles | undefined {
  if (!a && !b) return undefined;
  const result: InstrumentStyles = {};
  for (const key of ["bass", "piano", "drums"] as const) {
    const av = a?.[key];
    const bv = b?.[key];
    if (av && bv) {
      result[key] = t <= 0.5 ? av : bv;
    } else if (av || bv) {
      result[key] = (av ?? bv)!;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ── Public API ──

/**
 * Blend two style presets by interpolating numeric parameters.
 * Style string uses the dominant preset (ratio <= 0.5 picks A, > 0.5 picks B).
 *
 * @param a - Primary preset
 * @param b - Secondary preset
 * @param ratio - 0 = pure A, 1 = pure B
 */
export function blendPresets(a: StylePreset, b: StylePreset, ratio: number): StylePreset {
  const t = clamp(ratio, 0, 1);
  return {
    id: `${a.id}~${b.id}`,
    name: `${a.name} x ${b.name}`,
    description: `${Math.round((1 - t) * 100)}% ${a.name}, ${Math.round(t * 100)}% ${b.name}`,
    style: t <= 0.5 ? a.style : b.style,
    instrumentStyles: blendInstrumentStyles(a.instrumentStyles, b.instrumentStyles, t),
    parameters: blendParameters(a.parameters, b.parameters, t),
    tempoRange: [
      Math.round(lerp(a.tempoRange[0], b.tempoRange[0], t)),
      Math.round(lerp(a.tempoRange[1], b.tempoRange[1], t)),
    ],
  };
}

/**
 * Blend three style presets using barycentric weights.
 * Dominant style = preset with highest weight.
 *
 * @param a - First preset (top vertex)
 * @param b - Second preset (bottom-left vertex)
 * @param c - Third preset (bottom-right vertex)
 * @param weights - [wA, wB, wC] normalized to sum=1 internally
 */
export function blendPresets3(
  a: StylePreset,
  b: StylePreset,
  c: StylePreset,
  weights: [number, number, number],
): StylePreset {
  // Normalize weights to sum=1
  const raw = weights.map((w) => Math.max(0, w));
  const sum = raw[0] + raw[1] + raw[2];
  const [wA, wB, wC] = sum > 1e-10 ? [raw[0] / sum, raw[1] / sum, raw[2] / sum] : [1 / 3, 1 / 3, 1 / 3];

  // Dominant = highest weight
  const dominant = wA >= wB && wA >= wC ? a : wB >= wC ? b : c;

  return {
    id: `${a.id}~${b.id}~${c.id}`,
    name: `${a.name} x ${b.name} x ${c.name}`,
    description: `${Math.round(wA * 100)}% ${a.name}, ${Math.round(wB * 100)}% ${b.name}, ${Math.round(wC * 100)}% ${c.name}`,
    style: dominant.style,
    instrumentStyles: blendInstrumentStyles3(a.instrumentStyles, b.instrumentStyles, c.instrumentStyles, wA, wB, wC),
    parameters: blendParameters3(a.parameters, b.parameters, c.parameters, wA, wB, wC),
    tempoRange: [
      Math.round(a.tempoRange[0] * wA + b.tempoRange[0] * wB + c.tempoRange[0] * wC),
      Math.round(a.tempoRange[1] * wA + b.tempoRange[1] * wB + c.tempoRange[1] * wC),
    ],
  };
}

// ── 3-way Parameter Blending ──

function wavg3(a: number, b: number, c: number, wA: number, wB: number, wC: number, min = 0, max = 100): number {
  return clamp(Math.round(a * wA + b * wB + c * wC), min, max);
}

function blendParameters3(
  a: StyleParameters,
  b: StyleParameters,
  c: StyleParameters,
  wA: number,
  wB: number,
  wC: number,
): StyleParameters {
  const params: StyleParameters = {
    swingAmount: wavg3(a.swingAmount, b.swingAmount, c.swingAmount, wA, wB, wC),
    density: wavg3(a.density, b.density, c.density, wA, wB, wC),
    strumMs: wavg3(a.strumMs ?? 0, b.strumMs ?? 0, c.strumMs ?? 0, wA, wB, wC, 0, 30),
    creativity: wavg3(a.creativity ?? 50, b.creativity ?? 50, c.creativity ?? 50, wA, wB, wC),
    conversation: wavg3(a.conversation ?? 50, b.conversation ?? 50, c.conversation ?? 50, wA, wB, wC),
    airGaps: wavg3(a.airGaps ?? 50, b.airGaps ?? 50, c.airGaps ?? 50, wA, wB, wC),
    harmonicFreedom: wavg3(a.harmonicFreedom ?? 50, b.harmonicFreedom ?? 50, c.harmonicFreedom ?? 50, wA, wB, wC),
    drumComplexity: wavg3(a.drumComplexity ?? 50, b.drumComplexity ?? 50, c.drumComplexity ?? 50, wA, wB, wC),
    pianoComplexity: wavg3(a.pianoComplexity ?? 50, b.pianoComplexity ?? 50, c.pianoComplexity ?? 50, wA, wB, wC),
    bassComplexity: wavg3(a.bassComplexity ?? 50, b.bassComplexity ?? 50, c.bassComplexity ?? 50, wA, wB, wC),
  };

  // Granular: blend if all 3 present, else fallback to 2-way or single
  const dgs = [a.drumGranular, b.drumGranular, c.drumGranular].filter(Boolean) as DrumGranular[];
  if (dgs.length === 3) {
    params.drumGranular = blendDrumGranular3(dgs[0], dgs[1], dgs[2], wA, wB, wC);
  } else if (dgs.length > 0) {
    params.drumGranular = dgs[0]; // Use first available
  }

  const pgs = [a.pianoGranular, b.pianoGranular, c.pianoGranular].filter(Boolean) as PianoGranular[];
  if (pgs.length === 3) {
    params.pianoGranular = blendPianoGranular3(pgs[0], pgs[1], pgs[2], wA, wB, wC);
  } else if (pgs.length > 0) {
    params.pianoGranular = pgs[0];
  }

  const bgs = [a.bassGranular, b.bassGranular, c.bassGranular].filter(Boolean) as BassGranular[];
  if (bgs.length === 3) {
    params.bassGranular = blendBassGranular3(bgs[0], bgs[1], bgs[2], wA, wB, wC);
  } else if (bgs.length > 0) {
    params.bassGranular = bgs[0];
  }

  return params;
}

function blendDrumGranular3(a: DrumGranular, b: DrumGranular, c: DrumGranular, wA: number, wB: number, wC: number): DrumGranular {
  const result = {} as DrumGranular;
  for (const k of DRUM_KEYS) result[k] = wavg3(a[k], b[k], c[k], wA, wB, wC);
  return result;
}

function blendPianoGranular3(a: PianoGranular, b: PianoGranular, c: PianoGranular, wA: number, wB: number, wC: number): PianoGranular {
  const result = {} as PianoGranular;
  for (const k of PIANO_KEYS) result[k] = wavg3(a[k], b[k], c[k], wA, wB, wC);
  return result;
}

function blendBassGranular3(a: BassGranular, b: BassGranular, c: BassGranular, wA: number, wB: number, wC: number): BassGranular {
  const result = {} as BassGranular;
  for (const k of BASS_KEYS) result[k] = wavg3(a[k], b[k], c[k], wA, wB, wC);
  return result;
}

function blendInstrumentStyles3(
  a: InstrumentStyles | undefined,
  b: InstrumentStyles | undefined,
  c: InstrumentStyles | undefined,
  wA: number,
  wB: number,
  wC: number,
): InstrumentStyles | undefined {
  if (!a && !b && !c) return undefined;
  const result: InstrumentStyles = {};
  for (const key of ["bass", "piano", "drums"] as const) {
    const vals = [
      { style: a?.[key], w: wA },
      { style: b?.[key], w: wB },
      { style: c?.[key], w: wC },
    ].filter((v) => v.style);
    if (vals.length > 0) {
      // Pick the one with highest weight
      vals.sort((x, y) => y.w - x.w);
      result[key] = vals[0].style!;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Blend groove templates from two styles by interpolating bias/jitter.
 * Useful for creating micro-timing feels between two styles.
 *
 * @param styleA - First style name
 * @param styleB - Second style name
 * @param ratio - 0 = pure A, 1 = pure B
 */
export function blendGrooveTemplates(styleA: string, styleB: string, ratio: number): GrooveTemplate {
  const a = getGrooveTemplate(styleA);
  const b = getGrooveTemplate(styleB);
  const t = clamp(ratio, 0, 1);

  const blend = (ea: ElementTiming, eb: ElementTiming): ElementTiming => ({
    bias: lerp(ea.bias, eb.bias, t),
    jitter: lerp(ea.jitter, eb.jitter, t),
  });

  return {
    kick: blend(a.kick, b.kick),
    snare: blend(a.snare, b.snare),
    hihat: blend(a.hihat, b.hihat),
    ride: blend(a.ride, b.ride),
    crash: blend(a.crash, b.crash),
    bass: blend(a.bass, b.bass),
    bassOffbeat: blend(a.bassOffbeat, b.bassOffbeat),
    piano: blend(a.piano, b.piano),
    pianoAnticipation: blend(a.pianoAnticipation, b.pianoAnticipation),
  };
}
