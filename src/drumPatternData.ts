/** Drum pattern data - pure constants, no logic. Extracted from drumPatterns.ts for G29. */

// ── Pattern Definition Types ──

export interface PatternHit {
  drum: number;      // GM pitch
  beat: number;      // beat position (0-based, in quarter notes)
  velocity: number;  // base velocity
  ghost?: boolean;   // ghost note (reduced velocity)
}

export type Pattern = PatternHit[];

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

// ── Style Patterns ──
// Beat positions: 0 = beat 1, 0.5 = "and" of 1, 1 = beat 2, etc.
// For 4/4 time: range [0, 4)

// ── SWING ──

// Ride A: standard swing ride with skip-note
export const SWING_RIDE_A: Pattern = [
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
export const SWING_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 92 },
  { drum: GM_DRUMS.RIDE, beat: 0.67, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 1.67, velocity: 58 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 2.67, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 3.67, velocity: 58 },
];

export const SWING_RIDES = [SWING_RIDE_A, SWING_RIDE_B];

// HH A: pedal on 2 and 4 — standard jazz foot hat (most common)
export const SWING_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 55 },
];

// HH B: pedal on all beats — Philly Joe Jones driving feel
export const SWING_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 0, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 55 },
];

// HH C: pedal on 2 and 4 + light ghost on upbeats (busier sections only)
export const SWING_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 22, ghost: true },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3.5, velocity: 22, ghost: true },
];

export const SWING_HIHATS = [SWING_HIHAT_A, SWING_HIHAT_A, SWING_HIHAT_B, SWING_HIHAT_C];

export const SWING_KICK_SNARE: Pattern[] = [
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

export const BOSSA_HIHAT: Pattern = [
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

export const BOSSA_KICK: Pattern = [
  // Classic bossa kick: beat 1 and "and" of 2 (anticipation of 3)
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 85 },
  { drum: GM_DRUMS.KICK, beat: 1.5, velocity: 75 },
  { drum: GM_DRUMS.KICK, beat: 3, velocity: 80 },
  { drum: GM_DRUMS.KICK, beat: 3.5, velocity: 65 },
];

export const BOSSA_CROSS_STICK: Pattern = [
  // Cross-stick (rim click) on 2 and 4
  { drum: GM_DRUMS.CROSS_STICK, beat: 1, velocity: 75 },
  { drum: GM_DRUMS.CROSS_STICK, beat: 3, velocity: 70 },
];

// ── LATIN (Afro-Cuban) ──

export const LATIN_CASCARA: Pattern = [
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

export const LATIN_KICK: Pattern = [
  // Tumbao-style kick (matches bass)
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.KICK, beat: 2.5, velocity: 80 },
];

export const LATIN_HIHAT: Pattern = [
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
export const LATIN_CLAVE_3: Pattern = [
  { drum: GM_DRUMS.CLAVES, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.CLAVES, beat: 1.5, velocity: 80 },
  { drum: GM_DRUMS.CLAVES, beat: 3, velocity: 85 },
];
export const LATIN_CLAVE_2: Pattern = [
  { drum: GM_DRUMS.CLAVES, beat: 1, velocity: 85 },
  { drum: GM_DRUMS.CLAVES, beat: 2.5, velocity: 80 },
];

// ── BALLAD ──

export const BALLAD_RIDE: Pattern = [
  // Sparse ride — quarters with swell feel
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

export const BALLAD_KICK: Pattern[] = [
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

export const BALLAD_HIHAT: Pattern = [
  // Gentle hi-hat pedal on 2 and 4
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 50 },
];

// ── FUNK ──

export const FUNK_HIHAT: Pattern = [
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

export const FUNK_KICK_SNARE: Pattern[] = [
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
export const FUSION_HIHAT_A: Pattern = [
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
export const FUSION_HIHAT_B: Pattern = [
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
export const FUSION_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 72 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 80 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 75 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 72 },
];

export const FUSION_KICK_SNARE: Pattern[] = [
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
export const FUSION_RIDE_BELL: Pattern = [
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
export const FUSION_TIMEKEEPING = [FUSION_HIHAT_A, FUSION_HIHAT_B, FUSION_HIHAT_C, FUSION_RIDE_BELL];

// Linear drumming (Weckl/Gadd): no two limbs simultaneously
// These patterns encode the full kit — base should be empty
export const FUSION_LINEAR_A: Pattern = [
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

export const FUSION_LINEAR_B: Pattern = [
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
export const FUSION_FILLS: Pattern[] = [
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
export const HOLDSWORTH_FILLS: Pattern[] = [
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
export const HOLDSWORTH_RIDE_A: Pattern = [
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
export const HOLDSWORTH_RIDE_B: Pattern = [
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
export const HOLDSWORTH_RIDE_C: Pattern = [
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
export const HOLDSWORTH_RIDE_D: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 82 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 62 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 60 },
];

// 4/4 Hi-hat variants — rotate with ride for variety
export const HOLDSWORTH_HIHAT_A: Pattern = [
  // Pedal on 2&4 + open hat accent on "and" of 2
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.5, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 50 },
];
export const HOLDSWORTH_HIHAT_B: Pattern = [
  // Open hat on "and" of 1, pedal on 3 — shifted emphasis
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 48 },
];
export const HOLDSWORTH_HIHAT_C: Pattern = [
  // Two open hats — brighter, more conversational
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3.5, velocity: 38 },
];
// Ride-only: no hihat — lets ride breathe without cymbal overlap (Wackerman often drops hat)
export const HOLDSWORTH_HIHAT_NONE: Pattern = [];
export const HOLDSWORTH_HIHATS = [HOLDSWORTH_HIHAT_A, HOLDSWORTH_HIHAT_B, HOLDSWORTH_HIHAT_C, HOLDSWORTH_HIHAT_NONE];

export const HOLDSWORTH_KICK_SNARE: Pattern[] = [
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
export const HOLDSWORTH_11_8_RIDE_A: Pattern = [
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
export const HOLDSWORTH_11_8_RIDE_B: Pattern = [
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
export const HOLDSWORTH_11_8_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 82 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 58 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1.5, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 3, velocity: 78 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 55 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 4.5, velocity: 75 },
];

// 11/8 Hi-hat variants — rotate to break monotony (Wackerman uses hat as conversation)
export const HOLDSWORTH_11_8_HIHAT_A: Pattern = [
  // Pedal on group boundaries + open hat accent
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1.5, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 4.5, velocity: 45 },
];
export const HOLDSWORTH_11_8_HIHAT_B: Pattern = [
  // Open hat on group 2, pedal on 3 — shifted emphasis
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 44 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 4, velocity: 38 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 5, velocity: 40 },
];
export const HOLDSWORTH_11_8_HIHAT_C: Pattern = [
  // Sparse — only two pedal hits, maximum air
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1.5, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 4.5, velocity: 40 },
];
// Ride-only: no hihat — lets ride breathe without cymbal overlap
export const HOLDSWORTH_11_8_HIHAT_NONE: Pattern = [];
export const HOLDSWORTH_11_8_HIHATS = [HOLDSWORTH_11_8_HIHAT_A, HOLDSWORTH_11_8_HIHAT_B, HOLDSWORTH_11_8_HIHAT_C, HOLDSWORTH_11_8_HIHAT_NONE];

export const HOLDSWORTH_11_8_KICK_SNARE: Pattern[] = [
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
export const HOLDSWORTH_11_8_FILLS: Pattern[] = [
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

export const ALFA_MIST_HIHAT: Pattern = [
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
export const ALFA_MIST_HIHAT_BROKEN: Pattern = [
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

export const ALFA_MIST_KICK_SNARE: Pattern[] = [
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
export const METHENY_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 58 },
];

// Ride B: brush-like — softer, swish quality on 2 and 4
export const METHENY_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 52 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 52 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 60 },
];

// Ride C: bell accents — Sanchez melodic bell work on 1 and 3, ride body between
export const METHENY_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 82 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 52 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 2, velocity: 80 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 3.5, velocity: 52 },
];

export const METHENY_RIDES = [METHENY_RIDE_A, METHENY_RIDE_B, METHENY_RIDE_C];

// HH A: minimal pedal on 2 and 4 (Moses: less is more)
export const METHENY_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 42 },
];

// HH B: open hat splash on 3 (Sanchez conversational hat)
export const METHENY_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 3, velocity: 38 },
];

// HH C: sparse — just pedal on 4 (maximum space)
export const METHENY_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 38 },
];

export const METHENY_HIHATS = [METHENY_HIHAT_A, METHENY_HIHAT_B, METHENY_HIHAT_C];

export const METHENY_KICK_SNARE: Pattern[] = [
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
export const NEO_SOUL_HIHAT_A: Pattern = [
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
export const NEO_SOUL_HIHAT_B: Pattern = [
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
export const NEO_SOUL_HIHAT_C: Pattern = [
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

export const NEO_SOUL_HIHATS = [NEO_SOUL_HIHAT_A, NEO_SOUL_HIHAT_B, NEO_SOUL_HIHAT_C];

export const NEO_SOUL_KICK_SNARE: Pattern[] = [
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
export const CONTEMP_RIDE_A: Pattern = [
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
export const CONTEMP_RIDE_B: Pattern = [
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
export const CONTEMP_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 62 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

export const CONTEMP_RIDES = [CONTEMP_RIDE_A, CONTEMP_RIDE_B, CONTEMP_RIDE_C];

// HH A: pedal on 2 and 4
export const CONTEMP_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 45 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 45 },
];

// HH B: open hat splash on "and" of 2 — Kendrick Scott texture
export const CONTEMP_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_OPEN, beat: 1.5, velocity: 38 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 42 },
];

// HH C: sparse — just pedal on 4
export const CONTEMP_HIHAT_C: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 40 },
];

export const CONTEMP_HIHATS = [CONTEMP_HIHAT_A, CONTEMP_HIHAT_B, CONTEMP_HIHAT_C];

export const CONTEMP_KICK_SNARE: Pattern[] = [
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
export const MATH_HIHAT_5: Pattern = [
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
export const MATH_HIHAT_3: Pattern = [
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

export const MATH_KICK_SNARE: Pattern[] = [
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
export const IDM_HIHAT: Pattern = [
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

export const IDM_HIHAT_B: Pattern = [
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

export const IDM_HIHAT_C: Pattern = [
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

export const IDM_KICK_SNARE: Pattern[] = [
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

export const ECM_RIDE: Pattern = [
  // Brush-like ride, soft quarters (audible but restrained)
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

export const ECM_KICK: Pattern = [
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 55 },
];

export const ECM_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 45 },
];

export const ECM_SNARE: Pattern[] = [
  // Side-stick adds subtle rhythmic texture
  [{ drum: GM_DRUMS.SIDE_STICK, beat: 2, velocity: 40 }],
  [], // some measures: no snare (space)
];

// ── HARD BOP ──

// Ride A: loud, driving ride with prominent skip-note (Blakey standard)
export const HARD_BOP_RIDE_A: Pattern = [
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
export const HARD_BOP_RIDE_B: Pattern = [
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
export const HARD_BOP_RIDE_C: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 95 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 90 },
];

export const HARD_BOP_RIDES = [HARD_BOP_RIDE_A, HARD_BOP_RIDE_B, HARD_BOP_RIDE_C];

// HH A: heavy pedal on 2 and 4
export const HARD_BOP_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 70 },
];

// HH B: pedal on all beats — Blakey driving feel
export const HARD_BOP_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 0, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 68 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 68 },
];

export const HARD_BOP_HIHATS = [HARD_BOP_HIHAT_A, HARD_BOP_HIHAT_B];

export const HARD_BOP_KICK_SNARE: Pattern[] = [
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
export const COOL_RIDE_A: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

// Ride B: gentle 8ths — Motian spacious
export const COOL_RIDE_B: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 42 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 52 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 58 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 42 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 52 },
];

export const COOL_RIDES = [COOL_RIDE_A, COOL_RIDE_B];

// HH A: light brush sweeps (closed hat as proxy)
export const COOL_HIHAT_A: Pattern = [
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 3, velocity: 50 },
];

// HH B: pedal only on 2 and 4 — more space
export const COOL_HIHAT_B: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 42 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 42 },
];

export const COOL_HIHATS = [COOL_HIHAT_A, COOL_HIHAT_B];

export const COOL_KICK_SNARE: Pattern[] = [
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

export const MODAL_RIDE: Pattern = [
  // Sparse ride quarters, open and spacious
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 55 },
];

export const MODAL_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 40 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 40 },
];

export const MODAL_KICK: Pattern[] = [
  [{ drum: GM_DRUMS.KICK, beat: 0, velocity: 50 }],
  // Var 2: kick on beat 3 (soft, spacious feel)
  [{ drum: GM_DRUMS.KICK, beat: 2, velocity: 45 }],
];

// ── JAZZ WALTZ (3/4) ──

export const WALTZ_RIDE: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
];

export const WALTZ_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 55 },
];

export const WALTZ_KICK: Pattern = [
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 60 },
];

// ── 5/4 (Take Five / Brubeck) ──
// Grouping: 3+2 (most common) or 2+3

export const FIVE_FOUR_RIDE_3_2: Pattern = [
  // Ride quarter notes, accent on grouping boundaries (beats 1 and 4)
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 70 },
];

export const FIVE_FOUR_HIHAT: Pattern = [
  // Hi-hat pedal on grouping boundary and end
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 4, velocity: 50 },
];

export const FIVE_FOUR_KICK_SNARE: Pattern[] = [
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

export const SEVEN_EIGHT_RIDE_223: Pattern = [
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

export const SEVEN_EIGHT_RIDE_322: Pattern = [
  // 3+2+2 grouping
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 65 },
  { drum: GM_DRUMS.RIDE, beat: 1.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 60 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 60 },
];

export const SEVEN_EIGHT_KICK_SNARE: Pattern[] = [
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

export const SIX_EIGHT_RIDE: Pattern = [
  // Bell pattern: dotted quarter feel
  { drum: GM_DRUMS.RIDE_BELL, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 0.5, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE_BELL, beat: 1.5, velocity: 85 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.RIDE, beat: 2.5, velocity: 70 },
];

export const SIX_EIGHT_HIHAT: Pattern = [
  // Afro 6/8 bell pattern (simplified)
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 0.5, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 1.5, velocity: 70 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2, velocity: 50 },
  { drum: GM_DRUMS.HI_HAT_CLOSED, beat: 2.5, velocity: 55 },
];

export const SIX_EIGHT_KICK_SNARE: Pattern[] = [
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

export const NINE_EIGHT_RIDE: Pattern = [
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

export const NINE_EIGHT_KICK_SNARE: Pattern[] = [
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

export const SIX_FOUR_RIDE: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 5, velocity: 75 },
];

export const SIX_FOUR_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 5, velocity: 55 },
];

export const SIX_FOUR_KICK_SNARE: Pattern[] = [
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

export const SEVEN_FOUR_RIDE: Pattern = [
  { drum: GM_DRUMS.RIDE, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.RIDE, beat: 1, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 2, velocity: 75 },
  { drum: GM_DRUMS.RIDE, beat: 3, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 4, velocity: 88 },
  { drum: GM_DRUMS.RIDE, beat: 5, velocity: 70 },
  { drum: GM_DRUMS.RIDE, beat: 6, velocity: 75 },
];

export const SEVEN_FOUR_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 2, velocity: 55 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 5, velocity: 55 },
];

export const SEVEN_FOUR_KICK_SNARE: Pattern[] = [
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

export const ELEVEN_EIGHT_RIDE: Pattern = [
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

export const ELEVEN_EIGHT_KICK_SNARE: Pattern[] = [
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

export const SHUFFLE_RIDE: Pattern = [
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

export const SHUFFLE_HIHAT: Pattern = [
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 1, velocity: 65 },
  { drum: GM_DRUMS.HI_HAT_PEDAL, beat: 3, velocity: 65 },
];

export const SHUFFLE_KICK_SNARE: Pattern = [
  // Blues backbeat: snare on 2&4 full volume, kick on 1&3
  { drum: GM_DRUMS.KICK, beat: 0, velocity: 90 },
  { drum: GM_DRUMS.SNARE, beat: 1, velocity: 100 },
  { drum: GM_DRUMS.KICK, beat: 2, velocity: 85 },
  { drum: GM_DRUMS.SNARE, beat: 3, velocity: 100 },
];

// ── Jazz Fill Patterns (beats 2-4, triggered before phrase boundaries) ──

export const JAZZ_FILLS: Pattern[] = [
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

// Big fills: beats 1.5-4 (before section boundaries)
export const JAZZ_FILLS_BIG: Pattern[] = [
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
export const ALFA_MIST_FILLS: Pattern[] = [
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
export const SETUP_FILLS: Pattern[] = [
  [
    { drum: GM_DRUMS.SNARE, beat: 2.5, velocity: 65 },
    { drum: GM_DRUMS.KICK, beat: 3, velocity: 70 },
  ],
  [
    { drum: GM_DRUMS.HI_HAT_OPEN, beat: 2.5, velocity: 60 },
    { drum: GM_DRUMS.SNARE, beat: 3.5, velocity: 70 },
  ],
];

export const FILL_STYLES = new Set(["swing", "hardBop", "coolJazz", "shuffleBlues", "ballad", "fusion", "contemporaryJazz", "holdsworth", "alfaMist"]);

// ── Stochastic Jazz Comping ──
// For swing-family styles, kick/snare comping is probabilistic per-beat rather than
// static arrays. Each measure is unique. "Tendency" mechanism provides phrase continuity.

export interface BeatSlotProb {
  drum: number;
  probability: number;
  velocity: number;
  ghost?: boolean;
}

export interface StochasticTable {
  slots: Record<string, BeatSlotProb[]>;
  minHits: number;
  maxHits: number;
}

export const SWING_STOCHASTIC: StochasticTable = {
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
export const HARD_BOP_STOCHASTIC: StochasticTable = {
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

export const COOL_JAZZ_STOCHASTIC: StochasticTable = {
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

export const MODAL_STOCHASTIC: StochasticTable = {
  slots: {
    "0":    [{ drum: GM_DRUMS.KICK, probability: 0.65, velocity: 50 }],
    "2":    [{ drum: GM_DRUMS.KICK, probability: 0.20, velocity: 45 }],
    "3":    [{ drum: GM_DRUMS.KICK, probability: 0.10, velocity: 40 }],
  },
  minHits: 0,
  maxHits: 2,
};

// Ballad: very sparse, mostly brush-like side stick, gentle kick on 1
export const BALLAD_STOCHASTIC: StochasticTable = {
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
export const CONTEMPORARY_JAZZ_STOCHASTIC: StochasticTable = {
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
export const ECM_STOCHASTIC: StochasticTable = {
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
export const METHENY_STOCHASTIC: StochasticTable = {
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
export const HOLDSWORTH_STOCHASTIC: StochasticTable = {
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
export const HOLDSWORTH_11_8_STOCHASTIC: StochasticTable = {
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
export const ALFA_MIST_STOCHASTIC: StochasticTable = {
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
export const STOCHASTIC_STYLES = new Set([
  "swing", "hardBop", "coolJazz", "modal",
  "ballad", "contemporaryJazz", "ecm", "metheny", "holdsworth",
]);

export const STOCHASTIC_TABLES: Record<string, StochasticTable> = {
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

export interface CompingTendency {
  favored: string[];
  barsRemaining: number;
}

export interface StylePatternSet {
  base: Pattern;         // fixed timekeeping (ride, hihat)
  variations: Pattern[]; // kick/snare comping options (held 2-4 bars for continuity)
  rideVariants?: Pattern[]; // optional ride rotation (e.g., Holdsworth bell variants)
  hihat?: Pattern;          // hihat pattern appended when ride rotates
  hihatVariants?: Pattern[];  // optional hihat rotation (rotates with ride for variety)
}

// alfaMist excluded: hand-crafted patterns already have dense ghost work
// (sextuplet ghosts, flams, ghost cascades). Extra random ghosts = chaotic layering.
// holdsworth excluded: stochastic table already embeds rich ghost/tom comping —
// micro-variation doubles ghosting and causes density overload.
export const MICRO_VARIATION_STYLES = new Set([
  "swing", "hardBop", "coolJazz", "modal", "jazzWaltz",
  "fusion", "neoSoul", "contemporaryJazz", "metheny",
]);

export const INTERLOCK_STYLES = new Set(["swing", "hardBop", "coolJazz", "modal", "neoSoul", "contemporaryJazz", "holdsworth", "alfaMist"]);
