/**
 * Piano Comping Generator — jazz piano voicings with rhythmic patterns.
 *
 * Voicing types (Bill Evans style):
 *   Type A: 3-7-9-5 (rootless, 3rd on bottom)
 *   Type B: 7-9-3-13 (rootless, 7th on bottom)
 *
 * Voice leading: minimizes total semitone motion between consecutive chords.
 * Rhythm templates: swing (syncopated), bossa (montuno), ballad (whole notes).
 * Humanization: ±5ms timing jitter, ±5 velocity variation.
 */

import { tempoSwingMultiplier, dynamicMultiplier, instrumentSwingFactor } from "./swingUtils";
import { getGrooveTemplate, applyGroove, rubatoOffset } from "./grooveTemplates";
import type { CompNote, PianoStyle, PianoCompingOptions, ChordEvent, PianoGranular } from "./types";

export type { CompNote, PianoStyle, PianoCompingOptions, ChordEvent };

// ── Module-level PRNG ──
let _rng: () => number = Math.random;
let _pianoGranular: PianoGranular | undefined;
let _pianoEnergy: number = 0.7;
let _pianoArc: import("./types").PhraseArc | null = null;

// ── Register Constants ──
// Base range: G3 (55) to C6 (84). pianoRegister (0-100) shifts center ±7 semitones.
// 0 = low (C3-F5), 50 = default (G3-C6), 100 = high (D4-G6).
const PIANO_LOW_DEFAULT = 55;
const PIANO_HIGH_DEFAULT = 84;

function getPianoLow(): number {
  if (!_pianoGranular) return PIANO_LOW_DEFAULT;
  const reg = _pianoGranular.pianoRegister ?? 50;
  const shift = Math.round((reg - 50) / 50 * 7);
  return PIANO_LOW_DEFAULT + shift;
}

function getPianoHigh(): number {
  if (!_pianoGranular) return PIANO_HIGH_DEFAULT;
  const reg = _pianoGranular.pianoRegister ?? 50;
  const shift = Math.round((reg - 50) / 50 * 7);
  return PIANO_HIGH_DEFAULT + shift;
}

const ROOT_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

// ── Voicing Definitions ──
// Intervals relative to root. Two voicing types that alternate for voice leading.

interface VoicingTemplate {
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

const VOICINGS: Record<string, [VoicingTemplate, VoicingTemplate]> = {
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

// ── Rhythm Templates ──
// Each entry = [beatOffset, durationMultiplier] relative to measure start.
// beatOffset in quarter-note beats. Duration multiplier × beat duration.

type RhythmHit = [number, number]; // [beat offset, duration multiplier]

const SWING_RHYTHMS: RhythmHit[][] = [
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

const BOSSA_RHYTHMS: RhythmHit[][] = [
  // Standard bossa montuno
  [[0, 1.0], [1.5, 0.5], [2.5, 0.5], [3.5, 0.4]],
  // Simplified
  [[0, 1.5], [2, 1.5]],
  // Anticipated 2nd half
  [[0, 1.5], [2.5, 0.5], [3, 0.8]],
  // Off-beat montuno
  [[0.5, 0.5], [1.5, 0.5], [2.5, 0.5], [3.5, 0.4]],
];

const BALLAD_RHYTHMS: RhythmHit[][] = [
  // Whole note (sustained)
  [[0, 3.8]],
  // Half notes
  [[0, 1.8], [2, 1.8]],
];

const LATIN_RHYTHMS: RhythmHit[][] = [
  // Classic montuno: syncopated LH + RH stabs (Afro-Cuban piano)
  [[0, 0.3], [0.5, 0.3], [1.5, 0.3], [2, 0.3], [2.5, 0.3], [3.5, 0.3]],
  // Simplified montuno: 1, and-of-1, and-of-2, 3
  [[0, 0.4], [0.5, 0.4], [1.5, 0.4], [2, 1.0]],
  // Driving tumbao piano: off-beat emphasis
  [[0.5, 0.4], [1, 0.4], [2.5, 0.4], [3, 0.4]],
  // Guajeo pattern: syncopated anticipations
  [[0, 0.5], [1.5, 0.5], [2.5, 0.5], [3.5, 0.4]],
];

const FUSION_RHYTHMS: RhythmHit[][] = [
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

const ECM_RHYTHMS: RhythmHit[][] = [
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

const HARD_BOP_RHYTHMS: RhythmHit[][] = [
  // Block chord driving quarters
  [[0, 0.8], [1, 0.8], [2, 0.8], [3, 0.8]],
  // Accented stabs
  [[0, 1.0], [1.5, 0.5], [2, 1.0], [3.5, 0.4]],
  // Dense
  [[0, 0.6], [0.5, 0.6], [2, 0.8], [3, 0.6]],
];

const COOL_JAZZ_RHYTHMS: RhythmHit[][] = [
  // Relaxed halves
  [[0, 2.0], [2.5, 1.3]],
  // Sparse
  [[0, 1.8]],
  // Light dotted half
  [[0, 2.8], [3, 0.8]],
];

const MODAL_RHYTHMS: RhythmHit[][] = [
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

const JAZZ_WALTZ_RHYTHMS: RhythmHit[][] = [
  // 3/4 comping
  [[0, 1.0], [1.5, 0.5]],
  // On 1 and 3
  [[0, 1.5], [2, 0.8]],
  // Sustained
  [[0, 2.8]],
];

const SHUFFLE_BLUES_RHYTHMS: RhythmHit[][] = [
  // Triplet-feel stabs
  [[0, 0.8], [0.67, 0.3], [2, 0.8], [2.67, 0.3]],
  // Shuffle quarters
  [[0, 0.9], [1, 0.9], [2, 0.9], [3, 0.9]],
  // Backbeat accent
  [[0, 0.6], [1.67, 0.4], [2, 0.8], [3.67, 0.3]],
];

// ── NEW GENRE RHYTHMS ──

const NEO_SOUL_RHYTHMS: RhythmHit[][] = [
  // Broken arpeggio (Rhodes style)
  [[0, 0.3], [0.5, 0.3], [1, 0.3], [2, 1.5]],
  // Sustained pad (warm, long)
  [[0, 3.5]],
  // Gospel stabs: beat 1 + anticipation
  [[0, 0.6], [2.75, 0.6], [3.5, 0.4]],
  // Off-beat chords (D'Angelo feel)
  [[0.5, 0.8], [2, 1.0], [3.25, 0.6]],
];

const CONTEMP_JAZZ_RHYTHMS: RhythmHit[][] = [
  // Flowing 8th-note line (classical crossover)
  [[0, 0.4], [0.5, 0.4], [1, 0.4], [1.5, 0.4], [2, 1.5]],
  // Wide sustained chord (Romantic spread)
  [[0, 3.5]],
  // Block chord + flowing continuation
  [[0, 0.8], [1, 0.4], [1.5, 0.4], [2, 1.5]],
  // Elegant halves
  [[0, 1.8], [2, 1.8]],
];

const MATH_ROCK_RHYTHMS: RhythmHit[][] = [
  // Staccato repeating 16ths
  [[0, 0.2], [0.25, 0.2], [0.5, 0.2], [1, 0.2], [1.25, 0.2], [2, 0.2], [2.25, 0.2], [3, 0.2]],
  // Angular stabs
  [[0, 0.3], [0.75, 0.3], [2, 0.3], [2.75, 0.3]],
  // Ostinato 8ths
  [[0, 0.2], [0.5, 0.2], [1, 0.2], [1.5, 0.2], [2, 0.2], [2.5, 0.2], [3, 0.2], [3.5, 0.2]],
];

const IDM_RHYTHMS: RhythmHit[][] = [
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
const ALFA_MIST_RHYTHMS: RhythmHit[][] = [
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
const HOLDSWORTH_RHYTHMS: RhythmHit[][] = [
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
const METHENY_RHYTHMS: RhythmHit[][] = [
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

const FIVE_FOUR_RHYTHMS: RhythmHit[][] = [
  // 3+2 grouping: beat 1 + beat 4
  [[0, 1.5], [3, 1.5]],
  // Syncopated: 1, and-of-2, beat 4
  [[0, 1.0], [1.5, 1.0], [3, 1.8]],
  // Sparse: just beat 1 sustained
  [[0, 4.5]],
];

const SIX_EIGHT_RHYTHMS: RhythmHit[][] = [
  // Two dotted quarters
  [[0, 1.4], [1.5, 1.4]],
  // Sustained
  [[0, 2.8]],
  // Syncopated: beat 1 + and of dotted-quarter 2
  [[0, 1.2], [2, 0.8]],
];

const SEVEN_EIGHT_RHYTHMS: RhythmHit[][] = [
  // 2+2+3 grouping: hits on group starts
  [[0, 0.8], [1, 0.8], [2, 1.3]],
  // Sustained over bar
  [[0, 3.3]],
  // Syncopated
  [[0, 1.0], [1.5, 0.5], [2, 1.2]],
];

const NINE_EIGHT_RHYTHMS: RhythmHit[][] = [
  // 3+3+3: hit on each group start
  [[0, 1.3], [1.5, 1.3], [3, 1.3]],
  // Sustained
  [[0, 4.3]],
  // Sparse: beats 1 and 3
  [[0, 1.5], [3, 1.3]],
];

const SIX_FOUR_RHYTHMS: RhythmHit[][] = [
  // Two halves: beat 1 + beat 4
  [[0, 2.5], [3, 2.5]],
  // Walking quarters on 1 and 3 and 5
  [[0, 1.5], [2, 1.5], [4, 1.5]],
  // Sustained
  [[0, 5.5]],
];

const SEVEN_FOUR_RHYTHMS: RhythmHit[][] = [
  // 4+3 grouping
  [[0, 2.0], [4, 2.5]],
  // Hits on 1, 3, 5
  [[0, 1.5], [2, 1.5], [4, 2.5]],
  // Sustained
  [[0, 6.5]],
];

const ELEVEN_EIGHT_RHYTHMS: RhythmHit[][] = [
  // 2+2+3+2+2 grouping
  [[0, 0.8], [1, 0.8], [2, 1.2], [3.5, 0.8], [4.5, 0.8]],
  // Sustained
  [[0, 5.3]],
  // Sparse
  [[0, 1.5], [2, 1.5], [3.5, 1.8]],
];

/** Get rhythm templates for a given time signature. Returns null for standard meters. */
function getOddMeterRhythms(timeSig: [number, number]): RhythmHit[][] | null {
  const [n, d] = timeSig;
  if (n === 5 && d === 4) return FIVE_FOUR_RHYTHMS;
  if (n === 6 && d === 8) return SIX_EIGHT_RHYTHMS;
  if (n === 7 && d === 8) return SEVEN_EIGHT_RHYTHMS;
  if (n === 9 && d === 8) return NINE_EIGHT_RHYTHMS;
  if (n === 6 && d === 4) return SIX_FOUR_RHYTHMS;
  if (n === 7 && d === 4) return SEVEN_FOUR_RHYTHMS;
  if (n === 11 && d === 8) return ELEVEN_EIGHT_RHYTHMS;
  return null;
}

// ── Helpers ──

function rootMidi(root: string): number {
  return ROOT_SEMITONES[root] ?? 0;
}

/** Build voicing pitches from root + template, placed in piano range.
 * Critical: must keep all notes in ascending order (no individual octave wrapping). */
function buildVoicing(root: string, template: VoicingTemplate): number[] {
  const rootPC = rootMidi(root);
  const minInterval = Math.min(...template.intervals);
  const maxInterval = Math.max(...template.intervals);

  // Find the octave where entire voicing fits within PIANO range.
  // Prefer k=4 (octave 4, middle register) then try k=3, k=5, k=2.
  let base = -1;
  for (const k of [4, 3, 5, 2]) {
    const candidate = 12 * k + rootPC;
    if (candidate + minInterval >= getPianoLow() && candidate + maxInterval <= getPianoHigh()) {
      base = candidate;
      break;
    }
  }

  if (base < 0) {
    // Fallback: fit as many as possible starting from lowest valid position
    base = getPianoLow() - minInterval;
    while ((base % 12) !== rootPC) base++;
    if (base + maxInterval > getPianoHigh()) base -= 12;
  }

  const clamped = template.intervals.map((i) => {
    let p = base + i;
    while (p < getPianoLow()) p += 12;
    while (p > getPianoHigh()) p -= 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Compute total voice-leading distance between two voicings.
 *  Uses greedy minimum-cost matching: each voice in `a` finds its closest
 *  unmatched voice in `b`. This correctly handles Type A vs Type B voicings
 *  where sorted-index comparison fails (3rd-on-bottom vs 7th-on-bottom). */
function voiceLeadingDistance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 999;

  // Build cost matrix: distance from each note in a to each note in b
  const na = a.length;
  const nb = b.length;
  const costs: number[][] = [];
  for (let i = 0; i < na; i++) {
    costs[i] = [];
    for (let j = 0; j < nb; j++) {
      costs[i][j] = Math.abs(a[i] - b[j]);
    }
  }

  // Greedy matching: pick smallest cost pair, mark both used, repeat.
  // For 4-note voicings (16 pairs) this is fast and near-optimal.
  const usedA = new Set<number>();
  const usedB = new Set<number>();
  let total = 0;
  const pairs = Math.min(na, nb);

  for (let p = 0; p < pairs; p++) {
    let bestCost = Infinity;
    let bestI = 0;
    let bestJ = 0;
    for (let i = 0; i < na; i++) {
      if (usedA.has(i)) continue;
      for (let j = 0; j < nb; j++) {
        if (usedB.has(j)) continue;
        if (costs[i][j] < bestCost) {
          bestCost = costs[i][j];
          bestI = i;
          bestJ = j;
        }
      }
    }
    usedA.add(bestI);
    usedB.add(bestJ);
    total += bestCost;
  }

  return total;
}

/** Resolve unknown quality to closest VOICINGS key. */
function resolveVoicingQuality(q: string): [VoicingTemplate, VoicingTemplate] {
  // Direct match
  if (VOICINGS[q]) return VOICINGS[q];

  // Smart fallback: parse quality for base type
  if (q.includes("dim")) return VOICINGS["dim7"];
  if (q.includes("aug")) return VOICINGS["aug"];
  if (q.includes("sus")) return VOICINGS["7sus"]; // NEVER maj3 for sus
  if (q.startsWith("m") && !q.startsWith("maj")) {
    if (q.includes("7") || q.includes("9") || q.includes("11")) return VOICINGS["m7"];
    return VOICINGS["m"];
  }
  if (q.startsWith("maj")) return VOICINGS["maj7"];
  if (q.includes("7") || q.includes("9") || q.includes("13")) return VOICINGS["7"];
  if (q === "69") return VOICINGS["6"];
  if (q === "5" || q === "add9") return VOICINGS[""];

  return VOICINGS["7"]; // dominant is safest generic fallback for jazz
}

/** Build cluster voicing (tight groupings, span 5-8 semitones) for Alfa Mist Rhodes.
 *  Rootless — bass handles the root. Mid-register placement for Rhodes sweetspot. */
function buildClusterVoicing(root: string, quality: string): number[] {
  const rootPC = rootMidi(root);
  const q = quality.replace(/\/.*$/, "");

  let intervals: number[];
  if (q.includes("dim")) {
    // Dim cluster: b3-b5-bb7 (span 6)
    intervals = [3, 6, 9];
  } else if (q.includes("aug")) {
    // Aug cluster: 3-#5-maj7 (span 8)
    intervals = [4, 8, 11];
  } else if (q.includes("sus")) {
    // Sus cluster: 9-4-b7 (span 8)
    intervals = [2, 5, 10];
  } else if (q.startsWith("m") && !q.startsWith("maj")) {
    // Minor cluster: b3-4-5-b7 (span 7) — avoids harsh 9-b3 semitone
    intervals = [3, 5, 7, 10];
  } else if ((q.includes("7") || q.includes("9") || q.includes("13")) && !q.includes("maj")) {
    // Dominant cluster: 9-3-b7 (span 8)
    intervals = [2, 4, 10];
  } else {
    // Major cluster: 9-3-5 (span 5)
    intervals = [2, 4, 7];
  }

  // Place in mid register — find octave where cluster fits in piano range
  for (let k = 3; k <= 5; k++) {
    const base = 12 * k + rootPC;
    const pitches = intervals.map(i => base + i);
    if (pitches[0] >= getPianoLow() && pitches[pitches.length - 1] <= getPianoHigh()) {
      return pitches;
    }
  }
  // Fallback: octave 4
  const base = 60 + rootPC;
  const clamped = intervals.map(i => {
    let p = base + i;
    while (p > getPianoHigh()) p -= 12;
    while (p < getPianoLow()) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Alfa Mist warm inversion voicing — first/second inversion triads with 9th.
 *  Self-taught, ear-based: NOT textbook Evans. Spacious but tighter than Metheny.
 *  Root may appear, inversions create warm bottom, 9th adds color on top.
 *  Research: "clever chord inversions" (Qwest TV), Antiphon/Structuralism. */
function buildAlfaMistInversionVoicing(root: string, quality: string): number[] {
  const rootPC = rootMidi(root);
  const q = quality.replace(/\/.*$/, "");

  const isMinor = q.startsWith("m") && !q.startsWith("maj");
  const third = isMinor ? 3 : 4;
  const seventh = (q.includes("maj7") || q.includes("maj9")) ? 11
    : (q.includes("7") || q.includes("9") || q.includes("13")) ? 10
    : isMinor ? 10 : 11;
  const fifth = (q.includes("b5") || q.includes("ø") || q.includes("dim")) ? 6
    : (q.includes("#5") || q.includes("aug") || q.includes("alt")) ? 8 : 7;

  // Inversion shapes — warm, not angular. Span 9-14 semitones (tighter than Metheny's 12-17)
  const shapes: number[][] = [
    // 1st inversion + 9: 3rd on bottom, root above, 9th on top (span 11)
    [third, 12, 14],
    // 2nd inversion + 9: 5th on bottom, root-3rd close, 9th high (span 9)
    [fifth, 12, 12 + third, 14],
    // Root + 7th + 9: warm open (span 14)
    [0, seventh, 14],
    // 1st inversion + 7 + 9: 3rd-7th-root-9 (span 11)
    [third, seventh, 12, 14],
    // Close root position + 9: root-3rd-5th-9 (span 14)
    [0, third, fifth, 14],
  ];

  const intervals = shapes[Math.floor(_rng() * shapes.length)];

  for (let k = 3; k <= 5; k++) {
    const base = 12 * k + rootPC;
    const pitches = intervals.map(i => base + i);
    if (pitches[0] >= getPianoLow() && pitches[pitches.length - 1] <= getPianoHigh()) {
      return pitches;
    }
  }
  const base = 60 + rootPC;
  const clamped = intervals.map(i => {
    let p = base + i;
    while (p > getPianoHigh()) p -= 12;
    while (p < getPianoLow()) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Build open voicing (wide intervals, open 5ths) for Metheny — translates
 *  guitar open-string voicings to piano. Lydian shimmer: 3-note or 4-note
 *  spread across 12-17 semitones. Rootless — bass handles the root. */
function buildOpenVoicing(root: string, quality: string): number[] {
  const rootPC = rootMidi(root);
  const q = quality.replace(/\/.*$/, "");

  let intervals: number[];
  if (q.includes("sus")) {
    // Sus open: 9-5-root (span 12) — open P5 + P4
    intervals = [2, 7, 14];
  } else if (q.includes("#11") || q.includes("lyd")) {
    // Lydian: 3-#11-9 (span 16) — wide, shimmering
    intervals = [4, 6, 14];
  } else if (q.includes("m7b5") || q.includes("ø")) {
    // Half-dim open: b3-b5-b7 (locrian tones)
    intervals = [3, 6, 10];
  } else if (q.includes("dim")) {
    // Diminished open: b3-b5-bb7 (whole-half dim tones)
    intervals = [3, 6, 9];
  } else if (q.includes("aug") && !q.includes("aug7")) {
    // Augmented open: 3-#5-maj7 (augmented triad + maj7)
    intervals = [4, 8, 11];
  } else if (q.includes("m(maj7)")) {
    // Minor-major open: 9-5-maj7 (melodic minor tones)
    intervals = [2, 7, 11];
  } else if (q.startsWith("m") && !q.startsWith("maj")) {
    // Minor open: 9-5-b7 (span 12) — warm open 5th
    intervals = [2, 7, 10];
  } else if (q.includes("69") || q.includes("6")) {
    // 6/9: 3-6-9 (span 11) — bright, open
    intervals = [4, 9, 14];
  } else if (q.includes("alt")) {
    // Altered: 3-b7-b9 (all altered scale tones)
    intervals = [4, 10, 13];
  } else if (q.includes("7b9")) {
    // HW dim: 3-b7-b9 (keeps natural 5th context)
    intervals = [4, 10, 13];
  } else if (q.includes("7#9")) {
    // Dom #9: 3-b7-#9
    intervals = [4, 10, 15];
  } else if (q.includes("7#5") || q.includes("aug7")) {
    // Augmented dom: 3-#5-b7
    intervals = [4, 8, 10];
  } else if (q.includes("maj7") || q.includes("maj9")) {
    // Major with extension: 3-maj7-9 (span 12)
    intervals = [4, 11, 14];
  } else if (q.includes("9") || q.includes("7") || q.includes("13")) {
    // Dominant with extension: 3-b7-9 (span 12)
    intervals = [4, 10, 14];
  } else {
    // Major open: 3-5-9 (span 12) — open triad + 9th
    intervals = [4, 7, 14];
  }

  // Place in register — aim for middle C area for warm piano tone
  for (let k = 3; k <= 5; k++) {
    const base = 12 * k + rootPC;
    const pitches = intervals.map(i => base + i);
    if (pitches[0] >= getPianoLow() && pitches[pitches.length - 1] <= getPianoHigh()) {
      return pitches;
    }
  }
  // Fallback: octave 4
  const base = 60 + rootPC;
  const clamped = intervals.map(i => {
    let p = base + i;
    while (p > getPianoHigh()) p -= 12;
    while (p < getPianoLow()) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Build quartal voicing (stacked diatonic 4ths) for modal/ECM styles.
 *  Uses quality-derived scale tones so voicings are harmonically correct.
 *  Real quartal voicings stack 4ths FROM THE SCALE, not chromatic P4ths. */
function buildQuartalVoicing(root: string, quality?: string): number[] {
  const rootPC = rootMidi(root);
  const q = (quality ?? "").replace(/\/.*$/, "");

  // Quality-aware quartal templates (diatonic 4th stacks from scale tones).
  // Each set picks 4 notes from the implied scale that form roughly quartal spacing.
  let intervals: number[];
  if (q.includes("m(maj7)")) {
    // Minor-major: melodic minor quartal — b3-5-7-9 (all melodic minor tones, avoids b7)
    intervals = [3, 7, 11, 14];
  } else if (q.includes("maj7") || q.includes("maj9") || q.includes("maj")) {
    // Ionian/Lydian: stack from 3rd → E-A-D-G for Cmaj7
    intervals = [4, 9, 14, 19];
  } else if (q.includes("m7b5") || q.includes("ø") || q.includes("dim")) {
    // Locrian/diminished: b3-b6-b2-b5 → Eb-Ab-Db-Gb for Cm7b5
    intervals = [3, 8, 13, 18];
  } else if ((q.includes("m") && !q.includes("maj")) || q.includes("min")) {
    // Dorian/Aeolian: root-based P4 stack works for minor (all dorian tones)
    intervals = [0, 5, 10, 15];
  } else if (q.includes("sus")) {
    // Sus: root-4-b7-3(or 11) → open quartal
    intervals = [0, 5, 10, 17];
  } else if (q.includes("alt")) {
    // Altered: b7-#9-b13-b9 (all altered scale tones)
    intervals = [10, 15, 20, 25];
  } else if (q.includes("7b9")) {
    // HW diminished: b7-b9-3-5 (half-whole dim tones, keeps natural 5th)
    intervals = [10, 13, 16, 19];
  } else if (q.includes("7#9")) {
    // Dominant #9: b7-#9-3-5
    intervals = [10, 15, 16, 19];
  } else if (q.includes("aug") || q.includes("7#5")) {
    // Augmented: b7-3-#5-9 (aug triad / aug dom)
    intervals = [10, 16, 20, 26];
  } else if (q.includes("7b5")) {
    // Lydian dom / tritone sub: b7-3-b5-9
    intervals = [10, 16, 18, 26];
  } else if (q.includes("7") || q.includes("9") || q.includes("13")) {
    // Dominant/Mixolydian: stack from b7 → Bb-E-A-D for C7
    intervals = [10, 16, 21, 26];
  } else {
    // Major triad default: same as maj7
    intervals = [4, 9, 14, 19];
  }

  const base = 60 + rootPC; // C4 — keeps quartal voicings in mid register
  const pitches = intervals.map(i => base + i);
  // Fold into playable range, then dedup (octave-apart intervals can collide after clamping)
  const clamped = pitches.map((p) => {
    while (p > getPianoHigh()) p -= 12;
    while (p < getPianoLow()) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Open 5ths voicing — wide intervals, Holdsworth keyboard signature.
 *  Stacked 5ths (or P5 + M3) spanning 2+ octaves for open, airy sound. */
function buildOpen5thsVoicing(root: string, quality: string): number[] {
  const r = rootMidi(root);
  const q = quality.replace(/\/.*$/, "");
  const base = 60 + r; // C4 — avoids muddy low voicings

  // Determine 3rd quality — m(maj7) is minor despite containing "maj"
  const isMinor = (q.includes("m") && !q.includes("maj")) || q.includes("m(maj7)");
  const thirdInterval = isMinor ? 3 : 4;

  // Wide voicing: root low, 5th up, 3rd higher, 7th highest
  // Spread across 2 octaves for open sound
  let seventh: number;
  if (q.includes("m(maj7)")) seventh = 11;
  else if (q.includes("maj7") || q.includes("maj9")) seventh = 11;
  else if (q.includes("7") || q.includes("9") || q.includes("13")) seventh = 10;
  else seventh = 10;

  // Use correct 5th for the chord quality
  let fifth = 7; // perfect 5th
  if (q.includes("b5") || q.includes("ø") || q.includes("dim")) fifth = 6;
  else if (q.includes("#5") || q.includes("aug") || q.includes("alt")) fifth = 8;

  const pitches = [
    base,                    // root (low)
    base + fifth,            // 5th (quality-aware)
    base + 12 + thirdInterval, // 3rd (octave up)
    base + 12 + seventh,     // 7th (octave up)
  ];

  // Fold into playable range, then dedup (octave-apart intervals can collide after clamping)
  const clamped = pitches.map(p => {
    while (p > getPianoHigh()) p -= 12;
    while (p < getPianoLow()) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Standard Evans rootless voicing with voice-leading optimization. */
function buildStandardVoicing(
  root: string,
  quality: string,
  prevPitches: number[] | null,
  shell: boolean,
  resolving = false,
): number[] {
  const q = quality.replace(/\/.*$/, "");
  // ii-V-I: when dominant resolves to I, use altered templates as third option.
  // No extra rng calls - voice-leading comparison chooses closest.
  const useAltered = resolving && isDominantQuality(q);
  const templates = resolveVoicingQuality(useAltered ? "7alt" : q);

  if (!templates) {
    const r = rootMidi(root);
    return [60 + r, 60 + r + 4, 60 + r + 7].map((p) => {
      while (p > getPianoHigh()) p -= 12;
      while (p < getPianoLow()) p += 12;
      return p;
    });
  }

  const voicingA = buildVoicing(root, templates[0]);
  const voicingB = buildVoicing(root, templates[1]);

  if (!prevPitches) {
    return shell ? toShellVoicing(voicingA) : voicingA;
  }

  // When resolving, also consider the standard dominant voicing
  // and let voice-leading distance pick the best option (3-way comparison)
  if (useAltered) {
    const stdTemplates = resolveVoicingQuality(q);
    if (stdTemplates) {
      const stdA = buildVoicing(root, stdTemplates[0]);
      const stdB = buildVoicing(root, stdTemplates[1]);
      const candidates = [voicingA, voicingB, stdA, stdB];
      const dists = candidates.map(c => voiceLeadingDistance(prevPitches!, c));
      const best = candidates[dists.indexOf(Math.min(...dists))];
      return shell ? toShellVoicing(best) : best;
    }
  }

  const distA = voiceLeadingDistance(prevPitches, voicingA);
  const distB = voiceLeadingDistance(prevPitches, voicingB);
  const full = distB < distA ? voicingB : voicingA;
  return shell ? toShellVoicing(full) : full;
}

/** Root-position voicing for funk/blues (includes root, NOT rootless). */
function buildRootPositionVoicing(root: string, quality: string): number[] {
  const r = rootMidi(root);
  const base = 60 + r; // C4 range — root position stays in mid register

  // Build from chord tones with root included
  const q = quality.replace(/\/.*$/, "");
  let intervals: number[];
  if (q.includes("m7") || q.includes("m9")) {
    intervals = [0, 3, 7, 10]; // minor 7th
  } else if (q.includes("7") || q.includes("9") || q.includes("13")) {
    intervals = [0, 4, 7, 10]; // dominant 7th
  } else if (q.includes("maj7") || q.includes("maj9")) {
    intervals = [0, 4, 7, 11]; // major 7th
  } else if (q.includes("m")) {
    intervals = [0, 3, 7]; // minor triad
  } else if (q.includes("dim")) {
    intervals = [0, 3, 6]; // diminished
  } else {
    intervals = [0, 4, 7]; // major triad
  }

  const clamped = intervals.map(i => {
    let p = base + i;
    while (p > getPianoHigh()) p -= 12;
    while (p < getPianoLow()) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Detect dominant chord quality (not minor, not major 7th, not dim/sus). */
function isDominantQuality(q: string): boolean {
  const c = q.replace(/\/.*$/, "");
  if (c.startsWith("m") && !c.startsWith("maj")) return false;
  if (c.includes("maj")) return false;
  if (c.includes("dim")) return false;
  if (c.includes("sus")) return false;
  return c.includes("7") || c.includes("9") || c.includes("13");
}

/** Check if root motion is V-I (up a perfect 4th = 5 semitones). */
function isResolvingDominant(currentRoot: string, nextRoot: string): boolean {
  return (rootMidi(nextRoot) - rootMidi(currentRoot) + 12) % 12 === 5;
}

/** Pick best voicing type based on style, with variety tracking.
 *  `lastType` is a mutable ref [value] — avoids picking same voicing type consecutively. */
function pickVoicing(
  root: string,
  quality: string,
  prevPitches: number[] | null,
  style?: string,
  shell = false,
  lastType?: [number],
  resolving = false,
): number[] {
  // Helper: pick from weighted options, avoiding lastType when possible
  const pickWithVariety = (options: [number, () => number[]][]): number[] => {
    // Build cumulative weights
    const total = options.reduce((s, o) => s + o[0], 0);
    let roll = _rng() * total;
    let chosen = options.length - 1;
    for (let i = 0; i < options.length; i++) {
      roll -= options[i][0];
      if (roll <= 0) { chosen = i; break; }
    }
    // If same as last type and there are alternatives, re-roll once
    if (lastType && chosen === lastType[0] && options.length > 1) {
      const alt = (chosen + 1 + Math.floor(_rng() * (options.length - 1))) % options.length;
      chosen = alt;
    }
    if (lastType) lastType[0] = chosen;
    return options[chosen][1]();
  };

  // Pat Metheny: 65% wide open voicings (guitar translation), 35% quartal (variety)
  if (style === "metheny") {
    return pickWithVariety([
      [65, () => buildOpenVoicing(root, quality)],
      [35, () => buildQuartalVoicing(root, quality)],
    ]);
  }

  // Alfa Mist: 45% cluster (tight, dreamy), 20% warm inversions (1st/2nd inv + 9th),
  // 35% standard Evans (variety). Self-taught ear-based voicing approach.
  if (style === "alfaMist") {
    return pickWithVariety([
      [45, () => buildClusterVoicing(root, quality)],
      [20, () => buildAlfaMistInversionVoicing(root, quality)],
      [35, () => buildStandardVoicing(root, quality, prevPitches, shell)],
    ]);
  }

  // Modal: 60% quartal (McCoy Tyner), 40% standard rootless (variety)
  if (style === "modal") {
    return pickWithVariety([
      [60, () => buildQuartalVoicing(root, quality)],
      [40, () => buildStandardVoicing(root, quality, prevPitches, shell)],
    ]);
  }

  // ECM: 70% quartal (Nordic clarity), 30% standard
  if (style === "ecm") {
    return pickWithVariety([
      [70, () => buildQuartalVoicing(root, quality)],
      [30, () => buildStandardVoicing(root, quality, prevPitches, shell)],
    ]);
  }

  // Cool Jazz: always shell voicings (2-note guide tones) for lighter texture
  if (style === "coolJazz") {
    return buildStandardVoicing(root, quality, prevPitches, true);
  }

  // Holdsworth: 40% open 5ths (wide intervals), 35% quartal (4th stacks), 25% open voicings
  if (style === "holdsworth") {
    return pickWithVariety([
      [40, () => buildOpen5thsVoicing(root, quality)],
      [35, () => buildQuartalVoicing(root, quality)],
      [25, () => buildOpenVoicing(root, quality)],
    ]);
  }

  // Fusion: 50% quartal (Herbie Hancock), 50% open voicings
  if (style === "fusion") {
    return pickWithVariety([
      [50, () => buildQuartalVoicing(root, quality)],
      [50, () => buildOpenVoicing(root, quality)],
    ]);
  }

  // Neo-Soul: 55% cluster voicings (Glasper, higher register), 45% standard
  if (style === "neoSoul" && _rng() < 0.55) {
    return buildClusterVoicing(root, quality);
  }

  // Funk: root-position voicings (funk piano is NOT rootless)
  if (style === "funk") {
    return buildRootPositionVoicing(root, quality);
  }

  // Shuffle Blues: root-position triads + 7ths (blues piano is NOT rootless)
  if (style === "shuffleBlues") {
    const voicing = buildRootPositionVoicing(root, quality);
    if (shell && voicing.length >= 4) {
      // Root-position shell = 3rd + 7th (guide tones), skip root + 5th
      const sorted = [...voicing].sort((a, b) => a - b);
      return [sorted[1], sorted[3] ?? sorted[sorted.length - 1]];
    }
    return shell ? toShellVoicing(voicing) : voicing;
  }

  return buildStandardVoicing(root, quality, prevPitches, shell, resolving);
}

/** Reduce to 2-note shell voicing (3rd + 7th — the guide tones). */
function toShellVoicing(pitches: number[]): number[] {
  if (pitches.length <= 2) return pitches;
  // Shell = lowest + third-by-pitch (3rd + 7th in rootless voicings, skipping 5th and tensions)
  const sorted = [...pitches].sort((a, b) => a - b);
  return [sorted[0], sorted[2] ?? sorted[1]];
}

function pickRhythm(
  style: string,
  density?: number,
  recentIndices?: number[],
  timeSig?: [number, number],
): { rhythm: RhythmHit[]; index: number } {
  // Use odd-meter specific rhythms when applicable
  const oddMeterRhythms = timeSig ? getOddMeterRhythms(timeSig) : null;
  const isOddMeter = oddMeterRhythms !== null
    && !(timeSig![0] === 4 && timeSig![1] === 4)
    && !(timeSig![0] === 3 && timeSig![1] === 4 && style === "jazzWaltz");

  const STYLE_RHYTHMS: Record<string, RhythmHit[][]> = {
    swing: SWING_RHYTHMS,
    bossa: BOSSA_RHYTHMS,
    latin: LATIN_RHYTHMS,
    ballad: BALLAD_RHYTHMS,
    fusion: FUSION_RHYTHMS,
    ecm: ECM_RHYTHMS,
    hardBop: HARD_BOP_RHYTHMS,
    coolJazz: COOL_JAZZ_RHYTHMS,
    modal: MODAL_RHYTHMS,
    jazzWaltz: JAZZ_WALTZ_RHYTHMS,
    shuffleBlues: SHUFFLE_BLUES_RHYTHMS,
    neoSoul: NEO_SOUL_RHYTHMS,
    contemporaryJazz: CONTEMP_JAZZ_RHYTHMS,
    mathRock: MATH_ROCK_RHYTHMS,
    idm: IDM_RHYTHMS,
    holdsworth: HOLDSWORTH_RHYTHMS,
    alfaMist: ALFA_MIST_RHYTHMS,
    metheny: METHENY_RHYTHMS,
  };

  const patterns = isOddMeter ? oddMeterRhythms! : (STYLE_RHYTHMS[style] ?? SWING_RHYTHMS);

  // Density bias: prefer sparser patterns when density < 50, busier when > 50
  if (density !== undefined && patterns.length > 1) {
    const sorted = [...patterns].sort((a, b) => a.length - b.length);
    const idx = Math.floor((density / 100) * (sorted.length - 0.01));
    if (_rng() < 0.7) {
      const picked = sorted[Math.min(idx, sorted.length - 1)];
      return { rhythm: picked, index: patterns.indexOf(picked) };
    }
  }

  // Anti-repetition: weight down recently used patterns
  if (recentIndices && recentIndices.length > 0 && patterns.length > 2) {
    const weights = patterns.map((_, i) => {
      if (i === recentIndices[0]) return 0.25;
      if (recentIndices.length > 1 && i === recentIndices[1]) return 0.5;
      return 1.0;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = _rng() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return { rhythm: patterns[i], index: i };
    }
  }

  const idx = Math.floor(_rng() * patterns.length);
  return { rhythm: patterns[idx], index: idx };
}

function humanizeTime(time: number, enabled: boolean, style?: string, beatOffset?: number): number {
  if (!enabled) return time;
  const template = getGrooveTemplate(style ?? "swing");
  const isAnticipation = beatOffset !== undefined && beatOffset >= 3.5;
  const element = isAnticipation ? template.pianoAnticipation : template.piano;
  return applyGroove(time, element, _rng, _pianoEnergy, _pianoArc);
}

function humanizeVelocity(vel: number, enabled: boolean): number {
  if (!enabled) return Math.max(30, Math.min(127, vel));
  return Math.max(30, Math.min(127, vel + Math.floor((_rng() - 0.5) * 10)));
}

/** Expand multi-pitch CompNotes into staggered single-pitch notes.
 *  Simulates natural pianist finger roll - bottom note first.
 *  Non-uniform spacing: accelerating roll (faster at start, slower at end) mimics
 *  real finger mechanics. Exponent randomized slightly per chord for natural feel.
 *  Slight velocity taper: upper notes softer. */
function strumSpread(notes: CompNote[], totalMs: number): CompNote[] {
  const result: CompNote[] = [];
  for (const note of notes) {
    if (note.pitches.length <= 2) {
      result.push(note);
      continue;
    }
    const sorted = [...note.pitches].sort((a, b) => a - b);
    const n = sorted.length;
    const totalSec = totalMs / 1000;
    // Randomize exponent: 1.3-1.7 (accelerating roll, faster start, slower finish)
    const exponent = 1.3 + _rng() * 0.4;
    // Proportional velocity decay: cap total drop at ~15% of base velocity.
    const maxTotalDrop = Math.max(4, Math.round(note.velocity * 0.15));
    const maxPerStep = Math.max(1, Math.round(maxTotalDrop / Math.max(1, n - 1)));
    let velDrop = 0;
    for (let i = 0; i < n; i++) {
      const t = i === 0 ? 0 : Math.pow(i / (n - 1), exponent) * totalSec;
      result.push({
        pitches: [sorted[i]],
        time: note.time + t,
        duration: note.duration - t,
        velocity: Math.max(30, note.velocity - velDrop),
      });
      velDrop += 1 + Math.round(_rng() * (maxPerStep - 1));
    }
  }
  return result;
}

// ── Beat Position Metadata ──
// WeakMap tracks raw beat-in-bar for each note (set at creation, before humanization).
// Used by broken voicings to reliably detect strong beats without time-rounding errors.
const _noteBeat = new WeakMap<CompNote, number>();

// ── Broken Voicings ──

const BROKEN_VOICING_STYLES = new Set(["swing", "hardBop", "coolJazz", "neoSoul", "contemporaryJazz", "alfaMist", "holdsworth"]);

function applyBrokenVoicings(
  notes: CompNote[],
  style: string,
  beatDuration: number = 0.5,
  brokenProb: number = 0.20,
): CompNote[] {
  if (!BROKEN_VOICING_STYLES.has(style)) return notes;

  const result: CompNote[] = [];
  for (const note of notes) {
    // Skip non-4-note chords, 80% of chords, and beats near strong positions.
    // Tolerance 0.5 catches swing-displaced "ands" that land near beats 1/3
    // (e.g. rawBeatOffset 1.5 swings to ~1.9, perceptually on beat 2).
    const rawBeat = _noteBeat.get(note);
    const beatInMeasure = rawBeat !== undefined
      ? rawBeat % 4
      : (beatDuration > 0 ? (note.time / beatDuration) % 4 : 0);
    const nearStrongBeat = beatInMeasure <= 0.5 || beatInMeasure >= 3.5
      || Math.abs(beatInMeasure - 2) <= 0.5;
    if (note.pitches.length !== 4 || _rng() >= brokenProb || nearStrongBeat) {
      result.push(note);
      continue;
    }

    const sorted = [...note.pitches].sort((a, b) => a - b);
    // Broken voicing gap: 40-80ms (tight pianist chord break)
    const breakGap = 0.04 + _rng() * 0.04;

    // Skip broken voicing if second group would have no duration
    if (note.duration <= breakGap + 0.05) {
      result.push(note);
      continue;
    }

    // Group 1: bottom 2 notes on the beat
    result.push({
      pitches: [sorted[0], sorted[1]],
      time: note.time,
      duration: note.duration,
      velocity: note.velocity,
    });

    // Group 2: top 2 notes slightly after (broken chord, not full "and")
    result.push({
      pitches: [sorted[2], sorted[3]],
      time: note.time + breakGap,
      duration: Math.max(0.05, note.duration - breakGap),
      velocity: Math.max(40, note.velocity - 5),
    });
  }
  return result;
}

/** Infer time signature from measure duration and beat duration. */
function inferCompTimeSig(measureDuration: number, beatDuration: number): [number, number] {
  const beats = measureDuration / beatDuration;
  if (Math.abs(beats - 4) < 0.1) return [4, 4];
  if (Math.abs(beats - 3) < 0.1) return [3, 4];
  if (Math.abs(beats - 5) < 0.1) return [5, 4];
  if (Math.abs(beats - 6) < 0.1) return [6, 4];
  if (Math.abs(beats - 7) < 0.1) return [7, 4];
  if (Math.abs(beats - 3.5) < 0.1) return [7, 8];
  if (Math.abs(beats - 4.5) < 0.1) return [9, 8];
  if (Math.abs(beats - 5.5) < 0.1) return [11, 8];
  return [4, 4];
}

// ── Motif Evolution ──

/** Evolve a rhythm pattern on repeat bars. Real pianists don't copy patterns exactly -
 *  they displace, fragment, merge, and reshape motifs. Creativity parameter weights
 *  conservative mutations (drop/extend) vs adventurous ones (displacement/fragmentation).
 *  `barsLeft` controls drift magnitude: early repeats stay close, later ones diverge. */
function evolveMotif(
  base: RhythmHit[],
  barsLeft: number,
  creativity: number,
  rng: () => number,
): RhythmHit[] {
  if (creativity < 0.05 || rng() > 0.3 + creativity * 0.5) return base;

  const evolved = base.map(([beat, dur]) => [beat, dur] as RhythmHit);
  const idx = Math.floor(rng() * evolved.length);
  // More mutations accumulate as bars progress (barsLeft decreases)
  const driftFactor = Math.max(0.5, 1.0 - barsLeft * 0.15);

  const mutation = rng();
  if (mutation < 0.15 && evolved.length > 1) {
    // Drop a hit (creates space)
    evolved.splice(idx, 1);
  } else if (mutation < 0.30) {
    // Shift timing slightly (±0.25 beats, scaled by drift)
    const shift = (rng() - 0.5) * 0.5 * driftFactor;
    evolved[idx] = [Math.max(0, Math.min(3.75, evolved[idx][0] + shift)), evolved[idx][1]];
  } else if (mutation < 0.40) {
    // Extend or shorten duration
    const scale = 0.7 + rng() * 0.6;
    evolved[idx] = [evolved[idx][0], Math.max(0.05, evolved[idx][1] * scale)];
  } else if (mutation < 0.50 && evolved.length < 4) {
    // Add a ghost hit
    const ghostBeat = rng() * 3.5;
    evolved.push([ghostBeat, 0.4]);
    evolved.sort((a, b) => a[0] - b[0]);
  } else if (mutation < 0.60 && creativity > 0.3) {
    // Rhythmic displacement: shift entire pattern by 8th or 16th note
    const displace = rng() < 0.5 ? 0.5 : 0.25;
    const dir = rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < evolved.length; i++) {
      const newBeat = evolved[i][0] + displace * dir;
      if (newBeat >= 0 && newBeat <= 3.75) {
        evolved[i] = [newBeat, evolved[i][1]];
      }
    }
  } else if (mutation < 0.70 && creativity > 0.35 && evolved.length >= 3) {
    // Fragmentation: use only first half of pattern (truncate)
    const halfLen = Math.max(1, Math.ceil(evolved.length / 2));
    evolved.splice(halfLen);
  } else if (mutation < 0.80 && creativity > 0.3 && evolved.length >= 2) {
    // Extension: repeat last hit with slight offset
    const last = evolved[evolved.length - 1];
    const ext: RhythmHit = [Math.min(3.75, last[0] + 0.5 + rng() * 0.25), last[1] * 0.8];
    evolved.push(ext);
  } else if (mutation < 0.90 && creativity > 0.4 && evolved.length >= 2) {
    // Density mutation: split one long note into two short ones
    if (evolved[idx][1] > 0.6) {
      const halfDur = evolved[idx][1] * 0.45;
      const beat2 = Math.min(3.75, evolved[idx][0] + halfDur + 0.1);
      evolved[idx] = [evolved[idx][0], halfDur];
      evolved.splice(idx + 1, 0, [beat2, halfDur]);
    }
  } else if (evolved.length >= 3) {
    // Density mutation: merge two adjacent short notes into one longer note
    const mergeIdx = Math.min(idx, evolved.length - 2);
    const merged: RhythmHit = [evolved[mergeIdx][0], evolved[mergeIdx][1] + evolved[mergeIdx + 1][1]];
    evolved.splice(mergeIdx, 2, merged);
  }

  return evolved;
}

// ── Main Generator ──

/**
 * Generate piano comping from chord events.
 * Returns array of CompNote (chord voicings with timing).
 */
export function generatePianoComping(
  chords: ChordEvent[],
  options: PianoCompingOptions = {},
): CompNote[] {
  if (chords.length === 0) return [];
  const prevRng = _rng;
  const prevGranular = _pianoGranular;
  const prevEnergy = _pianoEnergy;
  const prevArc = _pianoArc;
  _rng = options.random ?? Math.random;
  _pianoGranular = options.granular;

  const style = options.style ?? "swing";
  const tempo = options.tempo ?? 120;
  if (tempo <= 0) { _rng = prevRng; _pianoGranular = prevGranular; _pianoEnergy = prevEnergy; _pianoArc = prevArc; throw new RangeError(`tempo must be > 0, got ${tempo}`); }
  try {
  const humanize = options.humanize ?? true;
  const density = options.density;
  const swingAmount = options.swingAmount ?? 100;
  const strumMs = options.strumMs ?? 20;
  const doStrum = strumMs > 0 && options.strum !== false;
  const beatDuration = 60 / tempo;

  const velScale = style === "ecm" ? 0.88
    : style === "coolJazz" ? 0.85
    : style === "hardBop" ? 1.1
    : style === "fusion" ? 0.9
    : style === "neoSoul" || style === "contemporaryJazz" ? 0.85
    : style === "idm" ? 0.7
    : style === "holdsworth" ? 0.85
    : style === "metheny" ? 0.78
    : style === "alfaMist" ? 0.80
    : 1.0;

  const bandCtx = options.bandContext;
  const pianoGranular = options.granular;
  // voicingDensity: low → shell voicings (2-note), high → full voicings (4-note)
  // At fast tempos (>220), force shell voicings - dense chords blur at speed
  // Fast harmonic rhythm (>=3 chords/bar): force shells - too many dense voicings = clutter
  const voicingThreshold = pianoGranular ? pianoGranular.voicingDensity : 50;
  const hrForceShell = (bandCtx?.harmonicRhythm ?? 1) >= 3;
  const forceShell = tempo > 220 || hrForceShell;
  // Probabilistic shell: lower voicingDensity = more shell voicings
  const shellChance = forceShell ? 1.0
    : voicingThreshold < 25 ? 0.7
    : voicingThreshold < 50 ? 0.3
    : voicingThreshold < 75 ? 0.1
    : voicingThreshold < 95 ? 0.03
    : 0;
  const drumDensityRestBoost = bandCtx && bandCtx.drumDensity > 0.6
    ? 0.08 * bandCtx.drumDensity : 0;
  // Increase rests at fast tempos: uptempo comping should be sparse
  const tempoRestBoost = tempo > 200 ? Math.min(0.20, (tempo - 200) / 500) : 0;
  const baseRestChance = 0.15 * (1 - (density ?? 50) / 100) + drumDensityRestBoost + tempoRestBoost;
  const notes: CompNote[] = [];
  let prevPitches: number[] | null = null;
  let wasRest = false;
  const recentRhythmIndices: number[] = [];

  // ── Register Drift State ──
  // Tracks an octave offset that shifts up during builds/climaxes and down during releases/drops.
  // Real pianists move register for narrative — low for intimate, high for energy.
  let registerShift = 0; // semitones to add to voicings (multiples of 12)
  const voicingTypeRef: [number] = [-1]; // mutable ref for voicing variety tracking

  // ── Musicality Parameters ──
  // Only active in ensemble mode (bandContext provided). Standalone calls get safe defaults.
  const creativity = bandCtx ? (bandCtx.creativity ?? 35) / 100 : 0;
  const conversation = bandCtx ? (bandCtx.conversation ?? 30) / 100 : 0;
  const harmonicFreedom = bandCtx ? (bandCtx.harmonicFreedom ?? 25) / 100 : 0;
  const intent = bandCtx?.currentPhraseIntent ?? null;

  // ── Motif Memory (all styles, not just alfaMist) ──
  // Holds same rhythm pattern for multiple bars. Creates compositional coherence.
  // alfaMist: hip-hop loop mentality. metheny: sustained concept. holdsworth: conversational development.
  let loopRhythm: RhythmHit[] | null = null;
  let loopBarsLeft = 0;
  // Base lock duration from intent, fallback to style-based defaults
  const motifLockBase = intent?.motifLockBars ??
    (style === "metheny" || style === "ecm" ? 4
    : style === "alfaMist" ? 3
    : style === "holdsworth" ? 2
    : style === "fusion" ? 2
    : creativity < 0.3 ? 3 : 2);

  // ── Harmonic Anticipation State ──
  // Probability of playing next chord voicing on beat 4-and, creating forward motion.
  // anticipation granular (0-100) maps directly to probability; falls back to harmonicFreedom
  const anticipationProb = intent?.anticipationChance
    ?? (pianoGranular ? pianoGranular.anticipation / 100 : harmonicFreedom * 0.35);
  // Passing chord probability: insert chromatic approach chord between changes
  const passingChordProb = intent?.passingChordChance ?? harmonicFreedom * 0.25;

  const inferredTimeSig: [number, number] | undefined = chords.length > 0
    ? inferCompTimeSig(chords[0].duration, beatDuration)
    : undefined;

  // Measure duration for phrase intent lookups
  const measureDuration = options.measureInfo?.measureDuration ?? (chords.length > 0 ? chords[0].duration : beatDuration * 4);

  // ── Velocity Contour ──
  // Per-beat velocity shape within a bar. Real pianists don't play binary loud/soft —
  // they create a dynamic curve. Beat 1 accented, mid-bar lighter, beat 3 lifts, beat 4 falls.
  const velContour = (beatPos: number, beatsPerBar: number): number => {
    if (beatsPerBar <= 0) return 78;
    const pct = beatPos / beatsPerBar;
    // Accent beat 1, dip mid-bar, slight lift beat 3 area, taper at end
    // Base curve: 85 → 68 → 75 → 65 (in 4/4), with ±6 humanized jitter
    const base = 85 - 20 * Math.sin(pct * Math.PI) + 10 * Math.sin(pct * 2 * Math.PI);
    const jitter = (_rng() - 0.5) * 12; // ±6 velocity
    return Math.round(base + jitter);
  };
  const beatsPerBar = inferredTimeSig ? inferredTimeSig[0] : 4;

  for (let ci = 0; ci < chords.length; ci++) {
    const chord = chords[ci];
    const nextChord = ci + 1 < chords.length ? chords[ci + 1] : null;

    // ── Phrase Intent: Air Gap / Rest Decisions ──
    const measureIdx = Math.floor(chord.time / measureDuration);
    const phraseIntent = bandCtx?.phraseMap
      ? getPhraseIntentForMeasure(measureIdx, bandCtx.phraseMap)
      : intent;

    // Update module-level groove evolution state for humanizeTime
    _pianoEnergy = bandCtx?.sectionEnergy ?? 0.7;
    _pianoArc = (phraseIntent?.arc as import("./types").PhraseArc) ?? null;

    // Intent-driven rest: if this measure is in pianoRests, skip it
    if (phraseIntent?.pianoRests?.includes(measureIdx)) {
      wasRest = true;
      continue;
    }

    // Intent-driven drop: play very softly with minimal voicing
    const isDrop = phraseIntent?.dropMeasures?.includes(measureIdx) ?? false;

    // ── Conversation Awareness ──
    // When another instrument is the "leader", piano lays back (sparser, softer).
    // When piano is the leader, play more actively.
    const isLeader = phraseIntent?.conversationLeader === "piano";
    const isListening = phraseIntent?.conversationLeader != null && !isLeader;
    // Scale effect with conversation parameter: low conversation = instruments play independently,
    // high conversation = dramatic leader/listener contrast
    const conversationDensityMult = isLeader ? 1 + 0.3 * conversation : isListening ? 1 - 0.5 * conversation : 1.0;

    // Form-aware density
    const formPct = chords.length > 1 ? ci / chords.length : 0.5;
    const formDensityMult = formPct < 0.15 ? 0.6
      : formPct < 0.50 ? 0.8
      : formPct < 0.80 ? 1.0
      : 0.9;

    // Crescendo boost within phrase
    const crescendoMult = phraseIntent?.crescendo ? (0.85 + formPct * 0.2) : 1.0;

    // Feel changes: double-time = fewer rests (busier), half-time = more rests (spacious)
    const pianoFeel = phraseIntent?.feel ?? "normal";
    const feelRestMult = pianoFeel === "doubleTime" ? 0.5 : pianoFeel === "halfTime" ? 2.0 : 1.0;

    const restChance = (baseRestChance / formDensityMult) / conversationDensityMult * feelRestMult;

    // Rest bar: skip chord (never first, never last, never consecutive)
    const isLast = ci === chords.length - 1;
    if (ci > 0 && !isLast && !wasRest && _rng() < restChance) {
      wasRest = true;
      continue;
    }
    wasRest = false;

    // ── ii-V-I Awareness ──
    // On V-I resolutions, bias voicing toward altered tones for tension.
    // Uses harmonic analysis when available, falls back to ad-hoc detection.
    const isResolving = chord.analysis
      ? (chord.analysis.isPartOfIiVI && chord.analysis.iiViPosition === "V")
        || (chord.analysis.function === "dominant" && chord.analysis.cadenceType === "authentic")
        || chord.analysis.isSecondaryDominant
      : !!(nextChord && isDominantQuality(chord.quality)
        && isResolvingDominant(chord.root, nextChord.root));

    // Pre-roll shell decision once per chord - anticipation/passing use same density
    const chordShell = _rng() < shellChance;
    const pitches = pickVoicing(chord.root, chord.quality, prevPitches, style, chordShell, voicingTypeRef, isResolving);
    prevPitches = pitches;

    // ── Register Drift ──
    // Shift voicings up during builds/climaxes, down during releases/drops.
    // registerRange (0-100) scales max drift: 0=no shift, 50=±12, 100=±24 semitones
    const maxRegShift = pianoGranular ? Math.round(pianoGranular.registerRange / 100 * 24) : 24;
    const regDriftProb = pianoGranular ? 0.1 + (pianoGranular.registerRange / 100) * 0.3 : 0.3;
    const arc = phraseIntent?.arc;
    if (arc === "build" || arc === "climax" || arc === "shout" || arc === "solo") {
      if (registerShift < maxRegShift) registerShift += (_rng() < regDriftProb ? 12 : 0);
    } else if (arc === "release" || arc === "drop" || arc === "outro" || arc === "breakdown") {
      if (registerShift > -maxRegShift) registerShift -= (_rng() < regDriftProb ? 12 : 0);
    } else {
      // Sustain: drift back toward center
      if (registerShift > 0 && _rng() < 0.2) registerShift -= 12;
      if (registerShift < 0 && _rng() < 0.2) registerShift += 12;
    }

    // ── Motif Memory: Rhythm Selection ──
    // All styles now benefit from motif lock — holds pattern for N bars.
    // Creates the "composed" feel that separates algorithmic from musical.
    let rhythm: RhythmHit[];
    if (loopBarsLeft > 0 && loopRhythm) {
      // Motif evolution: on repeat bars, slightly modify pattern instead of exact copy.
      // A human pianist evolves a motif — adds a ghost hit, shifts timing, drops a note.
      rhythm = evolveMotif(loopRhythm, loopBarsLeft, creativity, _rng);
      loopBarsLeft--;
    } else {
      // rhythmicActivity overrides density for rhythm pattern selection
      // At fast tempos (>200), cap effective density to prefer sparser patterns
      const tempoDensityCap = tempo > 200 ? Math.max(20, 100 - (tempo - 200) * 0.5) : 100;
      const rawRhythmDensity = pianoGranular ? pianoGranular.rhythmicActivity : density;
      const rhythmDensity = rawRhythmDensity !== undefined ? Math.min(rawRhythmDensity, tempoDensityCap) : Math.min(50, tempoDensityCap);
      const picked = pickRhythm(style, rhythmDensity, recentRhythmIndices, inferredTimeSig);
      rhythm = picked.rhythm;
      recentRhythmIndices.unshift(picked.index);
      if (recentRhythmIndices.length > 2) recentRhythmIndices.pop();
      loopRhythm = rhythm;
      // Lock duration: base + random variation. Higher creativity = more variation.
      loopBarsLeft = Math.max(0, motifLockBase - 1 + Math.floor(_rng() * 2));
    }

    // ── Drop Measure: Minimal Voicing ──
    // During drops, play just a sustained shell voicing (2 notes, very soft)
    if (isDrop) {
      const shellPitches = toShellVoicing(pitches);
      notes.push({
        pitches: [...shellPitches],
        time: humanizeTime(chord.time, humanize, style, 0),
        duration: chord.duration * 0.9,
        velocity: humanizeVelocity(Math.round(45 * velScale), humanize),
      });
      continue;
    }

    // Tension-modulated anticipation: boost when current chord has high tension
    // (dominant wanting to resolve) and next chord is a resolution
    const chordTension = chord.analysis?.tension ?? 0.5;
    const tensionAnticipBoost = chordTension > 0.6 ? 1.0 + (chordTension - 0.6) * 1.5 : 1.0;
    const effectiveAnticipProb = Math.min(0.6, anticipationProb * tensionAnticipBoost);

    for (const [rawBeatOffset, durMult] of rhythm) {
      // ── Harmonic Anticipation ──
      // On beat 3.5+, possibly play NEXT chord's voicing (creates forward pull).
      // Controlled by harmonicFreedom parameter, boosted by harmonic tension.
      let usePitches = pitches;
      if (rawBeatOffset >= 3.5 && nextChord) {
        // Original behavior + enhanced by harmonicFreedom
        usePitches = pickVoicing(nextChord.root, nextChord.quality, prevPitches, style, chordShell, voicingTypeRef);
      } else if (rawBeatOffset >= 3.0 && rawBeatOffset < 3.5 && nextChord && _rng() < effectiveAnticipProb) {
        // Early anticipation on beat 3-and (harmonicFreedom + tension-controlled)
        // Creates forward motion - piano "hears" the next chord before it arrives.
        usePitches = pickVoicing(nextChord.root, nextChord.quality, prevPitches, style, chordShell, voicingTypeRef);
      }

      // ── Passing Chord Insertion ──
      // Between current and next chord, insert a chromatic approach voicing.
      // Creates movement and harmonic interest. Controlled by harmonicFreedom.
      if (rawBeatOffset >= 2.5 && rawBeatOffset < 3.0 && nextChord && _rng() < passingChordProb) {
        // Chromatic approach: voice the chord a half-step above next root
        const passingRoot = chromaticApproachRoot(nextChord.root, _rng() < 0.5);
        const passingPitches = pickVoicing(passingRoot, nextChord.quality, prevPitches, style, chordShell, voicingTypeRef);
        const passingTime = chord.time + rawBeatOffset * beatDuration;
        if (passingTime < chord.time + chord.duration) {
          const pn: CompNote = {
            pitches: [...passingPitches],
            time: humanizeTime(passingTime, humanize, style, rawBeatOffset),
            duration: beatDuration * 0.4,
            velocity: humanizeVelocity(Math.round(60 * velScale), humanize),
          };
          _noteBeat.set(pn, rawBeatOffset);
          notes.push(pn);
        }
        continue; // passing chord replaces normal hit at this position
      }

      // Apply swing
      let beatOffset = rawBeatOffset;
      const frac = beatOffset % 1;
      if (Math.abs(frac - 0.5) < 0.01) {
        const effectiveSwing = swingAmount * tempoSwingMultiplier(tempo, bandCtx?.sectionEnergy) * instrumentSwingFactor("piano");
        const swingOffset = (effectiveSwing / 100) * (2 / 3 - 0.5);
        beatOffset = Math.floor(beatOffset) + 0.5 + swingOffset;
      }
      const time = chord.time + beatOffset * beatDuration;
      if (time >= chord.time + chord.duration) break;

      const duration = Math.min(
        durMult * beatDuration,
        chord.time + chord.duration - time,
      );

      const dynMult = options.measureInfo
        ? dynamicMultiplier(Math.floor(chord.time / (options.measureInfo.measureDuration || 1)), options.measureInfo.totalMeasures, style, options.measureInfo.sections)
        : 1.0;
      const hasSectionDynamics = options.measureInfo?.sections && options.measureInfo.sections.length > 0;
      const energyMult = (bandCtx && !hasSectionDynamics) ? (0.7 + bandCtx.sectionEnergy * 0.3) : 1.0;

      // Conversation velocity adjustment
      const convVelMult = isListening ? 1 - 0.3 * conversation : isLeader ? 1 + 0.1 * conversation : 1.0;
      const contourVel = velContour(rawBeatOffset, beatsPerBar);
      const baseVel = Math.max(48, Math.round(contourVel * velScale * dynMult * energyMult * convVelMult * crescendoMult));

      // Apply register drift + bass collision avoidance
      let finalPitches = registerShift !== 0
        ? [...new Set(usePitches.map(p => {
            let shifted = p + registerShift;
            while (shifted > getPianoHigh()) shifted -= 12;
            while (shifted < getPianoLow()) shifted += 12;
            return shifted;
          }))]
        : usePitches;
      // Bass-piano collision avoidance: shift piano voicing away from bass register.
      // When bass is high, push piano up. When bass is mid, prefer upper register.
      // Prevents frequency masking where bass and piano double in same octave.
      if (bandCtx?.bassRegister === "high") {
        const lowestPitch = Math.min(...finalPitches);
        if (lowestPitch < 62) {
          finalPitches = finalPitches.map(p => {
            const shifted = p + 12;
            return shifted > getPianoHigh() ? p : shifted;
          });
        }
      } else if (bandCtx?.bassRegister === "mid") {
        const lowestPitch = Math.min(...finalPitches);
        if (lowestPitch < 55 && lowestPitch + 12 <= getPianoHigh()) {
          finalPitches = finalPitches.map(p => p + 12);
        }
      }
      const n: CompNote = {
        pitches: [...finalPitches],
        time: Math.max(0, humanizeTime(time, humanize, style, rawBeatOffset) + rubatoOffset(style ?? "swing", rawBeatOffset, beatsPerBar, _pianoArc)),
        duration: duration * 0.95,
        velocity: humanizeVelocity(baseVel, humanize),
      };
      _noteBeat.set(n, rawBeatOffset);
      notes.push(n);
    }
  }

  const broken = applyBrokenVoicings(notes, style, beatDuration);

  // Grace notes: alfaMist always, others based on creativity
  const graceProb = style === "alfaMist" ? 0.20
    : style === "holdsworth" ? creativity * 0.12
    : style === "metheny" ? creativity * 0.08
    : style === "neoSoul" ? creativity * 0.15
    : creativity > 0.5 ? creativity * 0.10
    : 0;
  const graced = graceProb > 0 ? applyGraceNotes(broken, graceProb) : broken;

  graced.sort((a, b) => a.time - b.time);
  return doStrum ? strumSpread(graced, strumMs) : graced;
  } finally {
    _rng = prevRng;
    _pianoGranular = prevGranular;
    _pianoEnergy = prevEnergy;
    _pianoArc = prevArc;
  }
}

// ── Phrase Intent Lookup (piano-side) ──
function getPhraseIntentForMeasure(measure: number, phraseMap: { boundaries: number[]; intents?: Array<{ pianoRests: number[]; dropMeasures: number[]; conversationLeader: string | null; crescendo: boolean; anticipationChance: number; passingChordChance: number; motifLockBars: number; arc: string; feel?: string }> }): { pianoRests: number[]; dropMeasures: number[]; conversationLeader: string | null; crescendo: boolean; anticipationChance: number; passingChordChance: number; motifLockBars: number; arc: string; feel?: string } | null {
  if (!phraseMap.intents || phraseMap.intents.length === 0) return null;
  for (let i = phraseMap.boundaries.length - 1; i >= 0; i--) {
    if (measure >= phraseMap.boundaries[i]) {
      return phraseMap.intents[i] ?? null;
    }
  }
  return null;
}

// ── Chromatic Approach Root ──
// Returns root name a half-step above or below target root.
function chromaticApproachRoot(targetRoot: string, fromAbove: boolean): string {
  const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const idx = ROOTS.indexOf(targetRoot);
  if (idx < 0) return targetRoot;
  const offset = fromAbove ? 1 : -1;
  return ROOTS[(idx + offset + 12) % 12];
}

/**
 * Add grace notes: quick half-step-below approach before a chord note.
 * Targets inner voicing tones (3rd/7th position) — not all notes.
 * Grace = single pitch ~30ms before main note, low velocity.
 */
function applyGraceNotes(notes: CompNote[], probability: number): CompNote[] {
  const result: CompNote[] = [];
  for (const note of notes) {
    if (note.pitches.length < 3 || _rng() >= probability) {
      result.push(note);
      continue;
    }
    // Pick an inner tone (not lowest, not highest) to approach from below
    const sorted = [...note.pitches].sort((a, b) => a - b);
    const innerIdx = 1 + Math.floor(_rng() * (sorted.length - 2));
    const target = sorted[innerIdx];
    const gracePitch = target - 1; // half-step below

    if (gracePitch >= getPianoLow() && note.time >= 0.030) {
      // Insert grace note 30ms before main note (skip if too close to time 0)
      result.push({
        pitches: [gracePitch],
        time: note.time - 0.030,
        duration: 0.025,
        velocity: Math.max(40, note.velocity - 15),
      });
    }
    result.push(note);
  }
  return result;
}
