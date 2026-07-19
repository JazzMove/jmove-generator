/** Piano voicing and rhythm data - pure constants, no logic. Extracted from pianoComping.ts for G29. */

// ── Register Constants ──
// Base range: C3 (48) to G5 (79). pianoRegister (0-100) shifts center ±7 semitones.
// 0 = low (F2-C5), 50 = default (C3-G5), 100 = high (G3-D6).
export const PIANO_LOW_DEFAULT = 48;
export const PIANO_HIGH_DEFAULT = 79;

export const ROOT_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

// ── Voicing Definitions ──
// Intervals relative to root. Two voicing types that alternate for voice leading.

export interface VoicingTemplate {
  intervals: number[];  // semitones from root
  label: string;
}

// Quality → [Type A voicing, Type B voicing]
// Based on standard Bill Evans rootless voicings.
// Intervals are semitones from root, kept compact (within ~10 semitones span).
//
// Real rootless voicing principle:
//   Type A: starts on 3rd (ascending: 3-5-7-9 or 3-6-7-9)
//   Type B: starts on 7th (ascending: 7-9-3-5 — 3 and 5 an octave up)
//
// Key: all intervals relative to root at octave 0.
// The buildVoicing function places them in the correct octave.

export const VOICINGS: Record<string, [VoicingTemplate, VoicingTemplate]> = {
  // Major 7: A = 3-5-7-9, B = 7-9-3-5 (compact drop voicings)
  "maj7": [
    { intervals: [4, 7, 11, 14], label: "A" },   // 3-5-7-9 (span=10)
    { intervals: [11, 14, 16, 19], label: "B" },  // 7-9-3-5 (span=8)
  ],
  "": [
    { intervals: [4, 7, 9, 14], label: "A" },    // 3-5-6-9
    { intervals: [9, 12, 16, 19], label: "B" },  // 6-root-3-5 (using 6/9 sound)
  ],
  "6": [
    { intervals: [4, 7, 9, 14], label: "A" },
    { intervals: [9, 12, 16, 19], label: "B" },
  ],
  "maj9": [
    { intervals: [4, 7, 11, 14], label: "A" },
    { intervals: [11, 14, 16, 19], label: "B" },
  ],

  // Minor 7: A = b3-5-b7-9, B = b7-root-b3-5
  // Avoiding 9-b3 cluster (14→15 = 1 semitone)
  "m7": [
    { intervals: [3, 7, 10, 14], label: "A" },   // b3-5-b7-9 (span=11)
    { intervals: [10, 12, 15, 19], label: "B" },  // b7-root-b3-5 (span=9)
  ],
  "m": [
    { intervals: [3, 7, 10, 14], label: "A" },
    { intervals: [10, 12, 15, 19], label: "B" },
  ],
  "m9": [
    { intervals: [3, 7, 10, 14], label: "A" },
    { intervals: [10, 12, 15, 19], label: "B" },
  ],
  "m6": [
    { intervals: [3, 7, 9, 12], label: "A" },    // b3-5-6-root (span=9)
    { intervals: [9, 12, 15, 19], label: "B" },  // 6-root-b3-5 (span=10)
  ],
  "m11": [
    { intervals: [3, 5, 10, 14], label: "A" },   // b3-4-b7-9 (span=11)
    { intervals: [10, 12, 15, 17], label: "B" },  // b7-root-b3-11 (span=7)
  ],
  "m(maj7)": [
    { intervals: [3, 7, 11, 14], label: "A" },   // b3-5-7-9 (span=11)
    { intervals: [11, 14, 16, 19], label: "B" },  // 7-9-3-5 (span=8) — no cluster since 14→16 = 2
  ],

  // Dominant 7: A = 3-5-b7-9, B = b7-9-3-5
  // Avoiding 13-b7 cluster (only 1 semitone) which sounds harsh without bass root
  "7": [
    { intervals: [4, 7, 10, 14], label: "A" },   // 3-5-b7-9 (span=10)
    { intervals: [10, 14, 16, 19], label: "B" },  // b7-9-3-5 (span=9)
  ],
  "9": [
    { intervals: [4, 7, 10, 14], label: "A" },
    { intervals: [10, 14, 16, 19], label: "B" },
  ],
  "13": [
    { intervals: [4, 7, 10, 14], label: "A" },
    { intervals: [10, 14, 16, 19], label: "B" },
  ],
  "7b9": [
    { intervals: [4, 7, 10, 13], label: "A" },   // 3-5-b7-b9 (span=9)
    { intervals: [10, 13, 16, 19], label: "B" },  // b7-b9-3-5 (span=9)
  ],
  "7#9": [
    { intervals: [4, 7, 10, 15], label: "A" },   // 3-5-b7-#9 (span=11)
    { intervals: [10, 15, 19, 22], label: "B" },  // b7-#9-5-b7(up) — spread to avoid cluster
  ],
  "7alt": [
    { intervals: [4, 8, 10, 13], label: "A" },   // 3-#5-b7-b9 (span=9)
    { intervals: [10, 13, 16, 20], label: "B" },  // b7-b9-3-b13 (span=10)
  ],
  "7b5": [
    { intervals: [4, 6, 10, 14], label: "A" },   // 3-b5-b7-9 (span=10)
    { intervals: [10, 14, 16, 18], label: "B" },  // b7-9-3-b5 (span=8)
  ],
  "7#5": [
    { intervals: [4, 8, 10, 14], label: "A" },   // 3-#5-b7-9 (span=10)
    { intervals: [10, 14, 16, 20], label: "B" },  // b7-9-3-#5 (span=10)
  ],
  // Half-dim: A = b3-b5-b7-9, B = b7-root-b3-b5
  "m7b5": [
    { intervals: [3, 6, 10, 14], label: "A" },   // b3-b5-b7-9 (span=11)
    { intervals: [10, 12, 15, 18], label: "B" },  // b7-root-b3-b5 (span=8)
  ],

  // Diminished 7
  "dim7": [
    { intervals: [3, 6, 9, 12], label: "A" },    // b3-b5-bb7-root (span=9)
    { intervals: [6, 9, 12, 15], label: "B" },   // b5-bb7-root-b3 (span=9)
  ],
  "dim": [
    { intervals: [3, 6, 9, 12], label: "A" },
    { intervals: [6, 9, 12, 15], label: "B" },
  ],

  // Augmented
  "aug": [
    { intervals: [4, 8, 11, 14], label: "A" },   // 3-#5-7-9 (span=10)
    { intervals: [8, 11, 14, 16], label: "B" },  // #5-7-9-3 (span=8)
  ],

  // Suspended (NO major 3rd — critical!)
  "sus4": [
    { intervals: [5, 7, 10, 14], label: "A" },   // 4-5-b7-9 (span=9)
    { intervals: [10, 12, 17, 19], label: "B" },  // b7-root-4-5(up) (span=9)
  ],
  "7sus": [
    { intervals: [5, 7, 10, 14], label: "A" },   // 4-5-b7-9 (span=9)
    { intervals: [10, 12, 17, 19], label: "B" },  // b7-root-4-5(up) (span=9)
  ],
  "7sus4": [
    { intervals: [5, 7, 10, 14], label: "A" },
    { intervals: [10, 12, 17, 19], label: "B" },
  ],
  "9sus4": [
    { intervals: [5, 7, 10, 14], label: "A" },
    { intervals: [10, 12, 17, 19], label: "B" },
  ],
  "13sus4": [
    { intervals: [5, 7, 10, 14], label: "A" },
    { intervals: [10, 12, 17, 19], label: "B" },
  ],
  "sus2": [
    { intervals: [2, 7, 10, 14], label: "A" },   // 2-5-b7-9 (span=12)
    { intervals: [10, 12, 14, 19], label: "B" },  // b7-root-9-5 (span=9)
  ],

  // Additional iReal Pro qualities (aliases to nearest voicing type)
  "maj13": [
    { intervals: [4, 7, 11, 14], label: "A" },   // same as maj7
    { intervals: [11, 14, 16, 19], label: "B" },
  ],
  "maj7#11": [
    { intervals: [4, 6, 11, 14], label: "A" },   // 3-#4-7-9 (lydian color)
    { intervals: [11, 14, 16, 18], label: "B" },  // 7-9-3-#4
  ],
  "maj7#5": [
    { intervals: [4, 8, 11, 14], label: "A" },   // 3-#5-7-9
    { intervals: [11, 14, 16, 20], label: "B" },  // 7-9-3-#5
  ],
  "69": [
    { intervals: [4, 7, 9, 14], label: "A" },    // same as 6
    { intervals: [9, 12, 16, 19], label: "B" },
  ],
  "6/9": [
    { intervals: [4, 7, 9, 14], label: "A" },    // 3-5-6-9 (same as 69)
    { intervals: [9, 12, 16, 19], label: "B" },
  ],
  "m6/9": [
    { intervals: [3, 7, 9, 14], label: "A" },    // b3-5-6-9
    { intervals: [9, 12, 15, 19], label: "B" },   // 6-9-b3-5
  ],
  "aug7": [
    { intervals: [4, 8, 10, 14], label: "A" },   // 3-#5-b7-9
    { intervals: [10, 14, 16, 20], label: "B" },  // b7-9-3-#5
  ],
  "7b13": [
    { intervals: [4, 7, 10, 14], label: "A" },   // treat as dom7
    { intervals: [10, 14, 16, 19], label: "B" },
  ],
  "7#11": [
    { intervals: [4, 6, 10, 14], label: "A" },   // 3-#11-b7-9 (lydian dom)
    { intervals: [10, 14, 16, 18], label: "B" },  // b7-9-3-#11
  ],
  "7b9b13": [
    { intervals: [4, 7, 10, 13], label: "A" },   // 3-5-b7-b9
    { intervals: [10, 13, 16, 19], label: "B" },
  ],
  "7#9b13": [
    { intervals: [4, 7, 10, 15], label: "A" },   // 3-5-b7-#9
    { intervals: [10, 15, 19, 22], label: "B" },
  ],
  "7b9#11": [
    { intervals: [4, 6, 10, 13], label: "A" },   // 3-#11-b7-b9
    { intervals: [10, 13, 16, 18], label: "B" },
  ],
  "7#9#11": [
    { intervals: [4, 6, 10, 15], label: "A" },   // 3-#11-b7-#9
    { intervals: [10, 15, 18, 22], label: "B" },
  ],
  "7#9b5": [
    { intervals: [4, 6, 10, 15], label: "A" },   // 3-b5-b7-#9 (b5=#11)
    { intervals: [10, 15, 18, 22], label: "B" },
  ],
  "7b9b5": [
    { intervals: [4, 6, 10, 13], label: "A" },   // 3-b5-b7-b9 (b5=#11)
    { intervals: [10, 13, 16, 18], label: "B" },
  ],
  "add9": [
    { intervals: [4, 7, 9, 14], label: "A" },
    { intervals: [9, 12, 16, 19], label: "B" },
  ],
};

// ── Upper Structure Triads ──
// Major triads superimposed over dominant 7th chords.
// triadPCs: pitch classes (0-11) of the triad relative to the chord root.
// The voicing builder adds b7(10) on bottom and places the triad above.

export interface USTEntry {
  triadPCs: [number, number, number];
  label: string;
}

export const UST_TRIADS: Record<string, USTEntry[]> = {
  // Lydian dominant: D/C -> C13#11 (all PCs in Lydian dom scale)
  "7#11": [{ triadPCs: [2, 6, 9], label: "II maj" }],
  // Altered: Gb/C -> C7b5b9 (all PCs in altered scale)
  "7alt": [{ triadPCs: [6, 10, 1], label: "bV maj" }],
  // Flat nine: Gb/C -> C7b5b9 (all PCs in half-whole dim)
  "7b9": [{ triadPCs: [6, 10, 1], label: "bV maj" }],
  // Sharp nine: Eb/C -> C7#9 (all PCs in half-whole dim)
  "7#9": [{ triadPCs: [3, 7, 10], label: "bIII maj" }],
  // 7#5: no scale-compatible UST triads; quality falls through to "7" key
  // Generic dominant (7, 9, 13): Bb/C -> C9 (consonant, stays in Mixolydian)
  "7": [{ triadPCs: [10, 2, 5], label: "bVII maj" }],
};

// ── Rhythm Templates ──
// Each entry = [beatOffset, durationMultiplier] relative to measure start.
// beatOffset in quarter-note beats. Duration multiplier × beat duration.

export type RhythmHit = [number, number]; // [beat offset, duration multiplier]

export const SWING_RHYTHMS: RhythmHit[][] = [
  // Charleston pattern: beat 1 + "and" of 2
  [[0, 1.5], [1.5, 0.5], [3, 0.8]],
  // Anticipation: "and" of 4 + beat 2
  [[0, 1.0], [1.5, 1.5], [3.5, 0.4]],
  // Sparse: beats 1 and 3
  [[0, 1.8], [2, 1.8]],
  // Syncopated: beat 1, and-of-2, beat 4
  [[0, 1.0], [1.5, 1.0], [3, 0.8]],
  // Sparse with anticipatory stab before next bar
  [[0, 1.5], [3.75, 0.4]],
  // Driving quarters with rest on 2
  [[0, 0.8], [1, 0.8], [3, 0.6]],
  // Off-beat emphasis with downbeat anchor
  [[0, 0.4], [0.5, 0.8], [2, 1.0], [3.5, 0.4]],
  // Charleston + anticipation
  [[0, 1.5], [2.5, 0.5], [3.5, 0.4]],
];

export const BOSSA_RHYTHMS: RhythmHit[][] = [
  // Standard bossa montuno
  [[0, 1.0], [1.5, 0.5], [2.5, 0.5], [3.5, 0.4]],
  // Simplified
  [[0, 1.5], [2, 1.5]],
  // Anticipated 2nd half
  [[0, 1.5], [2.5, 0.5], [3, 0.8]],
  // Off-beat montuno
  [[0.5, 0.5], [1.5, 0.5], [2.5, 0.5], [3.5, 0.4]],
];

export const BALLAD_RHYTHMS: RhythmHit[][] = [
  // Whole note (sustained)
  [[0, 3.8]],
  // Half notes
  [[0, 1.8], [2, 1.8]],
];

export const LATIN_RHYTHMS: RhythmHit[][] = [
  // Classic montuno: syncopated LH + RH stabs (Afro-Cuban piano)
  [[0, 0.3], [0.5, 0.3], [1.5, 0.3], [2, 0.3], [2.5, 0.3], [3.5, 0.3]],
  // Simplified montuno: 1, and-of-1, and-of-2, 3
  [[0, 0.4], [0.5, 0.4], [1.5, 0.4], [2, 1.0]],
  // Driving tumbao piano: off-beat emphasis
  [[0.5, 0.4], [1, 0.4], [2.5, 0.4], [3, 0.4]],
  // Guajeo pattern: syncopated anticipations
  [[0, 0.5], [1.5, 0.5], [2.5, 0.5], [3.5, 0.4]],
];

export const FUSION_RHYTHMS: RhythmHit[][] = [
  // Syncopated short stabs (Rhodes-like)
  [[0, 0.5], [0.75, 0.5], [2, 0.5], [2.75, 0.5]],
  // Punchy off-beats (Headhunters anticipation)
  [[0.5, 0.4], [1.5, 0.4], [2.5, 0.4], [3.5, 0.4]],
  // Accent on 1 + stabs
  [[0, 0.8], [1.75, 0.4], [3, 0.5]],
  // Held chord with off-beat push (Herbie Hancock)
  [[0, 1.5], [2.75, 0.8]],
  // Spacious: beat 1 pad + beat 4 stab
  [[0, 2.2], [3, 0.6]],
  // Dotted-quarter groove (Chick Corea)
  [[0, 0.6], [0.75, 0.6], [1.5, 0.6], [2.25, 0.6], [3, 0.8]],
];

export const ECM_RHYTHMS: RhythmHit[][] = [
  // Sustained, spacious — one chord per bar
  [[0, 3.8]],
  // Delayed entry, still sustained
  [[1, 2.8]],
  // Two gentle entries
  [[0, 2.0], [2.5, 1.3]],
  // Beat 2 entry — Jarrett trio floating feel
  [[1, 3.0]],
  // Dotted half + light re-entry
  [[0, 2.8], [3.5, 0.4]],
  // Sparse: beat 3 entry only (breathes)
  [[2, 1.8]],
];

export const HARD_BOP_RHYTHMS: RhythmHit[][] = [
  // Block chord driving quarters
  [[0, 0.8], [1, 0.8], [2, 0.8], [3, 0.8]],
  // Accented stabs
  [[0, 1.0], [1.5, 0.5], [2, 1.0], [3.5, 0.4]],
  // Dense
  [[0, 0.6], [0.5, 0.6], [2, 0.8], [3, 0.6]],
];

export const COOL_JAZZ_RHYTHMS: RhythmHit[][] = [
  // Relaxed halves
  [[0, 2.0], [2.5, 1.3]],
  // Sparse
  [[0, 1.8]],
  // Light dotted half
  [[0, 2.8], [3, 0.8]],
];

export const MODAL_RHYTHMS: RhythmHit[][] = [
  // McCoy Tyner: percussive quartal stab on beat 1 + off-beat accent
  [[0, 0.4], [1.5, 0.4]],
  // Staccato quartal on "and" of 1 + beat 3 (rhythmic push)
  [[0.5, 0.3], [2, 0.4], [3.5, 0.3]],
  // Sustained voicing — spacious (Kind of Blue moments)
  [[0, 3.8]],
  // Accented stab on 1 + delayed re-entry (builds tension)
  [[0, 0.6], [2.5, 0.5]],
  // Off-beat quartal comping (McCoy uptempo style)
  [[0.5, 0.3], [1.5, 0.3], [2.5, 0.3], [3.5, 0.3]],
];

export const JAZZ_WALTZ_RHYTHMS: RhythmHit[][] = [
  // 3/4 comping
  [[0, 1.0], [1.5, 0.5]],
  // On 1 and 3
  [[0, 1.5], [2, 0.8]],
  // Sustained
  [[0, 2.8]],
];

export const SHUFFLE_BLUES_RHYTHMS: RhythmHit[][] = [
  // Triplet-feel stabs
  [[0, 0.8], [0.67, 0.3], [2, 0.8], [2.67, 0.3]],
  // Shuffle quarters
  [[0, 0.9], [1, 0.9], [2, 0.9], [3, 0.9]],
  // Backbeat accent
  [[0, 0.6], [1.67, 0.4], [2, 0.8], [3.67, 0.3]],
];

// ── NEW GENRE RHYTHMS ──

export const NEO_SOUL_RHYTHMS: RhythmHit[][] = [
  // Broken arpeggio (Rhodes style)
  [[0, 0.3], [0.5, 0.3], [1, 0.3], [2, 1.5]],
  // Sustained pad (warm, long)
  [[0, 3.5]],
  // Gospel stabs: beat 1 + anticipation
  [[0, 0.6], [2.75, 0.6], [3.5, 0.4]],
  // Off-beat chords (D'Angelo feel)
  [[0.5, 0.8], [2, 1.0], [3.25, 0.6]],
];

export const CONTEMP_JAZZ_RHYTHMS: RhythmHit[][] = [
  // Flowing 8th-note line (classical crossover)
  [[0, 0.4], [0.5, 0.4], [1, 0.4], [1.5, 0.4], [2, 1.5]],
  // Wide sustained chord (Romantic spread)
  [[0, 3.5]],
  // Block chord + flowing continuation
  [[0, 0.8], [1, 0.4], [1.5, 0.4], [2, 1.5]],
  // Elegant halves
  [[0, 1.8], [2, 1.8]],
];

export const MATH_ROCK_RHYTHMS: RhythmHit[][] = [
  // Staccato repeating 16ths
  [[0, 0.2], [0.25, 0.2], [0.5, 0.2], [1, 0.2], [1.25, 0.2], [2, 0.2], [2.25, 0.2], [3, 0.2]],
  // Angular stabs
  [[0, 0.3], [0.75, 0.3], [2, 0.3], [2.75, 0.3]],
  // Ostinato 8ths
  [[0, 0.2], [0.5, 0.2], [1, 0.2], [1.5, 0.2], [2, 0.2], [2.5, 0.2], [3, 0.2], [3.5, 0.2]],
];

export const IDM_RHYTHMS: RhythmHit[][] = [
  // Ambient sustained pad
  [[0, 3.8]],
  // Delayed entry pad
  [[0.5, 3.0]],
  // Two sustained entries
  [[0, 1.5], [2, 1.5]],
];

// Alfa Mist Rhodes (Yamaha CP-73/Rhodes + Pigtronix Echolution delay):
// Liquid inversions, grace notes, sparse syncopated hits, anticipations.
// Self-taught ear-based voicing — cluster voicings with clever inversions.
// Research: Antiphon, Structuralism, Variables albums.
export const ALFA_MIST_RHYTHMS: RhythmHit[][] = [
  // Anticipate beat 1 — hit on "and" of 4 (neo-soul signature)
  [[3.5, 0.8], [0, 0.0]],
  // Syncopated stabs with breathing space
  [[0, 0.6], [1.5, 0.5], [3, 0.6]],
  // Sparse — one hit, let delay pedal fill space
  [[0, 1.5]],
  // Off-beat Rhodes — "and" of 2 + "and" of 4 (characteristic broken feel)
  [[0.5, 0.8], [2.5, 0.8]],
  // Sustained pad with late entry (layering approach — start minimal)
  [[1, 2.8]],
  // Grace note approach — quick stab before downbeat + sustain
  [[3.75, 0.15], [0, 1.8]],
  // Broken arpeggio — low notes first, upper notes delayed (finger roll)
  [[0, 0.3], [0.15, 0.3], [0.3, 1.5]],
  // Dotted rhythm — anticipation feel (grime-influenced rhythmic DNA)
  [[0, 0.75], [1.25, 0.75], [2.5, 1.3]],
];

// Holdsworth keyboard: Pasqua/Husband — sustained wide voicings, long tones,
// occasional conversational punctuation. NOT rhythm guitar stabs.
export const HOLDSWORTH_RHYTHMS: RhythmHit[][] = [
  // Sustained pad — full bar, let voicing ring (primary feel)
  [[0, 3.8]],
  // Delayed sustained — breathe, then commit
  [[1, 2.8]],
  // Two sustained entries — wide spacing, both ring out
  [[0, 1.8], [2.5, 1.5]],
  // Offbeat sustained — push ahead, long tone
  [[0.5, 2.5]],
  // Conversational — two entries with sustain (not stabs)
  [[0, 1.5], [2.5, 1.3]],
  // Anticipation into next bar — sustained pickup
  [[3, 1.8]],
];

// Pat Metheny: open, spacious voicings — Lexicon PCM delay fills gaps.
// Wide intervals, Lydian shimmer, sustained pads with occasional movement.
// Guitar-to-piano translation: open-string voicings → wide spread + open 5ths.
export const METHENY_RHYTHMS: RhythmHit[][] = [
  // Sustained pad — one chord per bar, let delay fill (primary)
  [[0, 3.8]],
  // Two gentle entries — wide spacing, breathing room
  [[0, 1.8], [2.5, 1.3]],
  // Delayed entry — space before statement (Metheny lets silence speak)
  [[1, 2.8]],
  // Light syncopation — "and" of 1 + beat 3 (floating feel)
  [[0.5, 1.2], [2, 1.5]],
  // Sparse dotted — single hit with long sustain (ECM-adjacent)
  [[0, 2.5]],
];

// ── Odd Meter Rhythms ──

export const FIVE_FOUR_RHYTHMS: RhythmHit[][] = [
  // 3+2 grouping: beat 1 + beat 4
  [[0, 1.5], [3, 1.5]],
  // Syncopated: 1, and-of-2, beat 4
  [[0, 1.0], [1.5, 1.0], [3, 1.8]],
  // Sparse: just beat 1 sustained
  [[0, 4.5]],
];

export const SIX_EIGHT_RHYTHMS: RhythmHit[][] = [
  // Two dotted quarters
  [[0, 1.4], [1.5, 1.4]],
  // Sustained
  [[0, 2.8]],
  // Syncopated: beat 1 + and of dotted-quarter 2
  [[0, 1.2], [2, 0.8]],
];

export const SEVEN_EIGHT_RHYTHMS: RhythmHit[][] = [
  // 2+2+3 grouping: hits on group starts
  [[0, 0.8], [1, 0.8], [2, 1.3]],
  // Sustained over bar
  [[0, 3.3]],
  // Syncopated
  [[0, 1.0], [1.5, 0.5], [2, 1.2]],
];

export const NINE_EIGHT_RHYTHMS: RhythmHit[][] = [
  // 3+3+3: hit on each group start
  [[0, 1.3], [1.5, 1.3], [3, 1.3]],
  // Sustained
  [[0, 4.3]],
  // Sparse: beats 1 and 3
  [[0, 1.5], [3, 1.3]],
];

export const SIX_FOUR_RHYTHMS: RhythmHit[][] = [
  // Two halves: beat 1 + beat 4
  [[0, 2.5], [3, 2.5]],
  // Walking quarters on 1 and 3 and 5
  [[0, 1.5], [2, 1.5], [4, 1.5]],
  // Sustained
  [[0, 5.5]],
];

export const SEVEN_FOUR_RHYTHMS: RhythmHit[][] = [
  // 4+3 grouping
  [[0, 2.0], [4, 2.5]],
  // Hits on 1, 3, 5
  [[0, 1.5], [2, 1.5], [4, 2.5]],
  // Sustained
  [[0, 6.5]],
];

export const ELEVEN_EIGHT_RHYTHMS: RhythmHit[][] = [
  // 2+2+3+2+2 grouping
  [[0, 0.8], [1, 0.8], [2, 1.2], [3.5, 0.8], [4.5, 0.8]],
  // Sustained
  [[0, 5.3]],
  // Sparse
  [[0, 1.5], [2, 1.5], [3.5, 1.8]],
];
