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
import { getGrooveTemplate, applyGroove, drumPitchToElement, rubatoOffset } from "./grooveTemplates";
import { fillProbScale } from "./probabilityMapping";
import type { DrumHit, DrumGranular, DrumPatternOptions, PhraseIntent, PhraseArc } from "./types";

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
  SPLASH: 55,
  CHINA: 52,
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

// Ride A: standard swing ride with skip-note
const SWING_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.67, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 80 },
  { drum: GM_DRUMS.RIDE, beat: 1.67, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 2.67, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 80 },
  { drum: GM_DRUMS.RIDE, beat: 3.67, velocity: 60 },
];

// Ride B: bell accent on 1 and 3, body between — energy lift
const SWING_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 92 },
  { drum: GM_DRUMS.RIDE, beat: 0.67, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 1.67, velocity: 58 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 2.67, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 3.67, velocity: 58 },
];

const SWING_RIDES = [SWING_RIDE_A, SWING_RIDE_B];

// HH A: pedal on 2 and 4 — standard jazz foot hat (most common)
const SWING_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 55 },
];

// HH B: pedal on all beats — Philly Joe Jones driving feel
const SWING_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 0, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 55 },
];

// HH C: pedal on 2 and 4 + light ghost on upbeats (busier sections only)
const SWING_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 22, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 22, ghost: true },
];

const SWING_HIHATS = [SWING_HIHAT_A, SWING_HIHAT_A, SWING_HIHAT_B, SWING_HIHAT_C];

const SWING_KICK_SNARE: Pattern[] = [
  // Jazz kick/snare = sparse but with occasional accented hits for groove definition.
  // Variation 1: feathered kick on 1, ghost snare on 2-and
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.SNARE, beat: 1.67, velocity: 30, ghost: true },
  ],
  // Variation 2: feathered kick 1 & 3
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 50 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 45 },
  ],
  // Variation 3: kick on 1, accented snare on 4 (Tony Williams comping)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 80 },
  ],
  // Variation 4: kick 1, light snare comp on 4-and
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 50 },
    { drum: GM_DRUMS.SNARE, beat: 3.67, velocity: 30, ghost: true },
  ],
  // Variation 5: accented snare on 4, ghost kick (Philly Joe conversational)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 40, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 75 },
  ],
  // Variation 6: kick 1, cross-stick on 4 (brush feel)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 3, velocity: 65 },
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

// Son clave 3-2: proper 2-bar alternation.
// 3-side: 3 hits per bar. 2-side: 2 hits per bar.
const LATIN_CLAVE_3: Pattern = [
  { drum: GM_DRUMS.CLAVES, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.CLAVES, beat: 1.5, velocity: 80 },
  { drum: GM_DRUMS.CLAVES, beat: 3, velocity: 85 },
];
const LATIN_CLAVE_2: Pattern = [
  { drum: GM_DRUMS.CLAVES, beat: 1, velocity: 85 },
  { drum: GM_DRUMS.CLAVES, beat: 2.5, velocity: 80 },
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

// HH A: 16th hats with open hat accents on upbeats (standard fusion)
const FUSION_HIHAT_A: Pattern = [
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

// HH B: open hat on beat 1 "and" and beat 3 — Weckl broken feel
const FUSION_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 78 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.25, velocity: 48 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 0.5, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.75, velocity: 48 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 48 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.75, velocity: 48 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 78 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.25, velocity: 48 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.5, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.75, velocity: 48 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 48 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.75, velocity: 48 },
];

// HH C: sparser 8th-note hats with open accents — Gadd pocket
const FUSION_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 72 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 72 },
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
  // V7: Weckl linear tom-kick phrase — rack tom replaces snare ghost
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 0.25, velocity: 45, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 95 },
    { drum: GM_DRUMS.TOM_MID, beat: 1.5, velocity: 58 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 85 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.25, velocity: 42, ghost: true },
    { drum: GM_DRUMS.TOM_MID, beat: 2.75, velocity: 48, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 95 },
    { drum: GM_DRUMS.TOM_LOW, beat: 3.5, velocity: 60 },
  ],
  // V8: Chambers power groove — floor tom + kick unison, tom cascades
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 100 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 0, velocity: 62 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 95 },
    { drum: GM_DRUMS.KICK, beat: 1.75, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 85 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 2.5, velocity: 58 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 95 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3.25, velocity: 52 },
    { drum: GM_DRUMS.TOM_MID, beat: 3.5, velocity: 48, ghost: true },
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

// In fusion, hihat and ride bell are alternative timekeeping — rideVariants holds all options
const FUSION_TIMEKEEPING = [FUSION_HIHAT_A, FUSION_HIHAT_B, FUSION_HIHAT_C, FUSION_RIDE_BELL];

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
  // Dotted-8th displacement — Wackerman metric modulation feel (linear: no simultaneous hits)
  [
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 90 },
    { drum: GM_DRUMS.SNARE, beat: 2.375, velocity: 80 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.75, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 3.125, velocity: 85 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
    { drum: GM_DRUMS.CRASH, beat: 3.75, velocity: 58 },
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
  // Wide-interval tom melody — Husband melodic drumming (linear: no simultaneous hits)
  [
    { drum: GM_DRUMS.TOM_HIGH, beat: 2, velocity: 80 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 2.5, velocity: 75 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3.25, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 90 },
    { drum: GM_DRUMS.CRASH, beat: 3.75, velocity: 55 },
  ],
  // Linear fill — strictly no simultaneous hits (Wackerman precision)
  [
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 2.25, velocity: 80 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.5, velocity: 72 },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 78 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 82 },
    { drum: GM_DRUMS.TOM_MID, beat: 3.25, velocity: 75 },
    { drum: GM_DRUMS.TOM_LOW, beat: 3.5, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 3.75, velocity: 85 },
  ],
  // Dynamic arc — pp ghost build to ff accent (Wackerman storytelling)
  [
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 20, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.25, velocity: 25, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 35, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 50 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 65 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3.25, velocity: 78 },
    { drum: GM_DRUMS.TOM_MID, beat: 3.5, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 3.75, velocity: 92 },
  ],
  // Cross-stick to snare transition — subtle color change
  [
    { drum: GM_DRUMS.CROSS_STICK, beat: 2, velocity: 50 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 2.5, velocity: 55 },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 70 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3.25, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 85 },
  ],
];

// ── HOLDSWORTH ──
// Gary Husband / Chad Wackerman: conversational, displaced, evolving.
// 8th-note ride, displaced kick/snare, ghost-heavy, open hi-hat accents.

// Ride A: bell accents on beat 0 & 2 — always some bell color (Wackerman signature)
const HOLDSWORTH_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 72 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 72 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 60 },
];

// Ride B: bell on beat 0 only — subtler, more conversational
const HOLDSWORTH_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 68 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 72 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 68 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 58 },
];

// Ride C: dense bell — beats 0, 1, 2, 3 all bell (high energy sections)
const HOLDSWORTH_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 92 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 3, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 60 },
];

// Ride D: sparse quarter-notes — breathing room, conversational (Husband whisper)
const HOLDSWORTH_RIDE_D: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 82 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 62 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 60 },
];

// 4/4 Hi-hat variants — rotate with ride for variety
const HOLDSWORTH_HIHAT_A: Pattern = [
  // Pedal on 2&4 + open hat accent on "and" of 2
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.5, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 50 },
];
const HOLDSWORTH_HIHAT_B: Pattern = [
  // Open hat on "and" of 1, pedal on 3 — shifted emphasis
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 48 },
];
const HOLDSWORTH_HIHAT_C: Pattern = [
  // Two open hats — brighter, more conversational
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 38 },
];
// Ride-only: no hihat — lets ride breathe without cymbal overlap (Wackerman often drops hat)
const HOLDSWORTH_HIHAT_NONE: Pattern = [];
const HOLDSWORTH_HIHATS = [HOLDSWORTH_HIHAT_A, HOLDSWORTH_HIHAT_B, HOLDSWORTH_HIHAT_C, HOLDSWORTH_HIHAT_NONE];

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
  // V5: cross-stick conversational — Wackerman quiet intensity
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 78 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 1, velocity: 52 },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 28, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 72 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 3, velocity: 48 },
    { drum: GM_DRUMS.SNARE, beat: 3.75, velocity: 28, ghost: true },
  ],
  // V6: ghost cascade with cross-stick punctuation
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 0.25, velocity: 22, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 25, ghost: true },
    { drum: GM_DRUMS.CROSS_STICK, beat: 0.75, velocity: 50 },
    { drum: GM_DRUMS.SNARE, beat: 1.25, velocity: 28, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 78 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 2.75, velocity: 25, ghost: true },
    { drum: GM_DRUMS.CROSS_STICK, beat: 3.25, velocity: 48 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 28, ghost: true },
  ],
];

// ── HOLDSWORTH 11/8 ──
// Chad Wackerman's 11/8 mastery: asymmetric groupings (3+3+3+2 or 2+3+3+3),
// displaced accents that float across bar lines, ghost cascades between accents,
// cross-stick interjections, and ride bell grouping markers.
// beatsPerMeasure = 11 * (4/8) = 5.5 quarter-note beats

// 11/8 Ride A: bell on group boundaries (0, 1.5, 3, 4.5) — Wackerman clarity
const HOLDSWORTH_11_8_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 65 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1.5, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 65 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 3, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 65 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 4.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 5, velocity: 60 },
];

// 11/8 Ride B: bell only on beat 0 and 3 — sparser bell, more conversational
const HOLDSWORTH_11_8_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 72 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 65 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 3, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 4.5, velocity: 72 },
  { drum: GM_DRUMS.RIDE, beat: 5, velocity: 58 },
];

// 11/8 Ride C: sparse — bell on group starts only (3+3+3+2), maximum space
const HOLDSWORTH_11_8_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 82 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 58 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1.5, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 3, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 55 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 4.5, velocity: 75 },
];

// 11/8 Hi-hat variants — rotate to break monotony (Wackerman uses hat as conversation)
const HOLDSWORTH_11_8_HIHAT_A: Pattern = [
  // Pedal on group boundaries + open hat accent
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1.5, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 4.5, velocity: 45 },
];
const HOLDSWORTH_11_8_HIHAT_B: Pattern = [
  // Open hat on group 2, pedal on 3 — shifted emphasis
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 44 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 4, velocity: 38 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 5, velocity: 40 },
];
const HOLDSWORTH_11_8_HIHAT_C: Pattern = [
  // Sparse — only two pedal hits, maximum air
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1.5, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 4.5, velocity: 40 },
];
// Ride-only: no hihat — lets ride breathe without cymbal overlap
const HOLDSWORTH_11_8_HIHAT_NONE: Pattern = [];
const HOLDSWORTH_11_8_HIHATS = [HOLDSWORTH_11_8_HIHAT_A, HOLDSWORTH_11_8_HIHAT_B, HOLDSWORTH_11_8_HIHAT_C, HOLDSWORTH_11_8_HIHAT_NONE];

const HOLDSWORTH_11_8_KICK_SNARE: Pattern[] = [
  // V1: displaced — kick on group starts, snare between groups (Wackerman float)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 80 },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 78 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 72 },
    { drum: GM_DRUMS.SNARE, beat: 4, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 4.5, velocity: 75 },
  ],
  // V2: ghost cascade — ghosted snare melody weaving through accents
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 82 },
    { drum: GM_DRUMS.SNARE, beat: 0.5, velocity: 28, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 32, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1.5, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 4.5, velocity: 72 },
    { drum: GM_DRUMS.SNARE, beat: 5, velocity: 30, ghost: true },
  ],
  // V3: cross-stick conversational — sparse, breathes (Husband)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 78 },
    { drum: GM_DRUMS.CROSS_STICK, beat: 1, velocity: 55 },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 70 },
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.CROSS_STICK, beat: 3, velocity: 50 },
    { drum: GM_DRUMS.KICK, beat: 4, velocity: 72 },
    { drum: GM_DRUMS.SNARE, beat: 5, velocity: 30, ghost: true },
  ],
  // V4: polyrhythmic — dotted-quarter kick superimposed on 11/8
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 82 },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 2, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 72 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 4.5, velocity: 78 },
    { drum: GM_DRUMS.SNARE, beat: 5, velocity: 75 },
  ],
];

// Holdsworth 11/8 fills — Wackerman navigates odd meters with musical phrase fills
const HOLDSWORTH_11_8_FILLS: Pattern[] = [
  // Ghost cascade into tom melody — builds tension across full bar
  [
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 28, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.25, velocity: 32, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 38, ghost: true },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3.75, velocity: 75 },
    { drum: GM_DRUMS.TOM_MID, beat: 4, velocity: 70 },
    { drum: GM_DRUMS.TOM_LOW, beat: 4.5, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 5, velocity: 85 },
  ],
  // Linear snare-kick cascade — no simultaneous hits
  [
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 4, velocity: 78 },
    { drum: GM_DRUMS.SNARE, beat: 4.25, velocity: 72 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 4.5, velocity: 80 },
    { drum: GM_DRUMS.KICK, beat: 5, velocity: 85 },
  ],
  // Triplet grouping over 11/8 — metric modulation feel
  [
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 78 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3.33, velocity: 70 },
    { drum: GM_DRUMS.KICK, beat: 3.67, velocity: 75 },
    { drum: GM_DRUMS.SNARE, beat: 4, velocity: 80 },
    { drum: GM_DRUMS.TOM_MID, beat: 4.33, velocity: 72 },
    { drum: GM_DRUMS.KICK, beat: 4.67, velocity: 78 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 5, velocity: 85 },
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

// ── PAT METHENY (Antonio Sanchez / Bob Moses) ──
// Sanchez: melodic bell work, precise kicks, accent snares, dynamic fills, wide velocity.
// Moses: conversational, brush-like touch, flat ride, reactive, ECM-adjacent.
// Research: Way Up, Bright Size Life, Sanchez "Migration", Moses "dependent drumming".

// Ride A: flat ride — quarter notes, light touch (Moses/early Metheny)
const METHENY_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 58 },
];

// Ride B: brush-like — softer, swish quality on 2 and 4
const METHENY_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 52 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 52 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 60 },
];

// Ride C: bell accents — Sanchez melodic bell work on 1 and 3, ride body between
const METHENY_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 82 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 52 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 80 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 52 },
];

const METHENY_RIDES = [METHENY_RIDE_A, METHENY_RIDE_B, METHENY_RIDE_C];

// HH A: minimal pedal on 2 and 4 (Moses: less is more)
const METHENY_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 42 },
];

// HH B: open hat splash on 3 (Sanchez conversational hat)
const METHENY_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3, velocity: 38 },
];

// HH C: sparse — just pedal on 4 (maximum space)
const METHENY_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 38 },
];

const METHENY_HIHATS = [METHENY_HIHAT_A, METHENY_HIHAT_B, METHENY_HIHAT_C];

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

// HH A: Broken hi-hat — deliberate gaps create J Dilla "broken" feel
const NEO_SOUL_HIHAT_A: Pattern = [
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

// HH B: alternate broken pattern — different gap placement
const NEO_SOUL_HIHAT_B: Pattern = [
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

// HH C: heavy open hat — Questlove/Pino Palladino pocket feel
const NEO_SOUL_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 72 },
  // gap at 0.25
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 58 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 0.75, velocity: 62 },
  // gap at 1
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.25, velocity: 48 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 55 },
  // gap at 1.75
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 72 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.5, velocity: 60 },
  // gap at 2.75
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 68 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.25, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 58 },
  // gap at 3.75
];

const NEO_SOUL_HIHATS = [NEO_SOUL_HIHAT_A, NEO_SOUL_HIHAT_B, NEO_SOUL_HIHAT_C];

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
  // V6: ghost tom touches — muted tom replacing some snare ghosts (Questlove)
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 0.5, velocity: 32, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 90 },
    { drum: GM_DRUMS.TOM_MID, beat: 1.5, velocity: 30, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 1.75, velocity: 75 },
    { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 2.75, velocity: 35, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.TOM_MID, beat: 3.5, velocity: 30, ghost: true },
  ],
  // V7: floor tom pocket — floor tom as rhythmic anchor with kick
  [
    { drum: GM_DRUMS.KICK, beat: 0, velocity: 95 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 0, velocity: 40, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 0.75, velocity: 30, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 1, velocity: 85 },
    { drum: GM_DRUMS.KICK, beat: 2, velocity: 80 },
    { drum: GM_DRUMS.TOM_FLOOR, beat: 2.5, velocity: 38, ghost: true },
    { drum: GM_DRUMS.SNARE, beat: 3, velocity: 90 },
    { drum: GM_DRUMS.TOM_HIGH, beat: 3.25, velocity: 32, ghost: true },
    { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 72 },
  ],
];

// ── CONTEMPORARY JAZZ ──

// 8th-note ride: busier than ECM, lighter than hardBop (brush-like)
// Ride A: 8th-note ride — Kendrick Scott light touch
const CONTEMP_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 68 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 52 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 48 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 68 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 52 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 48 },
];

// Ride B: bell accents on 1 and 3 — Kendrick Scott explosive moments
const CONTEMP_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 50 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 48 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 50 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 48 },
];

// Ride C: sparse quarter-note ride — space for texture
const CONTEMP_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

const CONTEMP_RIDES = [CONTEMP_RIDE_A, CONTEMP_RIDE_B, CONTEMP_RIDE_C];

// HH A: pedal on 2 and 4
const CONTEMP_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 45 },
];

// HH B: open hat splash on "and" of 2 — Kendrick Scott texture
const CONTEMP_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 38 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 42 },
];

// HH C: sparse — just pedal on 4
const CONTEMP_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 40 },
];

const CONTEMP_HIHATS = [CONTEMP_HIHAT_A, CONTEMP_HIHAT_B, CONTEMP_HIHAT_C];

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

// Ride A: loud, driving ride with prominent skip-note (Blakey standard)
const HARD_BOP_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 100 },
  { drum: GM_DRUMS.RIDE, beat: 0.67, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 1.67, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 100 },
  { drum: GM_DRUMS.RIDE, beat: 2.67, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 3.67, velocity: 70 },
];

// Ride B: bell-heavy — Blakey explosive sections, bell on every downbeat
const HARD_BOP_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 105 },
  { drum: GM_DRUMS.RIDE, beat: 0.67, velocity: 72 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1, velocity: 98 },
  { drum: GM_DRUMS.RIDE, beat: 1.67, velocity: 72 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 105 },
  { drum: GM_DRUMS.RIDE, beat: 2.67, velocity: 72 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 3, velocity: 98 },
  { drum: GM_DRUMS.RIDE, beat: 3.67, velocity: 72 },
];

// Ride C: crash ride — wider cymbal, less skip (momentum builder)
const HARD_BOP_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 90 },
];

const HARD_BOP_RIDES = [HARD_BOP_RIDE_A, HARD_BOP_RIDE_B, HARD_BOP_RIDE_C];

// HH A: heavy pedal on 2 and 4
const HARD_BOP_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 70 },
];

// HH B: pedal on all beats — Blakey driving feel
const HARD_BOP_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 0, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 68 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 68 },
];

const HARD_BOP_HIHATS = [HARD_BOP_HIHAT_A, HARD_BOP_HIHAT_B];

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

// Ride A: soft quarters, no skip-note (brush feel)
const COOL_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

// Ride B: gentle 8ths — Motian spacious
const COOL_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 42 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 52 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 42 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 52 },
];

const COOL_RIDES = [COOL_RIDE_A, COOL_RIDE_B];

// HH A: light brush sweeps (closed hat as proxy)
const COOL_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 50 },
];

// HH B: pedal only on 2 and 4 — more space
const COOL_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 42 },
];

const COOL_HIHATS = [COOL_HIHAT_A, COOL_HIHAT_B];

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

/** Score and select fill based on musical context instead of uniform random.
 *  Considers: energy match (busy fills for high energy), history penalty
 *  (avoid repeating same fill), and arc direction. */
function selectContextualFill(
  pool: Pattern[],
  energy: number,
  arc: PhraseArc | null | undefined,
  lastIdx: number,
  rng: () => number,
): Pattern {
  if (pool.length <= 1) return pool[0];
  // Score each fill candidate
  const scores = pool.map((fill, idx) => {
    let score = 1.0;
    // Fill density: count hits. High energy prefers dense fills, low energy prefers sparse.
    const hitCount = fill.length;
    const densityMatch = energy > 0.6 ? hitCount / 8 : (8 - hitCount) / 8;
    score += densityMatch * 0.5;
    // History penalty: don't repeat the same fill
    if (idx === lastIdx) score *= 0.15;
    // Arc bonus: climax/shout prefer biggest fills (most hits), drop/breakdown prefer sparse
    if ((arc === "climax" || arc === "shout") && hitCount >= 5) score += 0.3;
    if ((arc === "drop" || arc === "breakdown") && hitCount <= 3) score += 0.3;
    if ((arc === "build") && hitCount >= 3 && hitCount <= 5) score += 0.2;
    return score;
  });
  // Weighted random selection by score
  const totalScore = scores.reduce((s, v) => s + v, 0);
  let roll = rng() * totalScore;
  for (let i = 0; i < pool.length; i++) {
    roll -= scores[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

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
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.10, velocity: 40 },
             { drum: GM_DRUMS.TOM_FLOOR, probability: 0.07, velocity: 42, ghost: true }],
    "3.67": [{ drum: GM_DRUMS.SNARE, probability: 0.20, velocity: 35, ghost: true }],
  },
  minHits: 1,
  maxHits: 5,
};

// Blakey: bomb drops, accent snare, driving kick, ghost cascades
const HARD_BOP_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.90, velocity: 82 }],
    "0.67": [{ drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 35, ghost: true }],
    "1":    [{ drum: GM_DRUMS.KICK, probability: 0.18, velocity: 68 },
             { drum: GM_DRUMS.SNARE, probability: 0.20, velocity: 88 }],
    "1.5":  [{ drum: GM_DRUMS.TOM_MID, probability: 0.10, velocity: 58, ghost: true }],
    "1.67": [{ drum: GM_DRUMS.SNARE, probability: 0.15, velocity: 35, ghost: true }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.55, velocity: 75 }],
    "2.5":  [{ drum: GM_DRUMS.KICK, probability: 0.18, velocity: 60 },
             { drum: GM_DRUMS.SNARE, probability: 0.15, velocity: 85 }],
    "2.67": [{ drum: GM_DRUMS.SNARE, probability: 0.18, velocity: 38, ghost: true }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.25, velocity: 65 }],
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 62 },
             { drum: GM_DRUMS.TOM_FLOOR, probability: 0.12, velocity: 65 }],
    "3.67": [{ drum: GM_DRUMS.SNARE, probability: 0.25, velocity: 68 },
             { drum: GM_DRUMS.TOM_MID, probability: 0.08, velocity: 55, ghost: true }],
  },
  minHits: 2,
  maxHits: 7,
};

const COOL_JAZZ_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.75, velocity: 55 }],
    "1":    [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.15, velocity: 45 }],
    "2":    [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.25, velocity: 45 },
             { drum: GM_DRUMS.KICK, probability: 0.15, velocity: 45 }],
    "2.5":  [{ drum: GM_DRUMS.TOM_FLOOR, probability: 0.06, velocity: 38, ghost: true }],
    "3":    [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.18, velocity: 40 }],
    "3.67": [{ drum: GM_DRUMS.SIDE_STICK, probability: 0.10, velocity: 35 }],
  },
  minHits: 1,
  maxHits: 4,
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
// Kendrick Scott: accent snares, cross-stick interjections, ghost cascades, wide dynamics
const CONTEMPORARY_JAZZ_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.80, velocity: 68 }],
    "0.25": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 28, ghost: true }],
    "0.5":  [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 55 }],
    "0.75": [{ drum: GM_DRUMS.CROSS_STICK, probability: 0.12, velocity: 45 },
             { drum: GM_DRUMS.TOM_HIGH, probability: 0.08, velocity: 45, ghost: true }],
    "1":    [{ drum: GM_DRUMS.SNARE, probability: 0.22, velocity: 82 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.15, velocity: 50 }],
    "1.25": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 28, ghost: true }],
    "1.5":  [{ drum: GM_DRUMS.KICK, probability: 0.18, velocity: 55 },
             { drum: GM_DRUMS.TOM_MID, probability: 0.10, velocity: 50, ghost: true }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.40, velocity: 62 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.15, velocity: 48 }],
    "2.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.20, velocity: 85 },
             { drum: GM_DRUMS.KICK, probability: 0.15, velocity: 52 }],
    "2.75": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 28, ghost: true },
             { drum: GM_DRUMS.TOM_HIGH, probability: 0.10, velocity: 48, ghost: true }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 58 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.15, velocity: 48 }],
    "3.25": [{ drum: GM_DRUMS.TOM_MID, probability: 0.08, velocity: 42, ghost: true }],
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 50 },
             { drum: GM_DRUMS.SNARE, probability: 0.18, velocity: 80 }],
    "3.75": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 25, ghost: true }],
  },
  minHits: 2,
  maxHits: 7,
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

// Metheny: Antonio Sanchez — precise kicks, conversational snare accents, cross-stick,
// ghost cascades, wide velocity (25-90). Sanchez plays melodically, not groove-locked.
const METHENY_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.70, velocity: 78 }],
    "0.25": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 28, ghost: true }],
    "0.5":  [{ drum: GM_DRUMS.KICK, probability: 0.18, velocity: 65 },
             { drum: GM_DRUMS.TOM_HIGH, probability: 0.10, velocity: 52, ghost: true }],
    "0.75": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 28, ghost: true }],
    "1":    [{ drum: GM_DRUMS.SNARE, probability: 0.22, velocity: 85 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.15, velocity: 55 }],
    "1.5":  [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 62 },
             { drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 30, ghost: true },
             { drum: GM_DRUMS.TOM_MID, probability: 0.08, velocity: 48, ghost: true }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.30, velocity: 70 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.12, velocity: 52 }],
    "2.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.20, velocity: 88 }],
    "2.75": [{ drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 30, ghost: true },
             { drum: GM_DRUMS.TOM_HIGH, probability: 0.10, velocity: 55 }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 60 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.12, velocity: 52 }],
    "3.25": [{ drum: GM_DRUMS.TOM_MID, probability: 0.08, velocity: 45, ghost: true }],
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.15, velocity: 58 },
             { drum: GM_DRUMS.SNARE, probability: 0.18, velocity: 85 }],
    "3.75": [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 25, ghost: true }],
  },
  minHits: 2,
  maxHits: 6,
};

// Holdsworth: Chad Wackerman — displaced kicks, ghost-to-accent dynamics,
// conversational snare, cross-stick interjections, open hi-hat interactions,
// 16th-note ghost positions for cascading snare melody, wide velocity range (20-95)
const HOLDSWORTH_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.75, velocity: 85 }],
    "0.25": [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 28, ghost: true },
             { drum: GM_DRUMS.TOM_HIGH, probability: 0.04, velocity: 38, ghost: true }],
    "0.5":  [{ drum: GM_DRUMS.KICK, probability: 0.22, velocity: 70 }],
    "0.75": [{ drum: GM_DRUMS.SNARE, probability: 0.09, velocity: 30, ghost: true }],
    "1":    [{ drum: GM_DRUMS.SNARE, probability: 0.28, velocity: 90 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.18, velocity: 58 }],
    "1.25": [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 28, ghost: true },
             { drum: GM_DRUMS.TOM_MID, probability: 0.05, velocity: 42, ghost: true }],
    "1.5":  [{ drum: GM_DRUMS.KICK, probability: 0.25, velocity: 70 },
             { drum: GM_DRUMS.SNARE, probability: 0.28, velocity: 92 }],
    "1.75": [{ drum: GM_DRUMS.SNARE, probability: 0.09, velocity: 30, ghost: true },
             { drum: GM_DRUMS.TOM_FLOOR, probability: 0.04, velocity: 45, ghost: true }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.40, velocity: 78 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.18, velocity: 55 }],
    "2.25": [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 28, ghost: true }],
    "2.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.25, velocity: 88 }],
    "2.75": [{ drum: GM_DRUMS.SNARE, probability: 0.09, velocity: 30, ghost: true },
             { drum: GM_DRUMS.TOM_HIGH, probability: 0.05, velocity: 50 }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.30, velocity: 70 },
             { drum: GM_DRUMS.CROSS_STICK, probability: 0.18, velocity: 55 }],
    "3.25": [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 28, ghost: true },
             { drum: GM_DRUMS.TOM_MID, probability: 0.04, velocity: 40, ghost: true }],
    "3.5":  [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 65 },
             { drum: GM_DRUMS.SNARE, probability: 0.25, velocity: 88 }],
    "3.75": [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 25, ghost: true },
             { drum: GM_DRUMS.TOM_FLOOR, probability: 0.05, velocity: 48 }],
  },
  minHits: 2,
  maxHits: 6,
};

// Holdsworth 11/8 stochastic: Wackerman in odd meter — accents follow 3+3+3+2 grouping,
// cross-stick on group boundaries, ghost cascades between, wider position grid
const HOLDSWORTH_11_8_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.75, velocity: 85 }],
    "0.25": [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 28, ghost: true }],
    "0.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 30, ghost: true }],
    "0.75": [{ drum: GM_DRUMS.CROSS_STICK, probability: 0.20, velocity: 58 },
             { drum: GM_DRUMS.TOM_HIGH, probability: 0.04, velocity: 45, ghost: true }],
    "1":    [{ drum: GM_DRUMS.SNARE, probability: 0.30, velocity: 90 },
             { drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 28, ghost: true }],
    "1.5":  [{ drum: GM_DRUMS.KICK, probability: 0.60, velocity: 80 }],   // group 2 start
    "1.75": [{ drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 28, ghost: true },
             { drum: GM_DRUMS.TOM_MID, probability: 0.05, velocity: 48, ghost: true }],
    "2":    [{ drum: GM_DRUMS.SNARE, probability: 0.32, velocity: 92 }],
    "2.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 32, ghost: true }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.55, velocity: 78 }],   // group 3 start
    "3.25": [{ drum: GM_DRUMS.CROSS_STICK, probability: 0.20, velocity: 55 },
             { drum: GM_DRUMS.TOM_FLOOR, probability: 0.05, velocity: 55 }],
    "3.5":  [{ drum: GM_DRUMS.SNARE, probability: 0.28, velocity: 90 },
             { drum: GM_DRUMS.SNARE, probability: 0.08, velocity: 30, ghost: true }],
    "4":    [{ drum: GM_DRUMS.SNARE, probability: 0.10, velocity: 30, ghost: true },
             { drum: GM_DRUMS.TOM_MID, probability: 0.04, velocity: 42, ghost: true }],
    "4.5":  [{ drum: GM_DRUMS.KICK, probability: 0.50, velocity: 75 }],   // group 4 start
    "5":    [{ drum: GM_DRUMS.SNARE, probability: 0.12, velocity: 32, ghost: true },
             { drum: GM_DRUMS.KICK, probability: 0.18, velocity: 62 }],
  },
  minHits: 2,
  maxHits: 6,
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
  tomScale: number = 1,
): PatternHit[] {
  const densityScale = 0.5 + (density / 100) * 1.0;
  const hits: PatternHit[] = [];
  const TOM_PITCHES: Set<number> = new Set([GM_DRUMS.TOM_HIGH, GM_DRUMS.TOM_MID, GM_DRUMS.TOM_LOW, GM_DRUMS.TOM_FLOOR]);

  for (const [beatStr, slots] of Object.entries(table.slots)) {
    const beat = parseFloat(beatStr);
    for (const slot of slots) {
      const tendencyBoost = tendency.favored.includes(beatStr) ? 2.0 : 1.0;
      const isTom = TOM_PITCHES.has(slot.drum);
      const tomMult = isTom ? tomScale : 1;
      const adjustedProb = Math.min(1.0, slot.probability * densityScale * tendencyBoost * tomMult);
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

  // Snare guarantee: no drummer leaves snare silent for an entire bar (unless drumsMinimal).
  // Runs AFTER maxHits pruning so it can't be removed by the limiter.
  if (!hits.some(h => h.drum === GM_DRUMS.SNARE || h.drum === GM_DRUMS.CROSS_STICK)) {
    const snareBeats = Object.entries(table.slots)
      .filter(([, s]) => s.some(x => x.drum === GM_DRUMS.SNARE))
      .map(([b]) => parseFloat(b));
    if (snareBeats.length > 0) {
      const beat = snareBeats[Math.floor(rng() * snareBeats.length)];
      hits.push({ drum: GM_DRUMS.SNARE, beat, velocity: 30, ghost: true });
    }
  }

  return hits;
}

// ── Helpers ──

export function humanizeTime(time: number, enabled: boolean, style?: string, drumPitch?: number, random?: () => number, energy?: number, arc?: import("./types").PhraseArc | null): number {
  if (!enabled) return time;
  const template = getGrooveTemplate(style ?? "swing");
  const elementKey = drumPitch !== undefined ? drumPitchToElement(drumPitch) : "ride" as const;
  const element = template[elementKey];
  return applyGroove(time, element, random, energy, arc);
}

export function humanizeVelocity(vel: number, ghost: boolean, enabled: boolean, random?: () => number): number {
  const rng = random ?? Math.random;
  if (ghost) return Math.max(35, Math.min(50, vel + (enabled ? Math.floor((rng() - 0.5) * 10) : 0)));
  if (!enabled) return Math.max(35, Math.min(127, vel));
  return Math.max(35, Math.min(127, vel + Math.floor((rng() - 0.5) * 12)));
}

// ── Beat-to-Beat Micro-Variation ──

// alfaMist excluded: hand-crafted patterns already have dense ghost work
// (sextuplet ghosts, flams, ghost cascades). Extra random ghosts = chaotic layering.
// holdsworth excluded: stochastic table already embeds rich ghost/tom comping —
// micro-variation doubles ghosting and causes density overload.
const MICRO_VARIATION_STYLES = new Set([
  "swing", "hardBop", "coolJazz", "modal", "jazzWaltz",
  "fusion", "neoSoul", "contemporaryJazz", "metheny",
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
  granular?: DrumGranular,
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

  // Tom ghost on random offbeat (~8% base, scaled by tomFrequency) — adds melodic color between kick/snare
  // Excluded from swing/coolJazz (too sparse), modal (minimal), jazzWaltz (3/4 too tight)
  const TOM_MICRO_EXCLUDED = ["swing", "coolJazz", "modal", "jazzWaltz"];
  const tomMicroProb = 0.08 * (granular ? granular.tomFrequency / 40 : 1);
  if (rng() < tomMicroProb && !TOM_MICRO_EXCLUDED.includes(style) && beatsPerMeasure >= 4) {
    const tomPitches = [GM_DRUMS.TOM_HIGH, GM_DRUMS.TOM_MID];
    const tomPitch = tomPitches[Math.floor(rng() * tomPitches.length)];
    const beat = Math.floor(rng() * Math.min(beatsPerMeasure, 4));
    const offset = rng() < 0.5 ? 0.25 : 0.75; // 16th-note offbeat positions
    const time = measureStart + (beat + offset) * beatDuration;
    const hasTom = hits.some(h =>
      (h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID ||
       h.pitch === GM_DRUMS.TOM_LOW || h.pitch === GM_DRUMS.TOM_FLOOR) &&
      Math.abs(h.time - time) < beatDuration * 0.2);
    if (!hasTom) {
      hits.push({
        pitch: tomPitch,
        time: humanizeTime(time, humanize, undefined, undefined, rng),
        duration: 0.08,
        velocity: humanizeVelocity(42, true, humanize, rng),
      });
    }
  }
}

// ── Pattern Assembly per Style ──

export interface StylePatternSet {
  base: Pattern;         // fixed timekeeping (ride, hihat)
  variations: Pattern[]; // kick/snare comping options (held 2-4 bars for continuity)
  rideVariants?: Pattern[]; // optional ride rotation (e.g., Holdsworth bell variants)
  hihat?: Pattern;          // hihat pattern appended when ride rotates
  hihatVariants?: Pattern[];  // optional hihat rotation (rotates with ride for variety)
}

function getSwingPatternSet(rng: () => number = Math.random): StylePatternSet {
  const rideIdx = Math.floor(rng() * SWING_RIDES.length);
  const hhIdx = Math.floor(rng() * SWING_HIHATS.length);
  return {
    base: [...SWING_RIDES[rideIdx], ...SWING_HIHATS[hhIdx]],
    variations: SWING_KICK_SNARE,
    rideVariants: SWING_RIDES,
    hihatVariants: SWING_HIHATS,
  };
}

function getBossaPatternSet(): StylePatternSet {
  return { base: [...BOSSA_HIHAT, ...BOSSA_KICK, ...BOSSA_CROSS_STICK], variations: [[]] };
}

function getLatinPatternSet(): StylePatternSet {
  // Clave excluded from base - added per-measure with 2-bar phase alternation
  return { base: [...LATIN_CASCARA, ...LATIN_KICK, ...LATIN_HIHAT], variations: [[]] };
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
  // Timekeeping rotates between hihat variants and ride bell via rideVariants
  const tkIdx = Math.floor(rng() * FUSION_TIMEKEEPING.length);
  return {
    base: [...FUSION_TIMEKEEPING[tkIdx]],
    variations: FUSION_KICK_SNARE,
    rideVariants: FUSION_TIMEKEEPING,
  };
}

function getAlfaMistPatternSet(rng: () => number = Math.random): StylePatternSet {
  // 50/50 between full 16th shimmer and broken-gap hi-hat
  const hihat = rng() < 0.50 ? ALFA_MIST_HIHAT : ALFA_MIST_HIHAT_BROKEN;
  return { base: [...hihat], variations: ALFA_MIST_KICK_SNARE };
}

function getMethenyPatternSet(rng: () => number = Math.random): StylePatternSet {
  // Initial ride+HH chosen randomly; rideVariants/hihatVariants enable rotation every 4-8 bars
  const rideIdx = Math.floor(rng() * METHENY_RIDES.length);
  const hhIdx = Math.floor(rng() * METHENY_HIHATS.length);
  return {
    base: [...METHENY_RIDES[rideIdx], ...METHENY_HIHATS[hhIdx]],
    variations: METHENY_KICK_SNARE,
    rideVariants: METHENY_RIDES,
    hihatVariants: METHENY_HIHATS,
  };
}

function getHoldsworthPatternSet(rng: () => number = Math.random): StylePatternSet {
  // All ride variants have bell — Wackerman always uses bell.
  // Ride rotates every 4-8 bars via rideVariants for timbral arc.
  // HH variants also rotate for variety (Wackerman uses hat conversationally).
  // Ride D (sparse quarters) at index 0 for rideWash bias: low wash → sparse, high → dense
  const rideVariants = [HOLDSWORTH_RIDE_D, HOLDSWORTH_RIDE_B, HOLDSWORTH_RIDE_A, HOLDSWORTH_RIDE_C];
  const initialIdx = Math.floor(rng() * rideVariants.length);
  const hhIdx = Math.floor(rng() * HOLDSWORTH_HIHATS.length);
  return {
    base: [...rideVariants[initialIdx], ...HOLDSWORTH_HIHATS[hhIdx]],
    variations: HOLDSWORTH_KICK_SNARE,
    rideVariants: rideVariants,
    hihat: HOLDSWORTH_HIHATS[hhIdx],
    hihatVariants: HOLDSWORTH_HIHATS,
  };
}

function getHoldsworth11_8PatternSet(rng: () => number = Math.random): StylePatternSet {
  // Both ride variants have bell — rotate for timbral variety
  // Ride C (sparse) at index 0 for rideWash bias: low wash → sparse, high → dense
  const rideVariants = [HOLDSWORTH_11_8_RIDE_C, HOLDSWORTH_11_8_RIDE_B, HOLDSWORTH_11_8_RIDE_A];
  const initialIdx = Math.floor(rng() * rideVariants.length);
  const hhIdx = Math.floor(rng() * HOLDSWORTH_11_8_HIHATS.length);
  return {
    base: [...rideVariants[initialIdx], ...HOLDSWORTH_11_8_HIHATS[hhIdx]],
    variations: HOLDSWORTH_11_8_KICK_SNARE,
    rideVariants: rideVariants,
    hihat: HOLDSWORTH_11_8_HIHATS[hhIdx],
    hihatVariants: HOLDSWORTH_11_8_HIHATS,
  };
}

function getNeoSoulPatternSet(rng: () => number = Math.random): StylePatternSet {
  // Broken hihat rotation — Dilla/Questlove feel shifts every 4-8 bars
  const hhIdx = Math.floor(rng() * NEO_SOUL_HIHATS.length);
  return {
    base: [...NEO_SOUL_HIHATS[hhIdx]],
    variations: NEO_SOUL_KICK_SNARE,
    rideVariants: NEO_SOUL_HIHATS,
  };
}

function getContemporaryJazzPatternSet(rng: () => number = Math.random): StylePatternSet {
  const rideIdx = Math.floor(rng() * CONTEMP_RIDES.length);
  const hhIdx = Math.floor(rng() * CONTEMP_HIHATS.length);
  return {
    base: [...CONTEMP_RIDES[rideIdx], ...CONTEMP_HIHATS[hhIdx]],
    variations: CONTEMP_KICK_SNARE,
    rideVariants: CONTEMP_RIDES,
    hihatVariants: CONTEMP_HIHATS,
  };
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

function getHardBopPatternSet(rng: () => number = Math.random): StylePatternSet {
  const rideIdx = Math.floor(rng() * HARD_BOP_RIDES.length);
  const hhIdx = Math.floor(rng() * HARD_BOP_HIHATS.length);
  return {
    base: [...HARD_BOP_RIDES[rideIdx], ...HARD_BOP_HIHATS[hhIdx]],
    variations: HARD_BOP_KICK_SNARE,
    rideVariants: HARD_BOP_RIDES,
    hihatVariants: HARD_BOP_HIHATS,
  };
}

function getCoolJazzPatternSet(rng: () => number = Math.random): StylePatternSet {
  const rideIdx = Math.floor(rng() * COOL_RIDES.length);
  const hhIdx = Math.floor(rng() * COOL_HIHATS.length);
  return {
    base: [...COOL_RIDES[rideIdx], ...COOL_HIHATS[hhIdx]],
    variations: COOL_KICK_SNARE,
    rideVariants: COOL_RIDES,
    hihatVariants: COOL_HIHATS,
  };
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
export function getStylePatternSet(style: string, rng: () => number = Math.random): StylePatternSet {
  switch (style) {
    case "bossa": return getBossaPatternSet();
    case "latin": return getLatinPatternSet();
    case "ballad": return getBalladPatternSet();
    case "funk": return getFunkPatternSet();
    case "fusion": return getFusionPatternSet(rng);
    case "ecm": return getEcmPatternSet();
    case "hardBop": return getHardBopPatternSet(rng);
    case "coolJazz": return getCoolJazzPatternSet(rng);
    case "modal": return getModalPatternSet();
    case "jazzWaltz": return getJazzWaltzPatternSet();
    case "shuffleBlues": return getShuffleBluesPatternSet();
    case "neoSoul": return getNeoSoulPatternSet(rng);
    case "contemporaryJazz": return getContemporaryJazzPatternSet(rng);
    case "mathRock": return getMathRockPatternSet(rng);
    case "idm": return getIdmPatternSet(rng);
    case "holdsworth": return getHoldsworthPatternSet(rng);
    case "alfaMist": return getAlfaMistPatternSet(rng);
    case "metheny": return getMethenyPatternSet(rng);
    case "swing":
    default: return getSwingPatternSet(rng);
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
  // Exception: styles with their own odd-meter patterns (e.g., Holdsworth 11/8)
  // use style-specific patterns to preserve musical character.
  const meterPatternSet = getMeterPatternSet(timeSig, rng);
  const hasStyleOddMeter = style === "holdsworth" && timeSig[0] === 11 && timeSig[1] === 8;
  const isOddMeter = !hasStyleOddMeter && meterPatternSet !== null && !(timeSig[0] === 4 && timeSig[1] === 4) && !(timeSig[0] === 3 && timeSig[1] === 4 && style === "jazzWaltz");

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
      case "hardBop": patternSet = getHardBopPatternSet(rng); break;
      case "coolJazz": patternSet = getCoolJazzPatternSet(rng); break;
      case "modal": patternSet = getModalPatternSet(); break;
      case "jazzWaltz": patternSet = getJazzWaltzPatternSet(); break;
      case "shuffleBlues": patternSet = getShuffleBluesPatternSet(); break;
      case "neoSoul": patternSet = getNeoSoulPatternSet(rng); break;
      case "contemporaryJazz": patternSet = getContemporaryJazzPatternSet(rng); break;
      case "mathRock": patternSet = getMathRockPatternSet(rng); break;
      case "idm": patternSet = getIdmPatternSet(rng); break;
      case "holdsworth": patternSet = (timeSig[0] === 11 && timeSig[1] === 8) ? getHoldsworth11_8PatternSet(rng) : getHoldsworthPatternSet(rng); break;
      case "alfaMist": patternSet = getAlfaMistPatternSet(rng); break;
      case "metheny": patternSet = getMethenyPatternSet(rng); break;
      case "swing":
      default: patternSet = getSwingPatternSet(rng); break;
    }
  }

  // Phrase continuity: hold kick/snare variation for 2-4 bars before switching
  // For stochastic styles, "tendency" replaces fixed variation rotation.
  // In streaming (measures=1), state is restored from options.drumState to maintain
  // continuity across calls.
  const isStochastic = STOCHASTIC_STYLES.has(style);
  // Holdsworth in 11/8 uses its own stochastic table adapted for odd-meter groupings
  const stochasticTable = isStochastic
    ? (style === "holdsworth" && timeSig[0] === 11 && timeSig[1] === 8
       ? HOLDSWORTH_11_8_STOCHASTIC
       : STOCHASTIC_TABLES[style])
    : null;
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

  // Ride + hihat rotation: when rideVariants present, swap timbre every 4-8 bars
  const rideVariants = patternSet.rideVariants;
  const hhVariants = patternSet.hihatVariants;
  // rideWash biases variant selection: low wash → sparse (idx 0), high → dense (higher idx)
  const rideWashBias = options.granular ? options.granular.rideWash / 50 : 1; // 0-2 range, 1=neutral
  let rideIdx = rideVariants ? Math.min(rideVariants.length - 1, Math.floor(rng() * rideVariants.length * rideWashBias)) : -1;
  let hhIdx = hhVariants ? Math.floor(rng() * hhVariants.length) : -1;
  let barsOnRide = 0;
  let rideHoldBars = rideVariants ? (4 + Math.floor(rng() * 5)) : Infinity;

  // Latin clave 2-bar phase tracking: 0 = 3-side, 1 = 2-side
  const isLatin = style === "latin";
  let clavePhase = ds?.clavePhase ?? 0;

  // Brush articulation: ballad, coolJazz, ECM use brushes instead of sticks.
  // Annotates snare hits with sweep/tap/swirl for renderers that support it.
  const BRUSH_STYLES = new Set(["ballad", "coolJazz", "ecm"]);
  const useBrushes = BRUSH_STYLES.has(style);

  const hits: DrumHit[] = [];
  let lastFillIdx = options.drumState?.lastFillIdx ?? -1;

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

    // Ride + hihat rotation: swap ride bell density every 4-8 bars for timbral arc
    if (rideVariants && barsOnRide >= rideHoldBars) {
      const rideCandidates = Array.from({ length: rideVariants.length }, (_, i) => i)
        .filter((i) => i !== rideIdx);
      // rideWash biases rotation: high wash → prefer higher (denser) indices
      const rideRotIdx = Math.min(rideCandidates.length - 1, Math.floor(rng() * rideCandidates.length * rideWashBias));
      rideIdx = rideCandidates[rideRotIdx];
      // Also rotate hihat — filter current to guarantee change
      if (hhVariants && hhVariants.length > 1) {
        const hhCandidates = Array.from({ length: hhVariants.length }, (_, i) => i)
          .filter((i) => i !== hhIdx);
        hhIdx = hhCandidates[Math.floor(rng() * hhCandidates.length)];
      }
      const hh = hhVariants ? hhVariants[hhIdx] : (patternSet.hihat ?? []);
      patternSet.base = [...rideVariants[rideIdx], ...hh];
      patternSet.hihat = hh;
      rideHoldBars = 4 + Math.floor(rng() * 5);
      barsOnRide = 0;
    }

    const measureStart = startTime + m * measureDuration;

    // BandContext: section energy scales intensity (0.3=sparse intro, 1.0=dense shout)
    const energy = bandCtx?.sectionEnergy ?? 0.7;
    const feel = bandCtx?.currentPhraseIntent?.feel ?? "normal";

    // ── Musicality: Drums Minimal (ride + pedal hat only) ──
    // When phrase intent says this measure should be minimal, strip to timekeeping only.
    // Creates dramatic breathing room — silence is the most powerful musical tool.
    const absoluteM = Math.round(measureStart / measureDuration);
    // Per-measure phrase intent lookup (not stale currentPhraseIntent)
    const phraseIntent = bandCtx?.phraseMap
      ? lookupDrumIntent(absoluteM, bandCtx.phraseMap)
      : bandCtx?.currentPhraseIntent ?? null;
    const arc = phraseIntent?.arc;
    if (phraseIntent?.drumsMinimal?.includes(absoluteM)) {
      // Minimal drums: just ride quarters and pedal hat on 2&4
      for (let b = 0; b < beatsPerMeasure; b++) {
        const t = measureStart + b * beatDuration;
        hits.push({
          pitch: GM_DRUMS.RIDE,
          time: Math.max(0, humanizeTime(t, humanize, style, GM_DRUMS.RIDE, rng, energy, arc)),
          duration: 0.08,
          velocity: humanizeVelocity(b === 0 ? 55 : 45, false, humanize, rng),
        });
        if (b === 1 || b === 3) {
          hits.push({
            pitch: GM_DRUMS.HI_HAT_PEDAL,
            time: Math.max(0, humanizeTime(t, humanize, style, GM_DRUMS.HI_HAT_PEDAL, rng, energy, arc)),
            duration: 0.05,
            velocity: humanizeVelocity(35, false, humanize, rng),
          });
        }
      }
      barsOnPattern++;
      continue;
    }

    // ── Phrase Arc Dynamics ──
    // Drums respond to phrase arc: build/climax = busier+louder, release = sparser+softer.
    // Without this, drums play identically regardless of musical narrative.
    const isDrop = phraseIntent?.dropMeasures?.includes(absoluteM) ?? false;
    const arcVelMult = isDrop ? 0.7
      : arc === "shout" ? 1.20
      : arc === "climax" ? 1.15
      : arc === "build" || arc === "solo" ? 1.05 + (phraseIntent?.crescendo ? 0.05 : 0)
      : arc === "vamp" ? 1.0
      : arc === "release" || arc === "outro" || arc === "interlude" ? 0.88
      : arc === "drop" || arc === "breakdown" ? 0.75
      : arc === "intro" ? 0.90
      : 1.0;
    // Build/climax: accept more ghost notes (lower threshold). Release/drop: strip ghosts.
    const arcGhostAdjust = isDrop ? 20
      : arc === "shout" ? -10
      : arc === "climax" ? -8
      : arc === "build" || arc === "solo" ? -4
      : arc === "release" || arc === "outro" || arc === "interlude" ? 8
      : arc === "drop" || arc === "breakdown" ? 15
      : arc === "intro" ? 5
      : 0;

    // ── Feel Changes (double-time / half-time) ──
    // Double-time: boost energy and density. Half-time: sparse, laid back.
    const feelVelMult = feel === "doubleTime" ? 1.1 : feel === "halfTime" ? 0.85 : 1.0;
    const feelGhostAdjust = feel === "doubleTime" ? -10 : feel === "halfTime" ? 15 : 0;

    // ── Conversation Awareness ──
    // When drums are the leader, play more actively. When listening, pull back.
    const isLeader = phraseIntent?.conversationLeader === "drums";
    const isListening = phraseIntent?.conversationLeader != null && !isLeader;
    // Leader: louder and more present. Listening: pull back (ride + time only feel)
    const convDrumVelMult = isLeader ? 1.12 : isListening ? 0.82 : 1.0;

    // Crash cymbal on form boundaries — louder at section boundaries
    // Alfa Mist: crashes only on section starts or 30% of phrase boundaries (sparse, not every 4 bars)
    if (formMarkers.includes(m)) {
      const isSectionStart = sectionMarkers.includes(m);
      const crashProb = style === "alfaMist" ? (isSectionStart ? 0.8 : 0.25) : 1.0;
      if (m === 0 || rng() < crashProb) {
        // BandContext: crash velocity scales with energy (soft intros, big climaxes)
        const crashBaseVel = isSectionStart ? 85 : 70;
        const crashVel = Math.round(crashBaseVel * (0.6 + energy * 0.4));
        // cymbalColor: probability to substitute crash with splash or china for timbral variety
        const cymColor = options.granular ? options.granular.cymbalColor : 0;
        let cymbalPitch: number = GM_DRUMS.CRASH;
        if (cymColor > 0 && rng() < cymColor / 100) {
          cymbalPitch = rng() < 0.6 ? GM_DRUMS.SPLASH : GM_DRUMS.CHINA;
        }
        hits.push({
          pitch: cymbalPitch,
          time: Math.max(0, humanizeTime(measureStart, humanize, style, GM_DRUMS.CRASH, rng, energy, arc)),
          duration: isSectionStart ? 0.15 : 0.08,
          velocity: humanizeVelocity(crashVel, false, humanize, rng),
        });
      }
    }

    // Structure-aware fills: size matches form position
    // BandContext: fill probability scales with energy — sparse sections rarely fill
    // In streaming (measures=1), fillHint from ensemble.ts provides lookahead info
    // since the single-measure loop can't look at m+1/m+2.
    //
    // Harmonic-aware: boost fill probability before cadence resolutions.
    // Real drummers set up cadences with fills to mark the arrival.
    let fillPattern: Pattern | null = null;
    const fillHint = options.fillHint;
    const isBeforeCadence = (() => {
      const ha = bandCtx?.harmonicAnalysis;
      if (!ha) return false;
      // Check if next measure's chord is a cadence resolution (V-I arrival)
      const nextMeasureIdx = absoluteM + 1;
      return nextMeasureIdx < ha.chordAnalyses.length
        && ha.chordAnalyses[nextMeasureIdx].cadenceRole === "resolution"
        && ha.chordAnalyses[nextMeasureIdx].cadenceType === "authentic";
    })();
    if (FILL_STYLES.has(style) && (m > 0 || fillHint)) {
      const isBeforeSectionMarker = fillHint === "section" || sectionMarkers.includes(m + 1);
      const isBeforeFormMarker = fillHint === "phrase" || formMarkers.includes(m + 1) || isBeforeCadence;
      const isSetupBar = fillHint === "setup" || sectionMarkers.includes(m + 2);

      // Energy multiplier: at energy 0.3 fills are 40% as likely, at 1.0 fully likely
      const energyFillMult = 0.2 + energy * 0.8;

      // Tempo fill scaling: reduce fill frequency at fast tempos (>220)
      // Fills at fast tempos sound cluttered and unmusical
      const tempoFillScale = tempo > 220 ? Math.max(0.3, 1.0 - (tempo - 220) / 200) : 1.0;

      // Style-specific fill frequency: Wackerman fills frequently and dramatically,
      // Alfa Mist is sparse and broken-beat, others are standard jazz.
      const fillScale = fillProbScale(options.granular?.fillIntensity ?? 50) * tempoFillScale;
      const sectionProb = (style === "alfaMist" ? 0.35 : style === "holdsworth" ? 0.55 : style === "metheny" ? 0.70 : 0.6) * energyFillMult * fillScale;
      const phraseProb = (style === "alfaMist" ? 0.20 : style === "holdsworth" ? 0.30 : style === "metheny" ? 0.50 : 0.4) * energyFillMult * fillScale;

      if (isBeforeSectionMarker && rng() < sectionProb) {
        const pool = style === "holdsworth" ? (hasStyleOddMeter ? HOLDSWORTH_11_8_FILLS : HOLDSWORTH_FILLS)
          : style === "alfaMist" ? ALFA_MIST_FILLS
          : style === "fusion" ? FUSION_FILLS : JAZZ_FILLS_BIG;
        fillPattern = selectContextualFill(pool, energy, arc, lastFillIdx, rng);
        lastFillIdx = pool.indexOf(fillPattern);
      } else if (isBeforeFormMarker && rng() < phraseProb) {
        const pool = style === "holdsworth" ? (hasStyleOddMeter ? HOLDSWORTH_11_8_FILLS : HOLDSWORTH_FILLS)
          : style === "alfaMist" ? ALFA_MIST_FILLS
          : style === "fusion" ? FUSION_FILLS : JAZZ_FILLS;
        fillPattern = selectContextualFill(pool, energy, arc, lastFillIdx, rng);
        lastFillIdx = pool.indexOf(fillPattern);
      } else if (isSetupBar && rng() < 0.25 * energyFillMult) {
        fillPattern = SETUP_FILLS[Math.floor(rng() * SETUP_FILLS.length)];
      }
    }

    // Comping: stochastic per-beat generation for jazz styles, fixed arrays for others
    // Fast harmonic rhythm: reduce comping density to avoid clutter over rapid changes
    const hr = bandCtx?.harmonicRhythm ?? 1;
    const hrDensityScale = hr >= 3 ? 0.6 : hr >= 2 ? 0.8 : 1.0;
    const effectiveDensity = Math.round(density * hrDensityScale);
    const tomScale = options.granular ? options.granular.tomFrequency / 40 : 1;
    let compHits: PatternHit[];
    if (isStochastic && stochasticTable && tendency) {
      compHits = generateStochasticComping(stochasticTable, effectiveDensity, tendency, rng, tomScale);
    } else {
      compHits = patternSet.variations[variationIdx];
    }

    // When fill is active, keep comping hits on beats 1-2 only (fill replaces beats 3-4)
    const variationHits = fillPattern ? compHits.filter((h) => h.beat < 2) : compHits;

    // Latin clave: 2-bar phase alternation (3-side / 2-side)
    const claveHits = isLatin ? (clavePhase === 0 ? LATIN_CLAVE_3 : LATIN_CLAVE_2) : [];

    const pattern = [...patternSet.base, ...claveHits, ...variationHits, ...(fillPattern ?? [])];

    // BandContext: energy-aware ghost note threshold — low energy strips ghosts earlier
    // Arc adjustment: build/climax keep more ghosts (busier), release/drop strip them (sparser)
    // Cap at 40 to always preserve some ghost notes (was uncapped to 55, stripping all ghosts in drops)
    // ghostDensity slider: high = more ghosts survive (lower threshold), low = cleaner sound
    // Fast tempo shift: raise threshold to strip ghosts at speed (>220 BPM)
    const tempoGhostShift = tempo > 220 ? Math.min(15, (tempo - 220) * 0.15) : 0;
    const ghostShift = options.granular ? (options.granular.ghostDensity - 40) * -0.4 : 0;
    const ghostThreshold = bandCtx ? Math.min(40, Math.round(15 + (1 - energy) * 20 + arcGhostAdjust + feelGhostAdjust + ghostShift + tempoGhostShift)) : Math.max(0, Math.round(15 + ghostShift + tempoGhostShift));

    for (const hit of pattern) {
      if (hit.beat >= beatsPerMeasure) continue;

      // Half-time: thin pattern by dropping non-essential hits on offbeats
      if (feel === "halfTime" && hit.beat % 1 !== 0 && hit.drum !== GM_DRUMS.RIDE && hit.drum !== GM_DRUMS.RIDE_BELL) {
        if (rng() < 0.5) continue; // drop 50% of offbeat non-ride hits
      }

      // Density filtering: ghost notes removed at low density (threshold rises in quiet sections)
      if (hit.ghost && density < ghostThreshold) continue;

      // Apply swingAmount to pre-swung skip notes (0.67 positions → parametric)
      let beat = hit.beat;
      const frac = beat % 1;
      if (Math.abs(frac - 0.67) < 0.02) {
        const effectiveSwing = swingAmount * tempoSwingMultiplier(tempo, bandCtx?.sectionEnergy) * instrumentSwingFactor("drums");
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
      const drumHit: DrumHit = {
        pitch: hit.drum,
        time: Math.max(0, humanizeTime(time, humanize, style, hit.drum, rng, energy, arc)
          + rubatoOffset(style, hit.beat, beatsPerMeasure, arc)),
        duration: 0.08,
        velocity: humanizeVelocity(Math.round(hit.velocity * dynMult * energyVelMult * arcVelMult * feelVelMult * convDrumVelMult), hit.ghost ?? false, humanize, rng),
      };
      // Brush articulation for ballad/coolJazz/ECM styles
      if (useBrushes) {
        if (hit.drum === GM_DRUMS.SNARE || hit.drum === GM_DRUMS.CROSS_STICK || hit.drum === GM_DRUMS.SIDE_STICK) {
          // Beats 2 and 4: tap articulation (brush strike), others: sweep (continuous motion)
          const isBackbeat = Math.abs(hit.beat - 1) < 0.1 || Math.abs(hit.beat - 3) < 0.1;
          drumHit.brush = isBackbeat ? "tap" : (hit.ghost ? "swirl" : "sweep");
        } else if (hit.drum === GM_DRUMS.RIDE || hit.drum === GM_DRUMS.RIDE_BELL) {
          drumHit.brush = "sweep"; // brush on cymbal = wash
        }
      }
      hits.push(drumHit);
    }

    applyMicroVariation(hits, measureStart, beatDuration, beatsPerMeasure, style, density, humanize, rng, options.granular);

    barsOnPattern++;
    barsOnRide++;
    if (isLatin) clavePhase = 1 - clavePhase; // alternate 3-side / 2-side
  }

  // Persist state for streaming continuity across 1-measure calls
  if (ds) {
    ds.variationIdx = variationIdx;
    ds.barsOnPattern = barsOnPattern;
    ds.patternHoldBars = patternHoldBars;
    ds.tendency = tendency;
    ds.clavePhase = clavePhase;
    ds.lastFillIdx = lastFillIdx;
  }

  hits.sort((a, b) => a.time - b.time);

  interlockKickHihat(hits, style, rng);

  return hits;
}

// ── Phrase Intent Lookup (per-measure, not stale snapshot) ──

function lookupDrumIntent(measure: number, phraseMap: { boundaries: number[]; intents?: PhraseIntent[] }): PhraseIntent | null {
  if (!phraseMap.intents || phraseMap.intents.length === 0) return null;
  for (let i = phraseMap.boundaries.length - 1; i >= 0; i--) {
    if (measure >= phraseMap.boundaries[i]) {
      return phraseMap.intents[i] ?? null;
    }
  }
  return null;
}

// ── Kick-HiHat Interlocking ──

const INTERLOCK_STYLES = new Set(["swing", "hardBop", "coolJazz", "modal", "neoSoul", "contemporaryJazz", "holdsworth", "alfaMist"]);

export function interlockKickHihat(hits: DrumHit[], style: string, random?: () => number, prob?: number): void {
  if (!INTERLOCK_STYLES.has(style)) return;
  const rng = random ?? Math.random;
  const interlockProb = prob ?? 0.6;

  const kicks = hits.filter(h => h.pitch === GM_DRUMS.KICK);
  for (const kick of kicks) {
    for (const hit of hits) {
      if (hit.pitch !== GM_DRUMS.HI_HAT_CLOSED) continue;
      if (Math.abs(hit.time - kick.time) > 0.02) continue;

      if (rng() < interlockProb) {
        hit.pitch = GM_DRUMS.HI_HAT_OPEN;
        hit.velocity = Math.min(hit.velocity + 10, 70);
        hit.duration = 0.12;
      } else {
        hit.velocity = Math.max(25, hit.velocity - 20);
      }
    }
  }
}
