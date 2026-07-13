/**
 * Drum Pattern Generator — style-specific drum patterns for practice backing tracks.
 *
 * Generates one measure at a time, repeatable for any number of bars.
 * Uses General MIDI drum map. Supports 5 styles with multiple variations each.
 * Humanization: timing jitter + velocity dynamics (ghost notes, accents).
 *
 * Styles:
 *   - Swing: ride cymbal quarter notes, hi-hat 2&4, kick/snare comping
 *   - Bossa Nova: cross-stick, syncopated kick, continuous hi-hat 8ths
 *   - Latin (Afro-Cuban): cascara on ride, clave-based kick, timbale accents
 *   - Ballad: brushes feel, sparse kick, ride with swells
 *   - Funk: 16th hi-hat, syncopated kick+snare, ghost notes
 */

import { tempoSwingMultiplier, dynamicMultiplier, instrumentSwingFactor } from "./swingUtils";
import { getGrooveTemplate, applyGroove, drumPitchToElement } from "./grooveTemplates";
import type { DrumHit, DrumPatternOptions } from "./types";

export type { DrumHit, DrumPatternOptions };

// ── General MIDI Drum Map ──

export const GM_DRUMS = {
  KICK: 36,
  SNARE: 38,
  SIDE_STICK: 37,
  CROSS_STICK: 37,
  SNARE_GHOST: 38,     // same pitch, low velocity
  HI_HAT_CLOSED: 42,
  HI_HAT_OPEN: 46,
  HI_HAT_PEDAL: 44,
  RIDE: 51,
  RIDE_BELL: 53,
  CRASH: 49,
  TOM_HIGH: 50,
  TOM_MID: 47,
  TOM_LOW: 45,
  TOM_FLOOR: 43,
  COWBELL: 56,
  CLAVES: 75,
  SHAKER: 70,
} as const;

// ── Pattern Definition Types ──

interface PatternHit {
  drum: number;      // GM pitch
  beat: number;      // beat position (0-based, in quarter notes)
  velocity: number;  // base velocity
  ghost?: boolean;   // ghost note (reduced velocity)
}

type Pattern = PatternHit[];

// ── Style Patterns ──
// Beat positions: 0 = beat 1, 0.5 = "and" of 1, 1 = beat 2, etc.
// For 4/4 time: range [0, 4)

// ── SWING ──

const SWING_RIDE: Pattern = [
  // Ride: quarter notes + skip-note at ~65% of main beat (audible swing pulse)
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.67, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 80 },
  { drum: GM_DRUMS.RIDE, beat: 1.67, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 2.67, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 80 },
  { drum: GM_DRUMS.RIDE, beat: 3.67, velocity: 60 },
];

const SWING_HIHAT: Pattern = [
  // Hi-hat pedal on 2 and 4 (felt, not prominent)
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 55 },
];

// Soft closed hi-hat 8th-note pulse (felt, not heard) — adds pocket feel underneath ride
const SWING_HIHAT_PULSE: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 30, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 25, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 30, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 25, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 30, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 25, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 30, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 25, ghost: true },
];

const SWING_KICK_SNARE: Pattern[] = [
  // Jazz kick/snare = very sparse, mostly felt. Drummer "feathers" the kick.
  // Variation 1: feathered kick on 1, ghost snare
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.SNARE, beat: 1.67, velocity: 30, ghost: true },
  ],
  // Variation 2: feathered kick 1 & 3
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 50 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 45 },
  ],
  // Variation 3: just kick on 1 (most common in jazz)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
  ],
  // Variation 4: kick 1, light snare comp on 4-and
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 50 },
    { drum: GM_DRUMS.SNARE, beat: 3.67, velocity: 30, ghost: true },
  ],
];

// ── BOSSA NOVA ──

const BOSSA_HIHAT: Pattern = [
  // Continuous 8th notes on hi-hat (straight, not swung)
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 55 },
];

const BOSSA_KICK: Pattern = [
  // Classic bossa kick: beat 1 and "and" of 2 (anticipation of 3)
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 85 },
  { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 75 },
  { drum: GM_DRUMS.KICK, beat: 3, velocity: 80 },
  { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 65 },
];

const BOSSA_CROSS_STICK: Pattern = [
  // Cross-stick (rim click) on 2 and 4
  { drum: GM_DRUMS.CROSS_STICK, beat: 1, velocity: 75 },
  { drum: GM_DRUMS.CROSS_STICK, beat: 3, velocity: 70 },
];

// ── LATIN (Afro-Cuban) ──

const LATIN_CASCARA: Pattern = [
  // Cascara pattern on ride bell (son clave-aligned)
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 70 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2.5, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 75 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 3.5, velocity: 85 },
];

const LATIN_KICK: Pattern = [
  // Tumbao-style kick (matches bass)
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
];

const LATIN_HIHAT: Pattern = [
  // Steady 8ths on hi-hat
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 50 },
];

const LATIN_CLAVE: Pattern = [
  // Son clave 3-2 (every 2 bars, but simplified per measure)
  { drum: GM_DRUMS.CLAVES, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.CLAVES, beat: 1.5, velocity: 80 },
  { drum: GM_DRUMS.CLAVES, beat: 3, velocity: 85 },
];

// ── BALLAD ──

const BALLAD_RIDE: Pattern = [
  // Sparse ride — quarters with swell feel
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

const BALLAD_KICK: Pattern[] = [
  // Var 1: kick on 1 only
  [{ drum: GM_DRUMS.KICK, beat: 0, velocity: 70 }],
  // Var 2: kick on 1 and 3
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 70 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 55 },
  ],
  // Var 3: kick on 1, cross-stick on 3 (adds snare presence)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 70 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 2, velocity: 45 },
  ],
];

const BALLAD_HIHAT: Pattern = [
  // Gentle hi-hat pedal on 2 and 4
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 50 },
];

// ── FUNK ──

const FUNK_HIHAT: Pattern = [
  // 16th notes on hi-hat with accents on 1, "e-of-2", 3, "e-of-4"
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 85 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 85 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 55 },
];

const FUNK_KICK_SNARE: Pattern[] = [
  // Var 1: classic funk (kick on 1, and-of-2-and; snare on 2 and 4)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 100 },
    { drum: GM_DRUMS.KICK, beat: 1.75, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 35, ghost: true },
  ],
  // Var 2: syncopated kick
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 35, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 100 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 2.75, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 35, ghost: true },
  ],
];

// ── FUSION ──

const FUSION_HIHAT: Pattern = [
  // 16th hats with open hat accents on upbeats
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.75, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 50 },
];

const FUSION_KICK_SNARE: Pattern[] = [
  // V1: standard backbeat with kick syncopation
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2.75, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 70 },
  ],
  // V2: ghost notes between accents
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 35, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 1.75, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 35, ghost: true },
  ],
  // V3: displaced snare — Weckl style ("e" of 2, "a" of 4)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1.25, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 85 },
  ],
  // V4: 3-over-4 polyrhythmic kick (accent every 3 sixteenths)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.KICK, beat: 0.75, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2.25, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 3.0, velocity: 70 },
  ],
  // V5: ghost-heavy — ghosts between every main hit
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 0.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 1.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 1.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 3.75, velocity: 70 },
  ],
  // V6: wide syncopation — kick on "and"s, snare displaced
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 0.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 1.25, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 3.75, velocity: 70 },
  ],
];

// Ride bell pattern for fusion (alternate timekeeping)
const FUSION_RIDE_BELL: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1, velocity: 80 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 3, velocity: 80 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 55 },
];

// Linear drumming (Weckl/Gadd): no two limbs simultaneously
// These patterns encode the full kit — base should be empty
const FUSION_LINEAR_A: Pattern = [
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 60 },
  { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 85 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 55 },
  { drum: GM_DRUMS.KICK, beat: 1, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 60 },
  { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 85 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.75, velocity: 55 },
  { drum: GM_DRUMS.KICK, beat: 2, velocity: 95 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 60 },
  { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 85 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 55 },
  { drum: GM_DRUMS.KICK, beat: 3, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 60 },
  { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 85 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 55 },
];

const FUSION_LINEAR_B: Pattern = [
  // Kick-driven linear: more kick, less snare
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 55 },
  { drum: GM_DRUMS.KICK, beat: 0.5, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 0.75, velocity: 65 },
  { drum: GM_DRUMS.SNARE, beat: 1, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 55 },
  { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.75, velocity: 55 },
  { drum: GM_DRUMS.KICK, beat: 2, velocity: 95 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 55 },
  { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.75, velocity: 65 },
  { drum: GM_DRUMS.SNARE, beat: 3, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 55 },
  { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 55 },
];

// Fusion-specific fills (linear fills, not jazz fills)
const FUSION_FILLS: Pattern[] = [
  // Linear tom cascade
  [
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 90 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.25, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.TOM_MID, beat: 2.75, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.TOM_LOW, beat: 3.25, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 95 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 3.75, velocity: 75 },
  ],
  // Snare flam roll crescendo
  [
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 50 },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 60 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 100 },
  ],
  // Kick-tom-snare triplets
  [
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 90 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.33, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 2.67, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.TOM_MID, beat: 3.33, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.67, velocity: 95 },
  ],
  // Ride-crash accent combo
  [
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.TOM_MID, beat: 2.75, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 95 },
    { drum: GM_DRUMS.CRASH, beat: 3, velocity: 70 },
    { drum: GM_DRUMS.TOM_LOW, beat: 3.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 95 },
  ],
];

// Holdsworth-specific fills — Gary Husband/Wackerman polyrhythmic vocabulary
const HOLDSWORTH_FILLS: Pattern[] = [
  // Groups of 3 over 4/4 — Husband signature (snare-tom-kick triplet grouping)
  [
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.33, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 2.67, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 85 },
    { drum: GM_DRUMS.TOM_MID, beat: 3.33, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 3.67, velocity: 80 },
  ],
  // Dotted-8th displacement — Wackerman metric modulation feel
  [
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 2.375, velocity: 80 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.75, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 3.125, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
    { drum: GM_DRUMS.CRASH, beat: 3.5, velocity: 60 },
  ],
  // Ghost cascade into accent — conversational build
  [
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 35, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 40, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 50 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3.25, velocity: 80 },
    { drum: GM_DRUMS.TOM_MID, beat: 3.5, velocity: 75 },
    { drum: GM_DRUMS.TOM_LOW, beat: 3.75, velocity: 85 },
  ],
  // Wide-interval tom melody — Husband melodic drumming
  [
    { drum: GM_DRUMS.TOM_HIGH, beat: 2, velocity: 80 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 2.5, velocity: 75 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3.25, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
    { drum: GM_DRUMS.CRASH, beat: 3.5, velocity: 55 },
  ],
];

// ── HOLDSWORTH ──
// Gary Husband / Chad Wackerman: conversational, displaced, evolving.
// 8th-note ride, displaced kick/snare, ghost-heavy, open hi-hat accents.

const HOLDSWORTH_RIDE: Pattern = [
  // 8th-note ride — Husband/Wackerman drive harder than quarter notes
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 72 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 68 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 72 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 68 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 55 },
];

const HOLDSWORTH_RIDE_BELL: Pattern = [
  // Bell accents on downbeats + ride 8ths — Wackerman intensity
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 50 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 50 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 50 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 50 },
];

const HOLDSWORTH_HIHAT: Pattern = [
  // Conversational hi-hat — pedal on 2&4 + open hi-hat accents
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.5, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 50 },
];

const HOLDSWORTH_KICK_SNARE: Pattern[] = [
  // V1: displaced — kick on "and" of 1, snare on "and" of 2 (Husband signature)
  [
    { drum: GM_DRUMS.KICK, beat: 0.5, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 1.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 75 },
  ],
  // V2: conversational — sparse, breath between statements
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1.25, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 30, ghost: true },
  ],
  // V3: ghost cascade — ghosted snare melody between accents
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2.25, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 75 },
  ],
  // V4: Wackerman polyrhythmic — dotted-quarter kick over 4/4
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 30, ghost: true },
  ],
];

// ── ALFA MIST ──
// Broken beat + J Dilla: displaced snare, syncopated kick, ghost-heavy,
// 16th hi-hats with selective opening. East London jazz-hop feel.

const ALFA_MIST_HIHAT: Pattern = [
  // 16th hi-hats with quintuplet-influenced ghost dynamics.
  // Velocity curve: downbeats accent (70-75), upbeats ghost (30-45),
  // "and" beats medium (55-60). Creates shimmering "raindrop" quality.
  // Open hi-hat on beat 2 "and" and beat 4 "and" (Jas Kayser signature).
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.2, velocity: 30 },   // quintuplet ghost (between 16ths)
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 58 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 35 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 35 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 62 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.8, velocity: 30 },   // quintuplet ghost
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 35 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 58 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.8, velocity: 30 },   // quintuplet ghost
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 35 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 62 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 35 },
];

// Alfa Mist hi-hat variant 2: broken gaps — deliberate holes in 16th grid.
// NOT straight 16ths. Gaps create space for Rhodes delay tails + bass ghost notes.
// Research: Jas Kayser "defined by feel, intent" — silence is a note.
const ALFA_MIST_HIHAT_BROKEN: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 75 },
  // gap at 0.25 — breathing room
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 30 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 38 },
  // gap at 1.5 — snare flam fills this space
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.75, velocity: 55 },   // open after gap
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 75 },
  // gap at 2.25 — asymmetric with first half
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 58 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.8, velocity: 28 },  // quintuplet ghost
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 32 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 60 },
  // gap at 3.75 — end breathes into next bar
];

const ALFA_MIST_KICK_SNARE: Pattern[] = [
  // V1: broken beat — snare displaced, kick anticipates, snare flam on 2
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 1.25, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 1.47, velocity: 45 },  // flam grace note
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 90 },   // flam main hit
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2.75, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 30, ghost: true },
  ],
  // V2: hip-hop pocket — kick on 1 and "and" of 2, snare on 2 and 4 with flam
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.97, velocity: 45 },  // flam grace
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 90 },     // flam main
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 2.97, velocity: 45 },  // flam grace
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 90 },     // flam main
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 3.75, velocity: 70 },
  ],
  // V3: ghost cascade — Jas Kayser textural density, sextuplet ghost placement
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 0.17, velocity: 25, ghost: true },  // sextuplet ghost
    { drum: GM_DRUMS.SNARE, beat: 0.67, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.97, velocity: 40 },  // flam grace
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 1.75, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 2.17, velocity: 25, ghost: true },  // sextuplet
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2.75, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 3.67, velocity: 25, ghost: true },  // sextuplet
  ],
  // V4: half-time feel — sparse, Afrobeat influence (Jas Kayser Latin/West African roots)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 25, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 3.25, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 25, ghost: true },
  ],
  // V5: 12/8 cross-rhythm — Afrobeat polyrhythm superimposed on 4/4
  // Jas Kayser's Berklee/Panama immersion: jazz meets West African bell pattern.
  // Kick follows dotted-quarter grouping (every 1.5 beats), snare on 3 (4/4 anchor).
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 0.67, velocity: 25, ghost: true },  // triplet ghost
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 80 },                 // dotted-quarter cross
    { drum: GM_DRUMS.SNARE, beat: 1.67, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 88 },                  // backbeat anchor
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 75 },                   // dotted-quarter cross
    { drum: GM_DRUMS.SNARE, beat: 3.33, velocity: 28, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.67, velocity: 35, ghost: true },  // triplet ghost cascade
  ],
];

// ── PAT METHENY (Bob Moses) ──
// Conversational, brush-like touch, flat ride, reactive, ECM-adjacent.
// Not groove-locked — responds to melody. Light, wide cymbal spacing.
// Research: Bright Size Life, Bob Moses "dependent drumming" philosophy.

const METHENY_RIDE: Pattern = [
  // Flat ride — quarter notes, very light touch (Bob Moses lighter than swing)
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

const METHENY_RIDE_BRUSHES: Pattern = [
  // Brush-like pattern — softer, with swish quality on 2 and 4
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 50 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 58 },   // slight accent (brush sweep)
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 50 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 58 },   // brush sweep
];

const METHENY_HIHAT: Pattern = [
  // Minimal — soft pedal hi-hat on 2 and 4 only (Bob Moses: less is more)
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 40 },
];

const METHENY_KICK_SNARE: Pattern[] = [
  // V1: conversational — sparse, breath-filled, reacting to melody
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 65 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 65 },
  ],
  // V2: brush sweep — snare swishes on 2 and 4 (brush circle pattern)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 72 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 55 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 60 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 55 },
  ],
  // V3: melodic kick — 4 limbs used melodically (Moses dependent drumming)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 55 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 60 },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 3.25, velocity: 55 },
  ],
  // V4: very sparse — one kick, one snare (open space for guitar + bass)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 68 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 58 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 25, ghost: true },
  ],
];

// ── NEO-SOUL ──

// Broken hi-hat: deliberate gaps create J Dilla "broken" feel
const NEO_SOUL_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 75 },
  // gap at 0.25
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 0.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 70 },
  // gap at 1.25
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 60 },
  // gap at 1.75
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.25, velocity: 55 },
  // gap at 2.5
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 70 },
  // gap at 3.25
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 45 },
];

const NEO_SOUL_HIHAT_B: Pattern = [
  // Alternate broken pattern — different gap placement
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 50 },
  // gap at 0.5
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 0.75, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 45 },
  // gap at 1.5, 1.75
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 70 },
  // gap at 2.25
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.75, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 50 },
  // gap at 3.5
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 45 },
];

const NEO_SOUL_KICK_SNARE: Pattern[] = [
  // V1: classic Dilla pocket
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 1.75, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 35, ghost: true },
  ],
  // V2: laid-back pocket with kick on "and"s
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2.75, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 30, ghost: true },
  ],
  // V3: D'Angelo-style sparse kick + ghost fill
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 30, ghost: true },
  ],
  // V4: syncopated double kick
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 0.75, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 1.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 75 },
  ],
  // V5: heavy ghost snare fill
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 0.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 30, ghost: true },
  ],
];

// ── CONTEMPORARY JAZZ ──

// 8th-note ride: busier than ECM, lighter than hardBop (brush-like)
const CONTEMP_RIDE: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 50 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 45 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 50 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 45 },
];

const CONTEMP_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 45 },
];

const CONTEMP_KICK_SNARE: Pattern[] = [
  // V1: cross-stick on 2, kick on 1
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 1, velocity: 45 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 45 },
  ],
  // V2: sparse — just kick
  [{ drum: GM_DRUMS.KICK, beat: 0, velocity: 50 }],
  // V3: cross-stick on 2 and 4
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 1, velocity: 40 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 3, velocity: 50 },
  ],
  // V4: gentle syncopation with "and" of 3 kick
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 1, velocity: 45 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 40 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 3, velocity: 45 },
  ],
];

// ── MATH ROCK ──

// Groups of 5 over 16 sixteenths: accents at positions 0, 5, 10, 15
const MATH_HIHAT_5: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 90 },
];

// Groups of 3 over 16 sixteenths: accents every 3rd position
const MATH_HIHAT_3: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 90 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 90 },
];

const MATH_KICK_SNARE: Pattern[] = [
  // V1: snare on "and" of 1 and "e" of 3 (displaced)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 1.25, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 80 },
  ],
  // V2: angular pattern — snare on "a" of 1 and "and" of 3
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 3.25, velocity: 85 },
  ],
  // V3: kick groups of 3 — displaced feel
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.KICK, beat: 0.75, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 2.25, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 90 },
  ],
  // V4: interlocking accents
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.SNARE, beat: 0.25, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 1, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 1.75, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 3.25, velocity: 80 },
  ],
  // V5: asymmetric groupings
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 1.25, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 2.75, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
  ],
];

// ── IDM ──

// 32nd-note hi-hat bursts — the hi-hat IS the melodic element
const IDM_HIHAT: Pattern = [
  // Burst at beat 1
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.125, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 55 },
  // Gap
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 0.75, velocity: 60 },
  // Burst at beat 2
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.625, velocity: 60 },
  // Sparse middle
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 55 },
  // Burst before beat 4
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.125, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.375, velocity: 45 },
];

const IDM_HIHAT_B: Pattern = [
  // Different burst positions
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.375, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1, velocity: 65 },
  // Rapid burst
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.75, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.875, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.125, velocity: 45 },
  // Sparse end
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.625, velocity: 50 },
];

const IDM_HIHAT_C: Pattern = [
  // Sparser — more gaps
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 60 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.375, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.625, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 50 },
];

const IDM_KICK_SNARE: Pattern[] = [
  // V1: irregular kick + side-stick (not full snare)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 1.75, velocity: 80 },
    { drum: GM_DRUMS.SIDE_STICK, beat: 2.5, velocity: 50 },
    { drum: GM_DRUMS.KICK, beat: 3.25, velocity: 70 },
  ],
  // V2: glitchy rapid tom sequence
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 1, velocity: 50 },
    { drum: GM_DRUMS.TOM_MID, beat: 1.125, velocity: 50 },
    { drum: GM_DRUMS.TOM_LOW, beat: 1.25, velocity: 50 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 80 },
    { drum: GM_DRUMS.SIDE_STICK, beat: 3, velocity: 55 },
  ],
  // V3: sub-bass kick pattern
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.SIDE_STICK, beat: 1.5, velocity: 45 },
    { drum: GM_DRUMS.KICK, beat: 2.25, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 70 },
  ],
  // V4: minimal — kick + occasional rim
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 2.75, velocity: 75 },
    { drum: GM_DRUMS.SIDE_STICK, beat: 3.5, velocity: 40 },
  ],
];

// ── ECM ──

const ECM_RIDE: Pattern = [
  // Brush-like ride, soft quarters (audible but restrained)
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

const ECM_KICK: Pattern = [
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
];

const ECM_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 45 },
];

const ECM_SNARE: Pattern[] = [
  // Side-stick adds subtle rhythmic texture
  [{ drum: GM_DRUMS.SIDE_STICK, beat: 2, velocity: 40 }],
  [], // some measures: no snare (space)
];

// ── HARD BOP ──

const HARD_BOP_RIDE: Pattern = [
  // Loud, driving ride with prominent skip-note
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 100 },
  { drum: GM_DRUMS.RIDE, beat: 0.67, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 1.67, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 100 },
  { drum: GM_DRUMS.RIDE, beat: 2.67, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 3.67, velocity: 70 },
];

const HARD_BOP_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 70 },
];

const HARD_BOP_KICK_SNARE: Pattern[] = [
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 65 },
    { drum: GM_DRUMS.SNARE, beat: 3.67, velocity: 60 },
  ],
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 70 },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 60 },
  ],
];

// ── COOL JAZZ ──

const COOL_RIDE: Pattern = [
  // Soft ride quarters, no skip-note (brush feel)
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

const COOL_HIHAT: Pattern = [
  // Light brush sweeps (closed hat as proxy)
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 50 },
];

const COOL_KICK_SNARE: Pattern[] = [
  // Var 1: kick on 1, side-stick on 3
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.SIDE_STICK, beat: 2, velocity: 45 },
  ],
  // Var 2: kick on 1 only
  [{ drum: GM_DRUMS.KICK, beat: 0, velocity: 55 }],
  // Var 3: kick on 1, side-stick on 4
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.SIDE_STICK, beat: 3, velocity: 40 },
  ],
];

// ── MODAL ──

const MODAL_RIDE: Pattern = [
  // Sparse ride quarters, open and spacious
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

const MODAL_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 40 },
];

const MODAL_KICK: Pattern[] = [
  [{ drum: GM_DRUMS.KICK, beat: 0, velocity: 50 }],
  // Var 2: kick on beat 3 (soft, spacious feel)
  [{ drum: GM_DRUMS.KICK, beat: 2, velocity: 45 }],
];

// ── JAZZ WALTZ (3/4) ──

const WALTZ_RIDE: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
];

const WALTZ_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
];

const WALTZ_KICK: Pattern = [
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 60 },
];

// ── 5/4 (Take Five / Brubeck) ──
// Grouping: 3+2 (most common) or 2+3

const FIVE_FOUR_RIDE_3_2: Pattern = [
  // Ride quarter notes, accent on grouping boundaries (beats 1 and 4)
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 70 },
];

const FIVE_FOUR_HIHAT: Pattern = [
  // Hi-hat pedal on grouping boundary and end
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 4, velocity: 50 },
];

const FIVE_FOUR_KICK_SNARE: Pattern[] = [
  // V1: kick on 1 and 4, cross-stick on 3 (Take Five style)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 75 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 2, velocity: 60 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 70 },
  ],
  // V2: kick on 1, snare on 3 and 5
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 65 },
    { drum: GM_DRUMS.SNARE, beat: 4, velocity: 55, ghost: true },
  ],
  // V3: sparse — kick only on 1
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 70 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 55 },
  ],
];

// ── 7/8 (Balkan / prog) ──
// Grouping: 2+2+3 (most common), also 3+2+2

const SEVEN_EIGHT_RIDE_223: Pattern = [
  // Beats in 8th notes: accents on grouping boundaries (0, 1, 2, 3.5)
  // In quarter-note beats: 0, 1, 2, 3.5 (where beat = 8th note pairs)
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 65 },
];

const SEVEN_EIGHT_RIDE_322: Pattern = [
  // 3+2+2 grouping
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 60 },
];

const SEVEN_EIGHT_KICK_SNARE: Pattern[] = [
  // V1: kick on group starts (2+2+3)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 85 },
  ],
  // V2: displaced snare
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 1, velocity: 65 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 75 },
  ],
  // V3: 3+2+2 grouping
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
  ],
];

// ── 6/8 (Afro / compound) ──
// 2 groups of 3 eighth notes → 2 dotted-quarter "beats"
// beatsPerMeasure = 6 * (4/8) = 3 quarter-note beats

const SIX_EIGHT_RIDE: Pattern = [
  // Bell pattern: dotted quarter feel
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 70 },
];

const SIX_EIGHT_HIHAT: Pattern = [
  // Afro 6/8 bell pattern (simplified)
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 55 },
];

const SIX_EIGHT_KICK_SNARE: Pattern[] = [
  // V1: kick on 1, snare on dotted quarter 2
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 85 },
  ],
  // V2: Afro 6/8 with anticipated kick
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.KICK, beat: 1, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 65 },
  ],
];

// ── 9/8 (compound triple: 3+3+3) ──
// beatsPerMeasure = 9 * (4/8) = 4.5 quarter-note beats

const NINE_EIGHT_RIDE: Pattern = [
  // 3 groups of 3
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 65 },
];

const NINE_EIGHT_KICK_SNARE: Pattern[] = [
  // V1: kick on group starts
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 80 },
  ],
  // V2: cross-stick on 2, kick on 1 and 3
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 85 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 1.5, velocity: 60 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 75 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 4, velocity: 50 },
  ],
];

// ── 6/4 ──

const SIX_FOUR_RIDE: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 5, velocity: 75 },
];

const SIX_FOUR_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 5, velocity: 55 },
];

const SIX_FOUR_KICK_SNARE: Pattern[] = [
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 75 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 2, velocity: 55 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 70 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 5, velocity: 50 },
  ],
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 65 },
  ],
];

// ── 7/4 ──

const SEVEN_FOUR_RIDE: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 5, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 6, velocity: 75 },
];

const SEVEN_FOUR_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 5, velocity: 55 },
];

const SEVEN_FOUR_KICK_SNARE: Pattern[] = [
  // 4+3 grouping
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 65 },
    { drum: GM_DRUMS.KICK, beat: 4, velocity: 70 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 6, velocity: 55 },
  ],
  // 3+4 grouping
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 75 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 2, velocity: 60 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 5, velocity: 65 },
  ],
];

// ── 11/8 (Balkan complex: 2+2+3+2+2 or 3+2+3+3) ──
// beatsPerMeasure = 11 * (4/8) = 5.5 quarter-note beats

const ELEVEN_EIGHT_RIDE: Pattern = [
  // 2+2+3+2+2 grouping with accents on group starts
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 4.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 5, velocity: 55 },
];

const ELEVEN_EIGHT_KICK_SNARE: Pattern[] = [
  // V1: kick on group starts
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 4.5, velocity: 80 },
  ],
  // V2: sparser
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 2, velocity: 65 },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 80 },
  ],
];

// ── SHUFFLE BLUES ──

const SHUFFLE_RIDE: Pattern = [
  // Shuffle ride: triplet swing with loud backbeat
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 0.67, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 1.67, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 2.67, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 3.67, velocity: 60 },
];

const SHUFFLE_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 65 },
];

const SHUFFLE_KICK_SNARE: Pattern = [
  // Blues backbeat: snare on 2&4 full volume, kick on 1&3
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.SNARE, beat: 1, velocity: 100 },
  { drum: GM_DRUMS.KICK, beat: 2, velocity: 85 },
  { drum: GM_DRUMS.SNARE, beat: 3, velocity: 100 },
];

// ── Jazz Fill Patterns (beats 2-4, triggered before phrase boundaries) ──

const JAZZ_FILLS: Pattern[] = [
  // Descending toms
  [
    { drum: GM_DRUMS.TOM_HIGH, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.TOM_MID, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.TOM_LOW, beat: 3, velocity: 75 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 3.5, velocity: 70 },
  ],
  // Snare press roll
  [
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 55 },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 65 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 90 },
  ],
  // Kick-snare pickup
  [
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
  ],
  // Triplet snare on beat 4
  [
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 3.33, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3.67, velocity: 85 },
  ],
  // Tom-snare combo
  [
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.TOM_MID, beat: 3, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
  ],
];

// Small fills: beat 4 only (before 4-bar phrases)
const _JAZZ_FILLS_SMALL: Pattern[] = [
  [
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
  ],
  [
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 3.33, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 3.67, velocity: 85 },
  ],
];

// Big fills: beats 1.5-4 (before section boundaries)
const JAZZ_FILLS_BIG: Pattern[] = [
  // Full tom cascade
  [
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 70 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.TOM_MID, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.TOM_LOW, beat: 3, velocity: 75 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 3.5, velocity: 70 },
    { drum: GM_DRUMS.CRASH, beat: 3.75, velocity: 70 },
  ],
  // Press roll crescendo
  [
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 45 },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 50 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 55 },
    { drum: GM_DRUMS.SNARE, beat: 2.67, velocity: 60 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 100 },
  ],
  // Cross-kit pattern
  [
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 80 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.5, velocity: 85 },
    { drum: GM_DRUMS.TOM_MID, beat: 2.75, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.TOM_LOW, beat: 3.25, velocity: 80 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 3.5, velocity: 75 },
    { drum: GM_DRUMS.CRASH, beat: 3.75, velocity: 75 },
  ],
];

// Alfa Mist / Jas Kayser fills: ghost-heavy, displaced, textural.
// NOT big jazz fills — subtle broken-beat transitions.
// Flam accents, hi-hat gestures, ghost cascades into accented hits.
const ALFA_MIST_FILLS: Pattern[] = [
  // Ghost cascade into displaced snare accent — signature Jas Kayser
  [
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 28, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 32, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 38, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 42, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 90 },  // displaced accent (not on 3)
  ],
  // Open hi-hat swell + kick displacement
  [
    { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.5, velocity: 55 },
    { drum: GM_DRUMS.KICK, beat: 3.25, velocity: 75 },   // displaced (not on 3)
    { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 50 },  // choke
  ],
  // Snare flam with ghost run-up — broken-beat feel
  [
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 35, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.97, velocity: 45 },  // flam grace
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 88 },     // flam main
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 70 },
  ],
  // Kick-only displacement fill — minimal, space-conscious
  [
    { drum: GM_DRUMS.KICK, beat: 2.75, velocity: 72 },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 68 },
  ],
  // Textural hi-hat + ghost snare — Afrobeat-inflected
  [
    { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2, velocity: 50 },
    { drum: GM_DRUMS.SNARE, beat: 2.33, velocity: 30, ghost: true },
    { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.67, velocity: 45 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 35, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 75 },
  ],
];

// Setup fills: 2-beat anticipation (beats 3-4, placed 2 bars before section)
const SETUP_FILLS: Pattern[] = [
  [
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 65 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 70 },
  ],
  [
    { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.5, velocity: 60 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 70 },
  ],
];

const FILL_STYLES = new Set(["swing", "hardBop", "coolJazz", "shuffleBlues", "ballad", "fusion", "contemporaryJazz", "holdsworth", "alfaMist"]);

// ── Stochastic Jazz Comping ──
// For swing-family styles, kick/snare comping is probabilistic per-beat rather than
// static arrays. Each measure is unique. "Tendency" mechanism provides phrase continuity.

interface BeatSlotProb {
  drum: number;
  probability: number;
  velocity: number;
  ghost?: boolean;
}

interface StochasticTable {
  slots: Record<string, BeatSlotProb[]>;
  minHits: number;
  maxHits: number;
}

const SWING_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.85, velocity: 55 }],
    "0.67": [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 30, ghost: true }],
    "1":    [{ drum: GM_DRUMS.KICK, probability: 0.10, velocity: 45 }],
    "1.67": [{ drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 30, ghost: true }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.30, velocity: 45 }],
    "2.5":  [{ drum: GM_DRUMS.KICK, probability: 0.08, velocity: 40 }],
    "2.67": [{ drum: GM_DRUMS.SNARE, probability: 0.15, velocity: 35, ghost: true }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 45 }],
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.10, velocity: 40 }],
    "3.67": [{ drum: GM_DRUMS.SNARE, probability: 0.20, velocity: 35, ghost: true }],
  },
  minHits: 1,
  maxHits: 4,
};

const HARD_BOP_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.90, velocity: 75 }],
    "0.67": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 40, ghost: true }],
    "1":    [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 65 }],
    "1.67": [{ drum: GM_DRUMS.SNARE, probability: 0.15, velocity: 40, ghost: true }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.55, velocity: 70 }],
    "2.5":  [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 55 }],
    "2.67": [{ drum: GM_DRUMS.SNARE, probability: 0.18, velocity: 50 }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.25, velocity: 60 }],
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 60 }],
    "3.67": [{ drum: GM_DRUMS.SNARE, probability: 0.25, velocity: 60 }],
  },
  minHits: 2,
  maxHits: 5,
};

const COOL_JAZZ_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.75, velocity: 55 }],
    "1":    [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.15, velocity: 45 }],
    "2":    [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.25, velocity: 45 },
             { drum: GM_DRUMS.KICK, probability: 0.15, velocity: 45 }],
    "3":    [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.18, velocity: 40 }],
    "3.67": [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.10, velocity: 35 }],
  },
  minHits: 1,
  maxHits: 3,
};

const MODAL_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.65, velocity: 50 }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 45 }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.10, velocity: 40 }],
  },
  minHits: 0,
  maxHits: 2,
};

// Ballad: very sparse, mostly brush-like side stick, gentle kick on 1
const BALLAD_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.60, velocity: 40 }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.12, velocity: 35 }],
    "2.67": [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.10, velocity: 30, ghost: true }],
    "3.67": [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.08, velocity: 25, ghost: true }],
  },
  minHits: 0,
  maxHits: 2,
};

// Contemporary jazz: active, Kendrick Scott-style — syncopated kicks + ghost cross-sticks
const CONTEMPORARY_JAZZ_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.80, velocity: 60 }],
    "0.5":  [{ drum: GM_DRUMS.KICK, probability: 0.12, velocity: 50 }],
    "0.67": [{ drum: GM_DRUMS.CROSS_STICK, probability: 0.12, velocity: 35, ghost: true }],
    "1":    [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 55 }],
    "1.67": [{ drum: GM_DRUMS.CROSS_STICK, probability: 0.15, velocity: 35, ghost: true }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.40, velocity: 55 }],
    "2.5":  [{ drum: GM_DRUMS.KICK, probability: 0.18, velocity: 50 }],
    "2.67": [{ drum: GM_DRUMS.CROSS_STICK, probability: 0.20, velocity: 40, ghost: true }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 50 }],
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 45 }],
    "3.67": [{ drum: GM_DRUMS.CROSS_STICK, probability: 0.22, velocity: 40, ghost: true }],
  },
  minHits: 2,
  maxHits: 5,
};

// ECM: very sparse, Jon Christensen-inspired — kick feathered, occasional cross-stick
const ECM_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.45, velocity: 35 }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.12, velocity: 30 }],
    "3":    [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.08, velocity: 25 }],
  },
  minHits: 0,
  maxHits: 2,
};

// Metheny: Antonio Sanchez-style — precise kicks, conversational snare accents
const METHENY_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.70, velocity: 50 }],
    "0.67": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 30, ghost: true }],
    "1":    [{ drum: GM_DRUMS.KICK, probability: 0.10, velocity: 40 }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.25, velocity: 45 }],
    "2.67": [{ drum: GM_DRUMS.SNARE, probability: 0.15, velocity: 35, ghost: true }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.12, velocity: 40 }],
    "3.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 30, ghost: true }],
    "3.67": [{ drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 35, ghost: true }],
  },
  minHits: 1,
  maxHits: 3,
};

// Holdsworth: Gary Husband/Chad Wackerman — displaced kicks, ghost-to-accent dynamics,
// conversational snare, open hi-hat interactions
const HOLDSWORTH_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.70, velocity: 70 }],
    "0.5":  [{ drum: GM_DRUMS.KICK, probability: 0.18, velocity: 60 },
             { drum: GM_DRUMS.HI_HAT_OPEN, probability: 0.12, velocity: 40 }],
    "1":    [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 30, ghost: true }],
    "1.5":  [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 55 },
             { drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 75 }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.35, velocity: 65 }],
    "2.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.15, velocity: 40, ghost: true },
             { drum: GM_DRUMS.HI_HAT_OPEN, probability: 0.10, velocity: 35 }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 55 }],
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 55 },
             { drum: GM_DRUMS.SNARE, probability: 0.18, velocity: 35, ghost: true }],
  },
  minHits: 1,
  maxHits: 5,
};

// Alfa Mist / Jas Kayser: broken-beat displacement, flam accents, Afrobeat-jazz hybrid.
// Kick drags (+10ms), snare pushes (-6ms). Sextuplet ghost cascades.
// NOT straight hip-hop — jazz vocabulary with Dilla pocket + West African polyrhythm.
const _ALFA_MIST_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.80, velocity: 85 }],
    "0.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 30, ghost: true }],
    "0.75": [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 60 }],  // displaced anticipation
    "1":    [{ drum: GM_DRUMS.SNARE, probability: 0.55, velocity: 85 },   // Dilla backbeat (early)
             { drum: GM_DRUMS.KICK, probability: 0.10, velocity: 55 }],
    "1.25": [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 65 }],  // broken-beat displacement
    "1.5":  [{ drum: GM_DRUMS.KICK, probability: 0.25, velocity: 70 }],  // dotted-quarter cross-rhythm
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 60 }],
    "2.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.15, velocity: 32, ghost: true }],
    "2.75": [{ drum: GM_DRUMS.KICK, probability: 0.18, velocity: 65 }],
    "3":    [{ drum: GM_DRUMS.SNARE, probability: 0.60, velocity: 88 },   // backbeat anchor
             { drum: GM_DRUMS.KICK, probability: 0.08, velocity: 50 }],
    "3.25": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 28, ghost: true }],
    "3.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 30, ghost: true }],
    "3.67": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 25, ghost: true }],  // sextuplet tail
    "3.75": [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 60 }],  // pickup into next bar
  },
  minHits: 2,
  maxHits: 5,
};

// alfaMist excluded: hand-crafted patterns have flams, sextuplet ghosts, broken-beat
// displacement that stochastic per-beat generation can't replicate.
const STOCHASTIC_STYLES = new Set([
  "swing", "hardBop", "coolJazz", "modal",
  "ballad", "contemporaryJazz", "ecm", "metheny", "holdsworth",
]);

const STOCHASTIC_TABLES: Record<string, StochasticTable> = {
  swing: SWING_STOCHASTIC,
  hardBop: HARD_BOP_STOCHASTIC,
  coolJazz: COOL_JAZZ_STOCHASTIC,
  modal: MODAL_STOCHASTIC,
  ballad: BALLAD_STOCHASTIC,
  contemporaryJazz: CONTEMPORARY_JAZZ_STOCHASTIC,
  ecm: ECM_STOCHASTIC,
  metheny: METHENY_STOCHASTIC,
  holdsworth: HOLDSWORTH_STOCHASTIC,
  // alfaMist: ALFA_MIST_STOCHASTIC — kept as definition but not used;
  // hand-crafted patterns with flams/ghosts/sextuplets are superior for this style
};

interface CompingTendency {
  favored: string[];
  barsRemaining: number;
}

function pickTendency(table: StochasticTable, rng: () => number = Math.random): CompingTendency {
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

function generateStochasticComping(
  table: StochasticTable,
  density: number,
  tendency: CompingTendency,
  rng: () => number = Math.random,
): PatternHit[] {
  const densityScale = 0.5 + (density / 100) * 1.0;
  const hits: PatternHit[] = [];

  for (const [beatStr, slots] of Object.entries(table.slots)) {
    const beat = parseFloat(beatStr);
    for (const slot of slots) {
      const tendencyBoost = tendency.favored.includes(beatStr) ? 2.0 : 1.0;
      const adjustedProb = Math.min(1.0, slot.probability * densityScale * tendencyBoost);
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

  return hits;
}

// ── Helpers ──

export function humanizeTime(time: number, enabled: boolean, style?: string, drumPitch?: number, random?: () => number): number {
  if (!enabled) return time;
  const template = getGrooveTemplate(style ?? "swing");
  const elementKey = drumPitch !== undefined ? drumPitchToElement(drumPitch) : "ride" as const;
  const element = template[elementKey];
  return applyGroove(time, element, random);
}

export function humanizeVelocity(vel: number, ghost: boolean, enabled: boolean, random?: () => number): number {
  const rng = random ?? Math.random;
  if (ghost) return Math.max(35, Math.min(50, vel + (enabled ? Math.floor((rng() - 0.5) * 10) : 0)));
  if (!enabled) return Math.max(45, Math.min(127, vel));
  return Math.max(45, Math.min(127, vel + Math.floor((rng() - 0.5) * 12)));
}

// ── Beat-to-Beat Micro-Variation ──

// alfaMist excluded: hand-crafted patterns already have dense ghost work
// (sextuplet ghosts, flams, ghost cascades). Extra random ghosts = chaotic layering.
const MICRO_VARIATION_STYLES = new Set([
  "swing", "hardBop", "coolJazz", "modal", "jazzWaltz",
  "fusion", "neoSoul", "contemporaryJazz", "holdsworth", "metheny",
]);

export function applyMicroVariation(
  hits: DrumHit[],
  measureStart: number,
  beatDuration: number,
  beatsPerMeasure: number,
  style: string,
  density: number,
  humanize: boolean,
  random?: () => number,
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
}

// ── Pattern Assembly per Style ──

export interface StylePatternSet {
  base: Pattern;         // fixed timekeeping (ride, hihat)
  variations: Pattern[]; // kick/snare comping options (held 2-4 bars for continuity)
}

function getSwingPatternSet(): StylePatternSet {
  return { base: [...SWING_RIDE, ...SWING_HIHAT, ...SWING_HIHAT_PULSE], variations: SWING_KICK_SNARE };
}

function getBossaPatternSet(): StylePatternSet {
  return { base: [...BOSSA_HIHAT, ...BOSSA_KICK, ...BOSSA_CROSS_STICK], variations: [[]] };
}

function getLatinPatternSet(): StylePatternSet {
  return { base: [...LATIN_CASCARA, ...LATIN_KICK, ...LATIN_HIHAT, ...LATIN_CLAVE], variations: [[]] };
}

function getBalladPatternSet(): StylePatternSet {
  return { base: [...BALLAD_RIDE, ...BALLAD_HIHAT], variations: BALLAD_KICK };
}

function getFunkPatternSet(): StylePatternSet {
  return { base: [...FUNK_HIHAT], variations: FUNK_KICK_SNARE };
}

function getFusionPatternSet(rng: () => number = Math.random): StylePatternSet {
  // 30% linear patterns (full kit in one array, no separate base)
  if (rng() < 0.3) {
    return { base: [], variations: [FUSION_LINEAR_A, FUSION_LINEAR_B] };
  }
  // 35% ride bell timekeeping instead of hi-hat
  const base = rng() < 0.35 ? [...FUSION_RIDE_BELL] : [...FUSION_HIHAT];
  return { base, variations: FUSION_KICK_SNARE };
}

function getAlfaMistPatternSet(rng: () => number = Math.random): StylePatternSet {
  // 50/50 between full 16th shimmer and broken-gap hi-hat
  const hihat = rng() < 0.50 ? ALFA_MIST_HIHAT : ALFA_MIST_HIHAT_BROKEN;
  return { base: [...hihat], variations: ALFA_MIST_KICK_SNARE };
}

function getMethenyPatternSet(rng: () => number = Math.random): StylePatternSet {
  // 40% brush-like ride for timbral variety (Bob Moses)
  const ride = rng() < 0.4 ? [...METHENY_RIDE_BRUSHES] : [...METHENY_RIDE];
  return { base: [...ride, ...METHENY_HIHAT], variations: METHENY_KICK_SNARE };
}

function getHoldsworthPatternSet(rng: () => number = Math.random): StylePatternSet {
  // 30% bell ride for timbral variation (Wackerman)
  const ride = rng() < 0.3 ? [...HOLDSWORTH_RIDE_BELL] : [...HOLDSWORTH_RIDE];
  return { base: [...ride, ...HOLDSWORTH_HIHAT], variations: HOLDSWORTH_KICK_SNARE };
}

function getNeoSoulPatternSet(rng: () => number = Math.random): StylePatternSet {
  const base = rng() < 0.5 ? [...NEO_SOUL_HIHAT] : [...NEO_SOUL_HIHAT_B];
  return { base, variations: NEO_SOUL_KICK_SNARE };
}

function getContemporaryJazzPatternSet(): StylePatternSet {
  return { base: [...CONTEMP_RIDE, ...CONTEMP_HIHAT], variations: CONTEMP_KICK_SNARE };
}

function getMathRockPatternSet(rng: () => number = Math.random): StylePatternSet {
  const base = rng() < 0.5 ? [...MATH_HIHAT_5] : [...MATH_HIHAT_3];
  return { base, variations: MATH_KICK_SNARE };
}

function getIdmPatternSet(rng: () => number = Math.random): StylePatternSet {
  const r = rng();
  const base = r < 0.33 ? [...IDM_HIHAT] : r < 0.67 ? [...IDM_HIHAT_B] : [...IDM_HIHAT_C];
  return { base, variations: IDM_KICK_SNARE };
}

function getEcmPatternSet(): StylePatternSet {
  return { base: [...ECM_RIDE, ...ECM_KICK, ...ECM_HIHAT], variations: ECM_SNARE };
}

function getHardBopPatternSet(): StylePatternSet {
  return { base: [...HARD_BOP_RIDE, ...HARD_BOP_HIHAT], variations: HARD_BOP_KICK_SNARE };
}

function getCoolJazzPatternSet(): StylePatternSet {
  return { base: [...COOL_RIDE, ...COOL_HIHAT], variations: COOL_KICK_SNARE };
}

function getModalPatternSet(): StylePatternSet {
  return { base: [...MODAL_RIDE, ...MODAL_HIHAT], variations: MODAL_KICK };
}

function getJazzWaltzPatternSet(): StylePatternSet {
  return { base: [...WALTZ_RIDE, ...WALTZ_HIHAT, ...WALTZ_KICK], variations: [[]] };
}

function getFiveFourPatternSet(): StylePatternSet {
  return { base: [...FIVE_FOUR_RIDE_3_2, ...FIVE_FOUR_HIHAT], variations: FIVE_FOUR_KICK_SNARE };
}

function getSevenEighthPatternSet(rng: () => number = Math.random): StylePatternSet {
  const base = rng() < 0.6 ? [...SEVEN_EIGHT_RIDE_223] : [...SEVEN_EIGHT_RIDE_322];
  return { base, variations: SEVEN_EIGHT_KICK_SNARE };
}

function getSixEighthPatternSet(): StylePatternSet {
  return { base: [...SIX_EIGHT_RIDE, ...SIX_EIGHT_HIHAT], variations: SIX_EIGHT_KICK_SNARE };
}

function getNineEighthPatternSet(): StylePatternSet {
  return { base: [...NINE_EIGHT_RIDE], variations: NINE_EIGHT_KICK_SNARE };
}

function getSixFourPatternSet(): StylePatternSet {
  return { base: [...SIX_FOUR_RIDE, ...SIX_FOUR_HIHAT], variations: SIX_FOUR_KICK_SNARE };
}

function getSevenFourPatternSet(): StylePatternSet {
  return { base: [...SEVEN_FOUR_RIDE, ...SEVEN_FOUR_HIHAT], variations: SEVEN_FOUR_KICK_SNARE };
}

function getElevenEighthPatternSet(): StylePatternSet {
  return { base: [...ELEVEN_EIGHT_RIDE], variations: ELEVEN_EIGHT_KICK_SNARE };
}

/** Get meter-specific pattern set. Returns null if no special pattern exists (use style default). */
export function getMeterPatternSet(timeSig: [number, number], random?: () => number): StylePatternSet | null {
  const [n, d] = timeSig;
  if (n === 3 && d === 4) return getJazzWaltzPatternSet();
  if (n === 5 && d === 4) return getFiveFourPatternSet();
  if (n === 6 && d === 8) return getSixEighthPatternSet();
  if (n === 7 && d === 8) return getSevenEighthPatternSet(random);
  if (n === 9 && d === 8) return getNineEighthPatternSet();
  if (n === 6 && d === 4) return getSixFourPatternSet();
  if (n === 7 && d === 4) return getSevenFourPatternSet();
  if (n === 11 && d === 8) return getElevenEighthPatternSet();
  return null;
}

function getShuffleBluesPatternSet(): StylePatternSet {
  return { base: [...SHUFFLE_RIDE, ...SHUFFLE_HIHAT, ...SHUFFLE_KICK_SNARE], variations: [[]] };
}

/** Get the style-specific pattern set (timekeeping base + comping variations) */
export function getStylePatternSet(style: string): StylePatternSet {
  switch (style) {
    case "bossa": return getBossaPatternSet();
    case "latin": return getLatinPatternSet();
    case "ballad": return getBalladPatternSet();
    case "funk": return getFunkPatternSet();
    case "fusion": return getFusionPatternSet();
    case "ecm": return getEcmPatternSet();
    case "hardBop": return getHardBopPatternSet();
    case "coolJazz": return getCoolJazzPatternSet();
    case "modal": return getModalPatternSet();
    case "jazzWaltz": return getJazzWaltzPatternSet();
    case "shuffleBlues": return getShuffleBluesPatternSet();
    case "neoSoul": return getNeoSoulPatternSet();
    case "contemporaryJazz": return getContemporaryJazzPatternSet();
    case "mathRock": return getMathRockPatternSet();
    case "idm": return getIdmPatternSet();
    case "holdsworth": return getHoldsworthPatternSet();
    case "alfaMist": return getAlfaMistPatternSet();
    case "metheny": return getMethenyPatternSet();
    case "swing":
    default: return getSwingPatternSet();
  }
}

// ── Main Generator ──

/**
 * Generate drum pattern for given number of measures.
 * Returns array of DrumHit events with absolute timing.
 *
 * Phrase continuity: kick/snare comping patterns are held for 2-4 bars
 * before switching to a new variation, mimicking how real drummers play.
 */
export function generateDrumPattern(options: DrumPatternOptions = {}): DrumHit[] {
  const rng = options.random ?? Math.random;
  const style = options.style ?? "swing";
  const tempo = options.tempo ?? 120;
  if (tempo <= 0) throw new RangeError(`tempo must be > 0, got ${tempo}`);
  const numMeasures = options.measures ?? 4;
  const timeSig = options.timeSignature ?? [4, 4];
  const humanize = options.humanize ?? true;
  const startTime = options.startTime ?? 0;
  const density = options.density ?? 50;

  const swingAmount = options.swingAmount ?? 100;
  const formMarkers = options.formMarkers ?? [];
  const sectionMarkers = options.sectionMarkers ?? [];
  const bandCtx = options.bandContext;
  const beatDuration = 60 / tempo;
  const beatsPerMeasure = timeSig[0] * (4 / timeSig[1]);
  const measureDuration = beatsPerMeasure * beatDuration;

  // Select pattern set: meter-specific patterns override style when in odd meters
  // (e.g., 5/4 or 7/8 need specific grouping patterns regardless of style)
  const meterPatternSet = getMeterPatternSet(timeSig, rng);
  const isOddMeter = meterPatternSet !== null && !(timeSig[0] === 4 && timeSig[1] === 4) && !(timeSig[0] === 3 && timeSig[1] === 4 && style === "jazzWaltz");

  let patternSet: StylePatternSet;
  if (isOddMeter) {
    patternSet = meterPatternSet;
  } else {
    switch (style) {
      case "bossa": patternSet = getBossaPatternSet(); break;
      case "latin": patternSet = getLatinPatternSet(); break;
      case "ballad": patternSet = getBalladPatternSet(); break;
      case "funk": patternSet = getFunkPatternSet(); break;
      case "fusion": patternSet = getFusionPatternSet(rng); break;
      case "ecm": patternSet = getEcmPatternSet(); break;
      case "hardBop": patternSet = getHardBopPatternSet(); break;
      case "coolJazz": patternSet = getCoolJazzPatternSet(); break;
      case "modal": patternSet = getModalPatternSet(); break;
      case "jazzWaltz": patternSet = getJazzWaltzPatternSet(); break;
      case "shuffleBlues": patternSet = getShuffleBluesPatternSet(); break;
      case "neoSoul": patternSet = getNeoSoulPatternSet(rng); break;
      case "contemporaryJazz": patternSet = getContemporaryJazzPatternSet(); break;
      case "mathRock": patternSet = getMathRockPatternSet(rng); break;
      case "idm": patternSet = getIdmPatternSet(rng); break;
      case "holdsworth": patternSet = getHoldsworthPatternSet(rng); break;
      case "alfaMist": patternSet = getAlfaMistPatternSet(rng); break;
      case "metheny": patternSet = getMethenyPatternSet(rng); break;
      case "swing":
      default: patternSet = getSwingPatternSet(); break;
    }
  }

  // Phrase continuity: hold kick/snare variation for 2-4 bars before switching
  // For stochastic styles, "tendency" replaces fixed variation rotation.
  // In streaming (measures=1), state is restored from options.drumState to maintain
  // continuity across calls.
  const isStochastic = STOCHASTIC_STYLES.has(style);
  const stochasticTable = isStochastic ? STOCHASTIC_TABLES[style] : null;
  const ds = options.drumState;
  // When drumState is provided with sentinel values (variationIdx < 0, tendency null),
  // initialize them using rng so PRNG consumption matches the batch (no drumState) path.
  let tendency: CompingTendency | null = (ds && ds.tendency !== null)
    ? ds.tendency as CompingTendency
    : (isStochastic && stochasticTable ? pickTendency(stochasticTable, rng) : null);

  let variationIdx = (ds && ds.variationIdx >= 0)
    ? ds.variationIdx
    : Math.floor(rng() * patternSet.variations.length);
  let barsOnPattern = ds ? ds.barsOnPattern : 0;
  let patternHoldBars = (ds && ds.patternHoldBars >= 0)
    ? ds.patternHoldBars
    : 2 + Math.floor(rng() * 3);

  const hits: DrumHit[] = [];

  for (let m = 0; m < numMeasures; m++) {
    // Tendency rotation for stochastic styles
    if (isStochastic && tendency) {
      tendency.barsRemaining--;
      if (tendency.barsRemaining <= 0) {
        tendency = pickTendency(stochasticTable!, rng);
      }
    }

    // Variation rotation for non-stochastic styles
    if (!isStochastic && barsOnPattern >= patternHoldBars && patternSet.variations.length > 1) {
      if (patternSet.variations.length > 2) {
        const candidates = Array.from({ length: patternSet.variations.length }, (_, i) => i)
          .filter((i) => i !== variationIdx);
        variationIdx = candidates[Math.floor(rng() * candidates.length)];
      } else {
        variationIdx = 1 - variationIdx;
      }
      patternHoldBars = 2 + Math.floor(rng() * 3);
      barsOnPattern = 0;
    }

    const measureStart = startTime + m * measureDuration;

    // BandContext: section energy scales intensity (0.3=sparse intro, 1.0=dense shout)
    const energy = bandCtx?.sectionEnergy ?? 0.7;

    // ── Musicality: Drums Minimal (ride + pedal hat only) ──
    // When phrase intent says this measure should be minimal, strip to timekeeping only.
    // Creates dramatic breathing room — silence is the most powerful musical tool.
    const absoluteM = Math.round(measureStart / measureDuration);
    const phraseIntent = bandCtx?.currentPhraseIntent;
    if (phraseIntent?.drumsMinimal?.includes(absoluteM)) {
      // Minimal drums: just ride quarters and pedal hat on 2&4
      for (let b = 0; b < beatsPerMeasure; b++) {
        const t = measureStart + b * beatDuration;
        hits.push({
          pitch: GM_DRUMS.RIDE,
          time: humanizeTime(t, humanize, style, GM_DRUMS.RIDE, rng),
          duration: 0.08,
          velocity: humanizeVelocity(b === 0 ? 55 : 45, false, humanize, rng),
        });
        if (b === 1 || b === 3) {
          hits.push({
            pitch: GM_DRUMS.HI_HAT_PEDAL,
            time: humanizeTime(t, humanize, style, GM_DRUMS.HI_HAT_PEDAL, rng),
            duration: 0.05,
            velocity: humanizeVelocity(35, false, humanize, rng),
          });
        }
      }
      barsOnPattern++;
      continue;
    }

    // Crash cymbal on form boundaries — louder at section boundaries
    // Alfa Mist: crashes only on section starts or 30% of phrase boundaries (sparse, not every 4 bars)
    if (formMarkers.includes(m)) {
      const isSectionStart = sectionMarkers.includes(m);
      const crashProb = style === "alfaMist" ? (isSectionStart ? 0.8 : 0.25) : 1.0;
      if (m === 0 || rng() < crashProb) {
        // BandContext: crash velocity scales with energy (soft intros, big climaxes)
        const crashBaseVel = isSectionStart ? 85 : 70;
        const crashVel = Math.round(crashBaseVel * (0.6 + energy * 0.4));
        hits.push({
          pitch: GM_DRUMS.CRASH,
          time: humanizeTime(measureStart, humanize, style, GM_DRUMS.CRASH, rng),
          duration: isSectionStart ? 0.15 : 0.08,
          velocity: humanizeVelocity(crashVel, false, humanize, rng),
        });
      }
    }

    // Structure-aware fills: size matches form position
    // BandContext: fill probability scales with energy — sparse sections rarely fill
    // In streaming (measures=1), fillHint from ensemble.ts provides lookahead info
    // since the single-measure loop can't look at m+1/m+2.
    let fillPattern: Pattern | null = null;
    const fillHint = options.fillHint;
    if (FILL_STYLES.has(style) && (m > 0 || fillHint)) {
      const isBeforeSectionMarker = fillHint === "section" || sectionMarkers.includes(m + 1);
      const isBeforeFormMarker = fillHint === "phrase" || formMarkers.includes(m + 1);
      const isSetupBar = fillHint === "setup" || sectionMarkers.includes(m + 2);

      // Energy multiplier: at energy 0.3 fills are 40% as likely, at 1.0 fully likely
      const energyFillMult = 0.2 + energy * 0.8;

      // Alfa Mist: fills are rarer and subtler (broken-beat, not flashy jazz)
      const sectionProb = (style === "alfaMist" ? 0.35 : 0.6) * energyFillMult;
      const phraseProb = (style === "alfaMist" ? 0.20 : 0.4) * energyFillMult;

      if (isBeforeSectionMarker && rng() < sectionProb) {
        // Big fill before major section boundary
        const pool = style === "holdsworth" ? HOLDSWORTH_FILLS
          : style === "alfaMist" ? ALFA_MIST_FILLS
          : style === "fusion" ? FUSION_FILLS : JAZZ_FILLS_BIG;
        fillPattern = pool[Math.floor(rng() * pool.length)];
      } else if (isBeforeFormMarker && rng() < phraseProb) {
        // Medium or small fill before phrase boundary
        const pool = style === "holdsworth" ? HOLDSWORTH_FILLS
          : style === "alfaMist" ? ALFA_MIST_FILLS
          : style === "fusion" ? FUSION_FILLS : JAZZ_FILLS;
        fillPattern = pool[Math.floor(rng() * pool.length)];
      } else if (isSetupBar && rng() < 0.25 * energyFillMult) {
        // Setup fill: subtle anticipation 2 bars before section
        fillPattern = SETUP_FILLS[Math.floor(rng() * SETUP_FILLS.length)];
      }
    }

    // Comping: stochastic per-beat generation for jazz styles, fixed arrays for others
    let compHits: PatternHit[];
    if (isStochastic && stochasticTable && tendency) {
      compHits = generateStochasticComping(stochasticTable, density, tendency, rng);
    } else {
      compHits = patternSet.variations[variationIdx];
    }

    // When fill is active, keep comping hits on beats 1-2 only (fill replaces beats 3-4)
    const variationHits = fillPattern ? compHits.filter((h) => h.beat < 2) : compHits;
    const pattern = [...patternSet.base, ...variationHits, ...(fillPattern ?? [])];

    // BandContext: energy-aware ghost note threshold — low energy strips ghosts earlier
    const ghostThreshold = bandCtx ? Math.round(15 + (1 - energy) * 20) : 15;

    for (const hit of pattern) {
      if (hit.beat >= beatsPerMeasure) continue;

      // Density filtering: ghost notes removed at low density (threshold rises in quiet sections)
      if (hit.ghost && density < ghostThreshold) continue;

      // Apply swingAmount to pre-swung skip notes (0.67 positions → parametric)
      let beat = hit.beat;
      const frac = beat % 1;
      if (Math.abs(frac - 0.67) < 0.02) {
        const effectiveSwing = swingAmount * tempoSwingMultiplier(tempo) * instrumentSwingFactor("drums");
        const swingOffset = (effectiveSwing / 100) * (2 / 3 - 0.5);
        beat = Math.floor(beat) + 0.5 + swingOffset;
      }

      let time = measureStart + beat * beatDuration;
      // Ride skip notes get consistent +5ms lag for natural swing delay
      if (humanize && (hit.drum === GM_DRUMS.RIDE || hit.drum === GM_DRUMS.RIDE_BELL) && Math.abs(frac - 0.67) < 0.02) {
        time += 0.005;
      }
      const absoluteMeasureIdx = Math.round(measureStart / measureDuration);
      const dynMult = options.measureInfo
        ? dynamicMultiplier(absoluteMeasureIdx, options.measureInfo.totalMeasures, undefined, options.measureInfo.sections)
        : 1.0;
      // BandContext: velocity scaled by energy (quiet sections play softer).
      // Skip when dynamicMultiplier already incorporates section.dynamicLevel
      // to avoid double-scaling quiet sections.
      const hasSectionDynamics = options.measureInfo?.sections && options.measureInfo.sections.length > 0;
      const energyVelMult = (bandCtx && !hasSectionDynamics) ? (0.7 + energy * 0.3) : 1.0;
      hits.push({
        pitch: hit.drum,
        time: humanizeTime(time, humanize, style, hit.drum, rng),
        duration: 0.08,
        velocity: humanizeVelocity(Math.round(hit.velocity * dynMult * energyVelMult), hit.ghost ?? false, humanize, rng),
      });
    }

    applyMicroVariation(hits, measureStart, beatDuration, beatsPerMeasure, style, density, humanize, rng);

    barsOnPattern++;
  }

  // Persist state for streaming continuity across 1-measure calls
  if (ds) {
    ds.variationIdx = variationIdx;
    ds.barsOnPattern = barsOnPattern;
    ds.patternHoldBars = patternHoldBars;
    ds.tendency = tendency;
  }

  hits.sort((a, b) => a.time - b.time);

  interlockKickHihat(hits, style, rng);

  return hits;
}

// ── Kick-HiHat Interlocking ──

const INTERLOCK_STYLES = new Set(["swing", "hardBop", "coolJazz", "modal", "neoSoul", "contemporaryJazz", "holdsworth", "alfaMist"]);

export function interlockKickHihat(hits: DrumHit[], style: string, random?: () => number): void {
  if (!INTERLOCK_STYLES.has(style)) return;
  const rng = random ?? Math.random;

  const kicks = hits.filter(h => h.pitch === GM_DRUMS.KICK);
  for (const kick of kicks) {
    for (const hit of hits) {
      if (hit.pitch !== GM_DRUMS.HI_HAT_CLOSED) continue;
      if (Math.abs(hit.time - kick.time) > 0.02) continue;

      if (rng() < 0.6) {
        hit.pitch = GM_DRUMS.HI_HAT_OPEN;
        hit.velocity = Math.min(hit.velocity + 10, 70);
        hit.duration = 0.12;
      } else {
        hit.velocity = Math.max(25, hit.velocity - 20);
      }
    }
  }
}
