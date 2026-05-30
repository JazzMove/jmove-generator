/**
 * Jam Session Generator — random chord progressions per genre.
 *
 * Produces a valid QuantizedScore with populated chords (no melody notes),
 * which feeds directly into walkingBass, pianoComping, and drumPatterns
 * generators via the existing PracticeEngine pipeline.
 *
 * Forms: blues12, rhythm32, aaba32, modal16, turnaround8, abac32, songForm24,
 *        rondo20, clave16, minorBlues12, secondLine16, coltraneMatrix16,
 *        throughComposed12, pentatonic8, quartal16, free
 *
 * Time signatures: 4/4, 3/4, 5/4, 6/4, 7/4, 6/8, 7/8, 9/8, 11/8
 */

import type { QuantizedScore, QuantizedMeasure, PracticeStyle, JamKey, JamForm, JamConfig, SongSectionType, SongSection, JamResult } from "./types";

export type { JamKey, JamForm, JamConfig, SongSectionType, SongSection, JamResult };

// ── Constants ──

export const ALL_KEYS: JamKey[] = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];

export const FORM_LABELS: Record<JamForm, string> = {
  blues12: "12-Bar Blues",
  rhythm32: "Rhythm Changes",
  aaba32: "AABA Standard",
  modal16: "Modal Vamp",
  turnaround8: "Turnaround",
  abac32: "ABAC Form",
  songForm24: "Song Form",
  rondo20: "Rondo",
  clave16: "Clave Montuno",
  minorBlues12: "Minor Blues",
  secondLine16: "Second Line",
  coltraneMatrix16: "Coltrane Matrix",
  throughComposed12: "Through-Composed",
  pentatonic8: "Pentatonic Vamp",
  quartal16: "Quartal Harmony",
  fullSong: "Full Song",
  free: "Free Form",
};

/** Measure count for each non-free form */
export const FORM_MEASURE_COUNTS: Record<Exclude<JamForm, "free" | "fullSong">, number> = {
  blues12: 12,
  rhythm32: 32,
  aaba32: 32,
  modal16: 16,
  turnaround8: 8,
  abac32: 32,
  songForm24: 24,
  rondo20: 20,
  clave16: 16,
  minorBlues12: 12,
  secondLine16: 16,
  coltraneMatrix16: 16,
  throughComposed12: 12,
  pentatonic8: 8,
  quartal16: 16,
};

/** All supported time signatures, grouped for UI */
export const TIME_SIGNATURE_GROUPS: Record<string, [number, number][]> = {
  "Standard": [[4, 4], [3, 4]],
  "Compound": [[6, 8], [9, 8], [6, 4]],
  "Odd": [[5, 4], [7, 4], [7, 8], [11, 8]],
};

export const ALL_TIME_SIGNATURES: [number, number][] = [
  [4, 4], [3, 4], [5, 4], [6, 4], [7, 4], [6, 8], [7, 8], [9, 8], [11, 8],
];

const ROOT_SEMITONES: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
  "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8,
  "A": 9, "A#": 10, "Bb": 10, "B": 11,
};

// Flat preference for jazz
const SEMITONE_TO_ROOT: string[] = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];

// ── Transposition ──

function transposeRoot(root: string, semitones: number): string {
  const base = ROOT_SEMITONES[root];
  if (base === undefined) return root;
  return SEMITONE_TO_ROOT[(base + semitones + 12) % 12];
}

type Chord = { root: string; quality: string };

export function transposeProgression(
  chords: Chord[],
  fromKey: JamKey,
  toKey: JamKey,
): Chord[] {
  const interval = (ROOT_SEMITONES[toKey] - ROOT_SEMITONES[fromKey] + 12) % 12;
  if (interval === 0) return chords.map(c => ({ ...c }));
  return chords.map(c => ({ root: transposeRoot(c.root, interval), quality: c.quality }));
}

// ── Chord Progression Templates ──
// All defined in key of C (or natural key), transposed at runtime.

const BLUES_12: Chord[][] = [
  // 1. Jazz blues with extensions (Wes Montgomery style)
  [
    { root: "C", quality: "9" }, { root: "F", quality: "9" }, { root: "C", quality: "9" }, { root: "C", quality: "13" },
    { root: "F", quality: "9" }, { root: "F", quality: "13" }, { root: "C", quality: "9" }, { root: "A", quality: "7b9" },
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "9" }, { root: "G", quality: "7b13" },
  ],
  // 2. Bird blues (bebop substitutions + #IVdim7 passing)
  [
    { root: "C", quality: "maj9" }, { root: "Bb", quality: "13" }, { root: "C", quality: "9" }, { root: "F", quality: "m9" },
    { root: "F", quality: "9" }, { root: "Gb", quality: "dim7" }, { root: "C", quality: "9" }, { root: "A", quality: "7b9b13" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7alt" }, { root: "E", quality: "m9" }, { root: "D", quality: "m7" },
  ],
  // 3. Grant Green blues (9ths, 13sus approach)
  [
    { root: "C", quality: "9" }, { root: "F", quality: "9" }, { root: "C", quality: "9" }, { root: "C", quality: "13" },
    { root: "F", quality: "9" }, { root: "F", quality: "13" }, { root: "C", quality: "9" }, { root: "A", quality: "7#9" },
    { root: "D", quality: "m11" }, { root: "G", quality: "13sus4" }, { root: "C", quality: "9" }, { root: "G", quality: "7#9" },
  ],
  // 4. Slow blues with chromatic passing (rich voicings)
  [
    { root: "C", quality: "9" }, { root: "F", quality: "13" }, { root: "C", quality: "9" }, { root: "D", quality: "m9" },
    { root: "F", quality: "9" }, { root: "Gb", quality: "dim7" }, { root: "C", quality: "13" }, { root: "A", quality: "7b9" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7alt" }, { root: "C", quality: "maj9" }, { root: "D", quality: "m9" },
  ],
  // 5. Steely Dan blues (lydian dom + altered tensions)
  [
    { root: "C", quality: "9" }, { root: "F", quality: "7#11" }, { root: "C", quality: "13" }, { root: "C", quality: "9" },
    { root: "F", quality: "7#11" }, { root: "F", quality: "13" }, { root: "C", quality: "9" }, { root: "A", quality: "7#9b13" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7b9#11" }, { root: "C", quality: "69" }, { root: "G", quality: "7alt" },
  ],
];

const RHYTHM_32: Chord[][] = [
  // 1. Classic rhythm changes (with extensions)
  [
    // A1
    { root: "C", quality: "69" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "E", quality: "m9" }, { root: "A", quality: "13" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    // A2
    { root: "C", quality: "69" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "E", quality: "m9" }, { root: "A", quality: "13" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    // B (secondary dominants with 9ths)
    { root: "E", quality: "9" }, { root: "E", quality: "9" }, { root: "A", quality: "9" }, { root: "A", quality: "9" },
    { root: "D", quality: "9" }, { root: "D", quality: "9" }, { root: "G", quality: "13" }, { root: "G", quality: "7b9" },
    // A3
    { root: "C", quality: "69" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "E", quality: "m9" }, { root: "A", quality: "7alt" }, { root: "D", quality: "m9" }, { root: "C", quality: "69" },
  ],
  // 2. Rhythm changes with Coltrane bridge (rich harmony)
  [
    // A1
    { root: "C", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "C", quality: "maj9" }, { root: "A", quality: "7b9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    // A2
    { root: "C", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "C", quality: "maj9" }, { root: "A", quality: "7b9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    // B (Coltrane changes — 7#5 approach chords)
    { root: "C", quality: "maj7" }, { root: "Eb", quality: "7#5" }, { root: "Ab", quality: "maj9" }, { root: "B", quality: "7#5" },
    { root: "E", quality: "maj9" }, { root: "G", quality: "7#5" }, { root: "C", quality: "maj9" }, { root: "G", quality: "7alt" },
    // A3
    { root: "C", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "E", quality: "m9" }, { root: "A", quality: "7alt" }, { root: "D", quality: "m9" }, { root: "C", quality: "69" },
  ],
];

const AABA_32: Chord[][] = [
  // 1. Satin Doll shape (lydian colors + extensions)
  [
    // A1
    { root: "C", quality: "maj9" }, { root: "C", quality: "69" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
    // A2
    { root: "C", quality: "maj9" }, { root: "C", quality: "69" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
    // B (IV region — lydian IV, borrowed iv)
    { root: "F", quality: "maj7#11" }, { root: "F", quality: "maj9" }, { root: "F", quality: "m9" }, { root: "Bb", quality: "13" },
    { root: "C", quality: "maj9" }, { root: "C", quality: "69" }, { root: "D", quality: "m9" }, { root: "G", quality: "7alt" },
    // A3
    { root: "C", quality: "maj9" }, { root: "C", quality: "69" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7b9" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
  // 2. Minor key AABA (m9 + m(maj7) chromatic inner voice)
  [
    // A1
    { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" },
    { root: "C", quality: "m9" }, { root: "C", quality: "m6" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9" },
    // A2
    { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" },
    { root: "C", quality: "m9" }, { root: "C", quality: "m6" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9" },
    // B (relative major — lydian)
    { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7#11" }, { root: "Ab", quality: "maj9" }, { root: "Ab", quality: "maj7" },
    { root: "D", quality: "m7b5" }, { root: "G", quality: "7alt" }, { root: "C", quality: "m9" }, { root: "C", quality: "m6" },
    // A3
    { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" },
    { root: "C", quality: "m9" }, { root: "F", quality: "m9" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7alt" },
  ],
  // 3. All The Things shape (descending ii-V + aug approach)
  [
    // A1
    { root: "F", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "maj7#11" },
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "maj9" }, { root: "C", quality: "maj7" },
    // A2
    { root: "F", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "maj7#11" },
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "maj9" }, { root: "C", quality: "maj7" },
    // B
    { root: "A", quality: "m9" }, { root: "D", quality: "9" }, { root: "G", quality: "maj9" }, { root: "G", quality: "maj7" },
    { root: "Gb", quality: "m9" }, { root: "B", quality: "9" }, { root: "E", quality: "maj9" }, { root: "G", quality: "7#5" },
    // A3 (altered turnaround ending)
    { root: "F", quality: "m9" }, { root: "Bb", quality: "7alt" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "maj7#11" },
    { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
  // 4. Wayne Shorter AABA (maj7#5 + chromatic mediants)
  [
    // A1
    { root: "C", quality: "maj7#5" }, { root: "C", quality: "maj7" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "maj7#11" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7#9" }, { root: "C", quality: "maj9" }, { root: "C", quality: "maj7#5" },
    // A2
    { root: "C", quality: "maj7#5" }, { root: "C", quality: "maj7" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "maj7#11" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7#9" }, { root: "C", quality: "maj9" }, { root: "C", quality: "maj7#5" },
    // B (remote key — augmented approach)
    { root: "E", quality: "maj7#11" }, { root: "E", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "D", quality: "7#5" },
    { root: "G", quality: "maj9" }, { root: "G", quality: "aug" }, { root: "D", quality: "m9" }, { root: "G", quality: "7alt" },
    // A3
    { root: "C", quality: "maj7#5" }, { root: "C", quality: "maj7" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "maj7#11" },
    { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9#11" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
];

const MODAL_16: Chord[][] = [
  // 1. Dorian vamp (So What — m11 color on held chords)
  [
    { root: "D", quality: "m11" }, { root: "D", quality: "m9" }, { root: "D", quality: "m11" }, { root: "D", quality: "m9" },
    { root: "D", quality: "m11" }, { root: "D", quality: "m9" }, { root: "D", quality: "m11" }, { root: "D", quality: "m9" },
    { root: "Eb", quality: "m11" }, { root: "Eb", quality: "m9" }, { root: "Eb", quality: "m11" }, { root: "Eb", quality: "m9" },
    { root: "D", quality: "m11" }, { root: "D", quality: "m9" }, { root: "D", quality: "m11" }, { root: "D", quality: "m9" },
  ],
  // 2. Maiden Voyage shape (9sus4 for open quartal sound)
  [
    { root: "D", quality: "9sus4" }, { root: "D", quality: "7sus" }, { root: "D", quality: "9sus4" }, { root: "D", quality: "7sus" },
    { root: "F", quality: "9sus4" }, { root: "F", quality: "7sus" }, { root: "F", quality: "9sus4" }, { root: "F", quality: "7sus" },
    { root: "Eb", quality: "9sus4" }, { root: "Eb", quality: "7sus" }, { root: "Eb", quality: "9sus4" }, { root: "Eb", quality: "7sus" },
    { root: "Db", quality: "9sus4" }, { root: "Db", quality: "7sus" }, { root: "D", quality: "9sus4" }, { root: "D", quality: "7sus" },
  ],
  // 3. Footprints shape (m(maj7) chromatic descent on pedal)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" }, { root: "C", quality: "m9" }, { root: "C", quality: "m6" },
    { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" }, { root: "Db", quality: "maj7#11" }, { root: "Db", quality: "maj9" },
    { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" }, { root: "C", quality: "m9" }, { root: "C", quality: "m6" },
    { root: "Ab", quality: "9" }, { root: "Ab", quality: "7#11" }, { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" },
  ],
  // 4. Herbie Hancock lydian modal (maj7#11 colors)
  [
    { root: "C", quality: "maj7#11" }, { root: "C", quality: "maj9" }, { root: "C", quality: "maj7#11" }, { root: "C", quality: "maj9" },
    { root: "D", quality: "maj7#11" }, { root: "D", quality: "maj9" }, { root: "D", quality: "maj7#11" }, { root: "D", quality: "maj9" },
    { root: "Eb", quality: "maj7#11" }, { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7#11" }, { root: "Eb", quality: "maj9" },
    { root: "D", quality: "maj7#11" }, { root: "D", quality: "maj9" }, { root: "C", quality: "maj7#11" }, { root: "C", quality: "maj9" },
  ],
];

const TURNAROUND_8: Chord[][] = [
  // 1. Classic ii-V-I with rich extensions
  [
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
    { root: "F", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Eb", quality: "maj9" }, { root: "D", quality: "m9" },
  ],
  // 2. Coltrane cycle (7#5 approach for augmented tension)
  [
    { root: "C", quality: "maj9" }, { root: "Eb", quality: "7#5" }, { root: "Ab", quality: "maj9" }, { root: "B", quality: "7#5" },
    { root: "E", quality: "maj9" }, { root: "G", quality: "7#5" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
  // 3. Backdoor ii-V (tritone subs + altered dom)
  [
    { root: "D", quality: "m9" }, { root: "Db", quality: "9" }, { root: "C", quality: "maj9" }, { root: "A", quality: "7b9b13" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7#9b13" }, { root: "C", quality: "maj9" }, { root: "Bb", quality: "13" },
  ],
  // 4. Chromatic planing (ECM — lydian colors)
  [
    { root: "C", quality: "maj7#11" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "maj7#11" }, { root: "Db", quality: "maj9" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7alt" }, { root: "C", quality: "maj9" }, { root: "C", quality: "maj7#11" },
  ],
  // 5. Upper structure turnaround (7#9 → maj7#11 resolution)
  [
    { root: "D", quality: "m11" }, { root: "G", quality: "7#9" }, { root: "C", quality: "maj7#11" }, { root: "A", quality: "7alt" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7b9#11" }, { root: "C", quality: "69" }, { root: "C", quality: "maj9" },
  ],
];

// ── NEW FORMS ──

// ABAC 32-bar (Stella, My Funny Valentine shape — B section contrasts, C is new ending)
const ABAC_32: Chord[][] = [
  // 1. Stella By Starlight shape (rich extensions)
  [
    // A
    { root: "E", quality: "m7b5" }, { root: "A", quality: "7b9b13" }, { root: "C", quality: "m9" }, { root: "F", quality: "9" },
    { root: "F", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "7#11" },
    // B
    { root: "C", quality: "maj9" }, { root: "C", quality: "69" }, { root: "A", quality: "m9" }, { root: "D", quality: "9" },
    { root: "G", quality: "maj9" }, { root: "G", quality: "69" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    // A
    { root: "E", quality: "m7b5" }, { root: "A", quality: "7b9b13" }, { root: "C", quality: "m9" }, { root: "F", quality: "9" },
    { root: "F", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "7#11" },
    // C (altered ending)
    { root: "D", quality: "m7b5" }, { root: "G", quality: "7alt" }, { root: "C", quality: "m9" }, { root: "C", quality: "m6" },
    { root: "Ab", quality: "maj7#11" }, { root: "G", quality: "7#9b13" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
  // 2. My Funny Valentine shape (m(maj7) → m7 → m6 chromatic descent)
  [
    // A
    { root: "C", quality: "m(maj7)" }, { root: "C", quality: "m7" }, { root: "C", quality: "m6" }, { root: "C", quality: "m9" },
    { root: "Ab", quality: "maj9" }, { root: "F", quality: "m9" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" },
    // B
    { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7#11" }, { root: "F", quality: "m9" }, { root: "Bb", quality: "13" },
    { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "9" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7alt" },
    // A
    { root: "C", quality: "m(maj7)" }, { root: "C", quality: "m7" }, { root: "C", quality: "m6" }, { root: "C", quality: "m9" },
    { root: "Ab", quality: "maj9" }, { root: "F", quality: "m9" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" },
    // C (climax — aug approach into resolution)
    { root: "Eb", quality: "maj9" }, { root: "F", quality: "m9" }, { root: "Bb", quality: "7alt" }, { root: "Eb", quality: "maj7#11" },
    { root: "Ab", quality: "maj9" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9" }, { root: "C", quality: "m(maj7)" },
  ],
];

// Song Form 24-bar ABA' (verse-chorus-verse with variation — pop-jazz)
const SONG_FORM_24: Chord[][] = [
  // 1. Pop-jazz major (Steely Dan — lydian + chromatic mediants)
  [
    // A — verse
    { root: "C", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "F", quality: "maj7#11" }, { root: "G", quality: "13" },
    { root: "E", quality: "m9" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    // B — chorus (chromatic mediants + borrowed chords)
    { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "maj7#11" }, { root: "D", quality: "m9" }, { root: "G", quality: "7alt" },
    { root: "C", quality: "maj9" }, { root: "F", quality: "maj7#11" }, { root: "D", quality: "m9" }, { root: "G", quality: "7#9" },
    // A' — chromatic ending
    { root: "C", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "F", quality: "maj7#11" }, { root: "G", quality: "13" },
    { root: "Ab", quality: "maj9" }, { root: "Db", quality: "9" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
  // 2. Minor modal song form (m9 + altered doms)
  [
    // A
    { root: "C", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Ab", quality: "maj9" }, { root: "G", quality: "7b9b13" },
    { root: "C", quality: "m9" }, { root: "F", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Eb", quality: "maj9" },
    // B
    { root: "Ab", quality: "maj7#11" }, { root: "Db", quality: "9" }, { root: "G", quality: "m9" }, { root: "C", quality: "9" },
    { root: "F", quality: "m9" }, { root: "Bb", quality: "7alt" }, { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" },
    // A'
    { root: "C", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Ab", quality: "maj9" }, { root: "G", quality: "7alt" },
    { root: "F", quality: "m9" }, { root: "Db", quality: "9" }, { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" },
  ],
];

// Rondo 20-bar ABACA
const RONDO_20: Chord[][] = [
  // 1. Classical-jazz rondo (extended voicings)
  [
    // A (refrain)
    { root: "C", quality: "maj9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "69" },
    // B (episode 1: relative minor + secondary dom)
    { root: "A", quality: "m9" }, { root: "D", quality: "9" }, { root: "G", quality: "maj9" }, { root: "E", quality: "7#9" },
    // A
    { root: "C", quality: "maj9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "69" },
    // C (episode 2: remote key — lydian)
    { root: "Eb", quality: "maj7#11" }, { root: "Ab", quality: "9" }, { root: "Db", quality: "maj9" }, { root: "G", quality: "7alt" },
    // A (final — resolved to 69)
    { root: "C", quality: "maj9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "69" },
  ],
  // 2. Rondo with tritone excursions (aug + altered tensions)
  [
    // A
    { root: "C", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    // B (up minor 3rd — augmented approach)
    { root: "Eb", quality: "m9" }, { root: "Ab", quality: "7#5" }, { root: "Db", quality: "maj9" }, { root: "Bb", quality: "7alt" },
    // A
    { root: "C", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    // C (tritone away — lydian dom)
    { root: "Gb", quality: "maj7#11" }, { root: "Eb", quality: "m9" }, { root: "Ab", quality: "7#11" }, { root: "Db", quality: "13" },
    // A
    { root: "C", quality: "maj9" }, { root: "A", quality: "m9" }, { root: "D", quality: "m9" }, { root: "C", quality: "69" },
  ],
];

// Clave-based montuno 16-bar (Afro-Cuban song form)
const CLAVE_16: Chord[][] = [
  // 1. Son montuno with 9ths (traditional + extensions)
  [
    { root: "C", quality: "9" }, { root: "C", quality: "13" }, { root: "F", quality: "9" }, { root: "F", quality: "13" },
    { root: "G", quality: "9" }, { root: "G", quality: "13" }, { root: "F", quality: "9" }, { root: "C", quality: "9" },
    { root: "C", quality: "9" }, { root: "C", quality: "13" }, { root: "F", quality: "9" }, { root: "F", quality: "13" },
    { root: "G", quality: "13" }, { root: "F", quality: "9" }, { root: "C", quality: "9" }, { root: "C", quality: "13" },
  ],
  // 2. Guajira (Latin jazz — 9ths + lydian dom)
  [
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "9" }, { root: "F", quality: "maj9" },
    { root: "F", quality: "m9" }, { root: "Bb", quality: "13" }, { root: "Eb", quality: "maj9" }, { root: "Ab", quality: "7#11" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7alt" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
  // 3. Afro-Cuban minor (m9 + altered approach)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" }, { root: "Ab", quality: "9" }, { root: "G", quality: "7b9b13" },
    { root: "C", quality: "m9" }, { root: "C", quality: "m6" }, { root: "F", quality: "m9" }, { root: "G", quality: "7#9" },
    { root: "C", quality: "m9" }, { root: "Eb", quality: "9" }, { root: "Ab", quality: "maj9" }, { root: "G", quality: "7alt" },
    { root: "C", quality: "m9" }, { root: "F", quality: "m9" }, { root: "G", quality: "7b9" }, { root: "C", quality: "m(maj7)" },
  ],
];

// Minor Blues 12-bar with jazz extensions
const MINOR_BLUES_12: Chord[][] = [
  // 1. Mr. PC (m9 + altered turnaround)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m11" }, { root: "C", quality: "m9" }, { root: "C", quality: "m6" },
    { root: "F", quality: "m9" }, { root: "F", quality: "m11" }, { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" },
    { root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" }, { root: "C", quality: "m9" }, { root: "G", quality: "7alt" },
  ],
  // 2. Equinox shape (backdoor + dim passing)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m6" }, { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" },
    { root: "F", quality: "m9" }, { root: "Gb", quality: "dim7" }, { root: "C", quality: "m9" }, { root: "Ab", quality: "9" },
    { root: "Bb", quality: "m9" }, { root: "Eb", quality: "7#9" }, { root: "C", quality: "m9" }, { root: "G", quality: "7b9b13" },
  ],
  // 3. Chromatic minor blues (tritone subs + altered)
  [
    { root: "C", quality: "m9" }, { root: "F", quality: "9" }, { root: "C", quality: "m9" }, { root: "Gb", quality: "9" },
    { root: "F", quality: "m9" }, { root: "Bb", quality: "7#9" }, { root: "C", quality: "m9" }, { root: "A", quality: "7b9b13" },
    { root: "D", quality: "m7b5" }, { root: "G", quality: "7#9b13" }, { root: "C", quality: "m(maj7)" }, { root: "D", quality: "m7b5" },
  ],
];

// Second Line 16-bar (New Orleans style)
const SECOND_LINE_16: Chord[][] = [
  // 1. Traditional second line (9ths + gospel dim passing)
  [
    { root: "C", quality: "9" }, { root: "C", quality: "13" }, { root: "C", quality: "9" }, { root: "C", quality: "13" },
    { root: "F", quality: "9" }, { root: "Gb", quality: "dim7" }, { root: "C", quality: "9" }, { root: "C", quality: "13" },
    { root: "G", quality: "9" }, { root: "F", quality: "13" }, { root: "C", quality: "9" }, { root: "G", quality: "13" },
    { root: "C", quality: "9" }, { root: "F", quality: "9" }, { root: "C", quality: "69" }, { root: "G", quality: "13" },
  ],
  // 2. Modern second line (Marsalis — 9ths + altered doms)
  [
    { root: "C", quality: "maj9" }, { root: "A", quality: "7b9" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" },
    { root: "C", quality: "9" }, { root: "C", quality: "13" }, { root: "F", quality: "9" }, { root: "F", quality: "13" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7#9" }, { root: "E", quality: "m9" }, { root: "A", quality: "7alt" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7alt" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
];

// Coltrane Matrix 16-bar (major 3rds axis system)
const COLTRANE_MATRIX_16: Chord[][] = [
  // 1. Full axis with ii-V 9ths (C-Ab-E cycle)
  [
    { root: "D", quality: "m9" }, { root: "G", quality: "7#5" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
    { root: "Bb", quality: "m9" }, { root: "Eb", quality: "7#5" }, { root: "Ab", quality: "maj9" }, { root: "Ab", quality: "69" },
    { root: "Gb", quality: "m9" }, { root: "B", quality: "7#5" }, { root: "E", quality: "maj9" }, { root: "E", quality: "69" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7alt" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
  // 2. Countdown axis (fast cycle — 7#5 approach)
  [
    { root: "C", quality: "maj9" }, { root: "Eb", quality: "7#5" }, { root: "Ab", quality: "maj9" }, { root: "B", quality: "7#5" },
    { root: "E", quality: "maj9" }, { root: "G", quality: "7#5" }, { root: "C", quality: "maj9" }, { root: "Eb", quality: "7#5" },
    { root: "Ab", quality: "maj9" }, { root: "B", quality: "7#5" }, { root: "E", quality: "maj9" }, { root: "G", quality: "7#5" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7alt" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
  // 3. Giant Steps with lydian targets (maj7#11 on resolutions)
  [
    { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "maj7#11" }, { root: "Eb", quality: "7#5" },
    { root: "Bb", quality: "m9" }, { root: "Eb", quality: "13" }, { root: "Ab", quality: "maj7#11" }, { root: "B", quality: "7#5" },
    { root: "Gb", quality: "m9" }, { root: "B", quality: "13" }, { root: "E", quality: "maj7#11" }, { root: "G", quality: "7#5" },
    { root: "D", quality: "m9" }, { root: "G", quality: "7b9#11" }, { root: "C", quality: "maj9" }, { root: "C", quality: "69" },
  ],
];

// Through-Composed 12-bar (no repeats, every measure different region)
const THROUGH_COMPOSED_12: Chord[][] = [
  // 1. Wayne Shorter chromatic journey (maj7#5 + altered doms)
  [
    { root: "C", quality: "maj7#5" }, { root: "Db", quality: "maj7#11" }, { root: "B", quality: "m9" }, { root: "E", quality: "7#9" },
    { root: "A", quality: "maj9" }, { root: "Ab", quality: "m9" }, { root: "Gb", quality: "maj7#11" }, { root: "F", quality: "7#9b13" },
    { root: "Bb", quality: "m9" }, { root: "Eb", quality: "7alt" }, { root: "D", quality: "m9" }, { root: "C", quality: "maj7#5" },
  ],
  // 2. Kenny Wheeler shape (9sus4 + lydian interplay)
  [
    { root: "C", quality: "9sus4" }, { root: "Eb", quality: "maj9" }, { root: "D", quality: "9sus4" }, { root: "F", quality: "m9" },
    { root: "E", quality: "9sus4" }, { root: "Ab", quality: "maj7#11" }, { root: "G", quality: "9sus4" }, { root: "Bb", quality: "maj9" },
    { root: "A", quality: "13sus4" }, { root: "Db", quality: "maj7#11" }, { root: "D", quality: "m9" }, { root: "C", quality: "maj9" },
  ],
  // 3. Symmetric diminished interpolation (with 7b5 + aug)
  [
    { root: "C", quality: "maj9" }, { root: "Eb", quality: "7b5" }, { root: "D", quality: "m9" }, { root: "Gb", quality: "7b5" },
    { root: "F", quality: "maj9" }, { root: "A", quality: "7#5" }, { root: "Ab", quality: "m9" }, { root: "C", quality: "7#5" },
    { root: "Bb", quality: "m9" }, { root: "D", quality: "7b5" }, { root: "Db", quality: "maj7#11" }, { root: "C", quality: "maj9" },
  ],
];

// Pentatonic 8-bar vamp
const PENTATONIC_8: Chord[][] = [
  // 1. Nefertiti shape (9sus4 + quartal)
  [
    { root: "D", quality: "9sus4" }, { root: "D", quality: "13sus4" }, { root: "Eb", quality: "9sus4" }, { root: "Eb", quality: "13sus4" },
    { root: "D", quality: "9sus4" }, { root: "D", quality: "13sus4" }, { root: "D", quality: "9sus4" }, { root: "D", quality: "7sus" },
  ],
  // 2. Power chord vamp (rock-jazz)
  [
    { root: "C", quality: "5" }, { root: "Bb", quality: "5" }, { root: "Ab", quality: "5" }, { root: "Bb", quality: "5" },
    { root: "C", quality: "5" }, { root: "Eb", quality: "5" }, { root: "Bb", quality: "5" }, { root: "C", quality: "5" },
  ],
  // 3. Minor pentatonic (m9 + m6 color)
  [
    { root: "C", quality: "m9" }, { root: "Eb", quality: "maj9" }, { root: "F", quality: "9" }, { root: "C", quality: "m6" },
    { root: "Bb", quality: "9" }, { root: "Ab", quality: "maj9" }, { root: "G", quality: "7#9" }, { root: "C", quality: "m9" },
  ],
];

// Quartal 16-bar (Herbie Hancock / post-bop quartal harmony)
const QUARTAL_16: Chord[][] = [
  // 1. Maiden Voyage shape (9sus4 + 13sus4 alternation)
  [
    { root: "D", quality: "9sus4" }, { root: "D", quality: "13sus4" }, { root: "D", quality: "9sus4" }, { root: "D", quality: "7sus" },
    { root: "F", quality: "9sus4" }, { root: "F", quality: "13sus4" }, { root: "F", quality: "9sus4" }, { root: "F", quality: "7sus" },
    { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "13sus4" }, { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "7sus" },
    { root: "Db", quality: "9sus4" }, { root: "Db", quality: "7sus" }, { root: "D", quality: "9sus4" }, { root: "D", quality: "13sus4" },
  ],
  // 2. Quartal planing (chromatic + sus2 variation)
  [
    { root: "C", quality: "9sus4" }, { root: "Db", quality: "sus2" }, { root: "D", quality: "9sus4" }, { root: "Eb", quality: "sus2" },
    { root: "E", quality: "9sus4" }, { root: "F", quality: "sus2" }, { root: "Gb", quality: "9sus4" }, { root: "G", quality: "sus2" },
    { root: "Ab", quality: "9sus4" }, { root: "A", quality: "sus2" }, { root: "Bb", quality: "9sus4" }, { root: "B", quality: "sus2" },
    { root: "C", quality: "9sus4" }, { root: "D", quality: "m9" }, { root: "G", quality: "13" }, { root: "C", quality: "9sus4" },
  ],
  // 3. Speak No Evil shape (m9 / sus alternation)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m11" }, { root: "Db", quality: "9sus4" }, { root: "Db", quality: "13sus4" },
    { root: "C", quality: "m9" }, { root: "C", quality: "m6" }, { root: "Eb", quality: "9sus4" }, { root: "Eb", quality: "13sus4" },
    { root: "D", quality: "m9" }, { root: "D", quality: "m11" }, { root: "Eb", quality: "9sus4" }, { root: "Eb", quality: "13sus4" },
    { root: "Db", quality: "9sus4" }, { root: "Db", quality: "13sus4" }, { root: "C", quality: "m9" }, { root: "C", quality: "m(maj7)" },
  ],
];

// ── ALFA MIST-SPECIFIC TEMPLATES ──
// Transcribed from Antiphon, Structuralism, Variables albums.
// Characteristic: chromatic mediants, 3-4 chord loops, minor-key bias,
// stepwise voice leading, warm extensions, modal rather than functional.

// Modal 16-bar — adapted from actual Alfa Mist tracks
const ALFA_MIST_MODAL_16: Chord[][] = [
  // 1. "Brian" shape — chromatic mediant root movement (signature dreamy float)
  // Original: Em7 → G#7 → Am7 → Gm7 (root moves by M3, then m2, then m2)
  [
    { root: "C", quality: "m7" }, { root: "C", quality: "m9" }, { root: "E", quality: "7" }, { root: "E", quality: "9" },
    { root: "F", quality: "m7" }, { root: "F", quality: "m9" }, { root: "Eb", quality: "m7" }, { root: "Eb", quality: "m9" },
    { root: "C", quality: "m7" }, { root: "C", quality: "m9" }, { root: "E", quality: "7" }, { root: "E", quality: "9" },
    { root: "F", quality: "m7" }, { root: "F", quality: "m9" }, { root: "Eb", quality: "m7" }, { root: "Eb", quality: "m9" },
  ],
  // 2. ".44" shape — minor with bVI→bIII→bIII majors (warm, open)
  // Original: Gm → Ebmaj7 → Bbmaj7 → Bb (nearly 10 min track)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m7" }, { root: "Ab", quality: "maj7" }, { root: "Ab", quality: "maj9" },
    { root: "Eb", quality: "maj7" }, { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7" }, { root: "C", quality: "m9" },
    { root: "C", quality: "m9" }, { root: "C", quality: "m7" }, { root: "Ab", quality: "maj7" }, { root: "Ab", quality: "maj9" },
    { root: "Eb", quality: "maj7" }, { root: "Eb", quality: "maj9" }, { root: "Bb", quality: "9" }, { root: "C", quality: "m9" },
  ],
  // 3. "Organic Rust" shape — alternating major/minor with chromatic shifts
  // Original: E → A → E → G#m → A → E → C# → A → G#m (key of E)
  [
    { root: "C", quality: "maj7" }, { root: "F", quality: "maj9" }, { root: "C", quality: "maj7" }, { root: "E", quality: "m9" },
    { root: "F", quality: "maj9" }, { root: "C", quality: "maj7" }, { root: "A", quality: "m7" }, { root: "F", quality: "maj9" },
    { root: "E", quality: "m9" }, { root: "C", quality: "maj7" }, { root: "F", quality: "maj9" }, { root: "C", quality: "maj7" },
    { root: "E", quality: "m9" }, { root: "F", quality: "maj9" }, { root: "A", quality: "m7" }, { root: "C", quality: "maj7" },
  ],
  // 4. "Naiyti" shape — deep minor, slow harmonic rhythm (~10 min track, Cm, 81 BPM)
  // Held chords with subtle inner voice movement
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m9" }, { root: "C", quality: "m11" }, { root: "C", quality: "m9" },
    { root: "Ab", quality: "maj9" }, { root: "Ab", quality: "maj7" }, { root: "Bb", quality: "9" }, { root: "Bb", quality: "9" },
    { root: "C", quality: "m9" }, { root: "C", quality: "m9" }, { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7" },
    { root: "F", quality: "m9" }, { root: "Bb", quality: "9" }, { root: "C", quality: "m9" }, { root: "C", quality: "m9" },
  ],
  // 5. Glacial minor — 4 bars per root, quality-only variation (maximally slow harmonic rhythm)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m7" }, { root: "C", quality: "m11" }, { root: "C", quality: "m9" },
    { root: "Ab", quality: "maj7" }, { root: "Ab", quality: "maj9" }, { root: "Ab", quality: "maj7" }, { root: "Ab", quality: "maj9" },
    { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7" }, { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7" },
    { root: "Bb", quality: "9" }, { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "9" }, { root: "C", quality: "m9" },
  ],
  // 6. Chromatic mediant glacial — "Brian" DNA at half harmonic speed
  [
    { root: "C", quality: "m7" }, { root: "C", quality: "m9" }, { root: "C", quality: "m7" }, { root: "C", quality: "m11" },
    { root: "E", quality: "7" }, { root: "E", quality: "9" }, { root: "E", quality: "7" }, { root: "E", quality: "9" },
    { root: "F", quality: "m7" }, { root: "F", quality: "m9" }, { root: "F", quality: "m7" }, { root: "F", quality: "m9" },
    { root: "Eb", quality: "m9" }, { root: "Eb", quality: "m7" }, { root: "Eb", quality: "m9" }, { root: "Eb", quality: "m7" },
  ],
];

// Pentatonic 8-bar — Alfa Mist hypnotic 2-chord vamps, held 2-4 bars each
const ALFA_MIST_PENTATONIC_8: Chord[][] = [
  // 1. "Mulago" shape — Em pedal with Gmaj7 drift (held 4+4)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m9" }, { root: "C", quality: "m11" }, { root: "C", quality: "m9" },
    { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7" }, { root: "Eb", quality: "maj9" },
  ],
  // 2. Hypnotic sus vamp — two sus chords oscillating (2+2+2+2)
  [
    { root: "C", quality: "9sus4" }, { root: "C", quality: "9sus4" }, { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "9sus4" },
    { root: "C", quality: "9sus4" }, { root: "C", quality: "9sus4" }, { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "9sus4" },
  ],
  // 3. Minor with bVI — held 4 bars each (deep, meditative)
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m9" }, { root: "C", quality: "m7" }, { root: "C", quality: "m9" },
    { root: "Ab", quality: "maj7" }, { root: "Ab", quality: "maj9" }, { root: "Ab", quality: "maj7" }, { root: "Ab", quality: "maj9" },
  ],
];

// Quartal 16-bar — Alfa Mist sus4/9sus4 washes, held 4 bars per root
const ALFA_MIST_QUARTAL_16: Chord[][] = [
  // 1. Quartal wash — 4 roots, 4 bars each, quality variation only
  [
    { root: "C", quality: "9sus4" }, { root: "C", quality: "9sus4" }, { root: "C", quality: "13sus4" }, { root: "C", quality: "9sus4" },
    { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "13sus4" }, { root: "Bb", quality: "9sus4" },
    { root: "Ab", quality: "9sus4" }, { root: "Ab", quality: "9sus4" }, { root: "Ab", quality: "13sus4" }, { root: "Ab", quality: "9sus4" },
    { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "13sus4" }, { root: "C", quality: "9sus4" }, { root: "C", quality: "9sus4" },
  ],
  // 2. "Structuralism" vibe — sus/minor cycling, glacial pace
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m9" }, { root: "C", quality: "m11" }, { root: "C", quality: "m9" },
    { root: "F", quality: "9sus4" }, { root: "F", quality: "9sus4" }, { root: "F", quality: "13sus4" }, { root: "F", quality: "9sus4" },
    { root: "Eb", quality: "m9" }, { root: "Eb", quality: "m9" }, { root: "Eb", quality: "m11" }, { root: "Eb", quality: "m9" },
    { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "9sus4" }, { root: "C", quality: "m9" }, { root: "C", quality: "m9" },
  ],
];

// Turnaround 8-bar — Alfa Mist looping patterns
const ALFA_MIST_TURNAROUND_8: Chord[][] = [
  // 1. "Keep On" verse shape — minor with sus/11 color
  // Original: C#m → F#m → AMaj7 → B11 (key of C#m, 103 BPM)
  [
    { root: "C", quality: "m9" }, { root: "F", quality: "m7" }, { root: "Ab", quality: "maj7" }, { root: "Bb", quality: "9sus4" },
    { root: "C", quality: "m9" }, { root: "F", quality: "m9" }, { root: "Ab", quality: "maj9" }, { root: "Bb", quality: "9sus4" },
  ],
  // 2. "Retainer" shape — descending maj7 cycle (warm, hymnal)
  // Original: Abmaj7 → Gbmaj7 → Dbmaj → Abmaj (key of Ab, 83 BPM)
  [
    { root: "C", quality: "maj7" }, { root: "Bb", quality: "maj7" }, { root: "F", quality: "maj9" }, { root: "C", quality: "maj7" },
    { root: "C", quality: "maj9" }, { root: "Bb", quality: "maj9" }, { root: "F", quality: "maj7" }, { root: "C", quality: "maj9" },
  ],
  // 3. "Falling" shape — descending maj7s with relative minor
  // Original: Fmaj7 → Cmaj7 → Bm → Gmaj7 (key of Bm, 125 BPM)
  [
    { root: "Eb", quality: "maj7" }, { root: "Bb", quality: "maj9" }, { root: "C", quality: "m9" }, { root: "Ab", quality: "maj7" },
    { root: "Eb", quality: "maj9" }, { root: "Bb", quality: "maj7" }, { root: "C", quality: "m7" }, { root: "Ab", quality: "maj9" },
  ],
  // 4. "Door" shape — modal cycling (Jordan Rakei collab)
  // Original: C → D → Bb → Am → Dm (key of Dm, 125 BPM)
  [
    { root: "Bb", quality: "maj7" }, { root: "C", quality: "maj9" }, { root: "Ab", quality: "maj7" }, { root: "G", quality: "m7" },
    { root: "C", quality: "m9" }, { root: "Bb", quality: "maj9" }, { root: "Ab", quality: "maj7" }, { root: "C", quality: "m9" },
  ],
];

// AABA 32-bar — Alfa Mist long-form head arrangement
const ALFA_MIST_AABA_32: Chord[][] = [
  // Based on "Keep On" extended + ".44" section contrast
  [
    // A1: Keep On loop
    { root: "C", quality: "m9" }, { root: "F", quality: "m7" }, { root: "Ab", quality: "maj7" }, { root: "Bb", quality: "9sus4" },
    { root: "C", quality: "m9" }, { root: "F", quality: "m9" }, { root: "Ab", quality: "maj9" }, { root: "Bb", quality: "9sus4" },
    // A2
    { root: "C", quality: "m9" }, { root: "F", quality: "m7" }, { root: "Ab", quality: "maj7" }, { root: "Bb", quality: "9sus4" },
    { root: "C", quality: "m9" }, { root: "F", quality: "m9" }, { root: "Ab", quality: "maj9" }, { root: "Bb", quality: "9sus4" },
    // B: chromatic mediant shift (Brian DNA) — lifts to remote key
    { root: "E", quality: "m9" }, { root: "Ab", quality: "7" }, { root: "Bb", quality: "m9" }, { root: "A", quality: "m7" },
    { root: "E", quality: "m9" }, { root: "Ab", quality: "9" }, { root: "Bb", quality: "m7" }, { root: "Bb", quality: "9" },
    // A3: return with variation
    { root: "C", quality: "m9" }, { root: "F", quality: "m9" }, { root: "Ab", quality: "maj7" }, { root: "Bb", quality: "9sus4" },
    { root: "C", quality: "m11" }, { root: "F", quality: "m7" }, { root: "Ab", quality: "maj9" }, { root: "C", quality: "m9" },
  ],
];

// Minor blues 12-bar — Alfa Mist flavor (warm, no altered doms)
const ALFA_MIST_MINOR_BLUES_12: Chord[][] = [
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m11" }, { root: "C", quality: "m9" }, { root: "C", quality: "m7" },
    { root: "F", quality: "m9" }, { root: "F", quality: "m7" }, { root: "C", quality: "m9" }, { root: "C", quality: "m11" },
    { root: "Ab", quality: "maj9" }, { root: "Bb", quality: "9" }, { root: "C", quality: "m9" }, { root: "Bb", quality: "9" },
  ],
  [
    { root: "C", quality: "m9" }, { root: "C", quality: "m9" }, { root: "C", quality: "m7" }, { root: "Eb", quality: "maj9" },
    { root: "F", quality: "m9" }, { root: "F", quality: "m9" }, { root: "C", quality: "m9" }, { root: "Ab", quality: "maj7" },
    { root: "Bb", quality: "9sus4" }, { root: "Bb", quality: "9" }, { root: "C", quality: "m9" }, { root: "Bb", quality: "9sus4" },
  ],
];

// ── PAT METHENY (Bright Size Life) ──
// Lydian dominant, chromatic mediants, open suspended sounds, modal interchange.
// Research: Bright Size Life, Unity Village, Sirabhorn, Missouri Uncompromised.
// Harmonic DNA: maj7#11, 6/9, 9sus4, chromatic mediant (root movement by major 3rds).

// Modal 16-bar — Metheny Lydian vamps and chromatic mediant movement
const METHENY_MODAL_16: Chord[][] = [
  // #1: Bright Size Life shape — D major, Gmaj7→Bbmaj7#11 chromatic mediant
  [
    { root: "D", quality: "maj7" }, { root: "D", quality: "69" }, { root: "G", quality: "maj7" }, { root: "G", quality: "maj7#11" },
    { root: "Bb", quality: "maj7#11" }, { root: "Bb", quality: "maj7#11" }, { root: "D", quality: "69" }, { root: "A", quality: "9sus4" },
    { root: "G", quality: "maj7" }, { root: "G", quality: "maj7#11" }, { root: "Bb", quality: "maj7#11" }, { root: "Bb", quality: "maj9" },
    { root: "D", quality: "maj7" }, { root: "D", quality: "69" }, { root: "A", quality: "9sus4" }, { root: "D", quality: "maj7" },
  ],
  // #2: Missouri Uncompromised — fourths-based, unison melody shape
  [
    { root: "E", quality: "m9" }, { root: "E", quality: "m9" }, { root: "A", quality: "9sus4" }, { root: "A", quality: "9sus4" },
    { root: "D", quality: "maj7#11" }, { root: "D", quality: "maj7#11" }, { root: "G", quality: "maj7" }, { root: "G", quality: "69" },
    { root: "C", quality: "maj7#11" }, { root: "C", quality: "maj7#11" }, { root: "F", quality: "maj7" }, { root: "F", quality: "maj9" },
    { root: "Bb", quality: "maj7#11" }, { root: "A", quality: "9sus4" }, { root: "D", quality: "maj7" }, { root: "D", quality: "69" },
  ],
  // #3: Lydian plateau — single root held, quality-only variation (Metheny harmonic stasis)
  [
    { root: "G", quality: "maj7" }, { root: "G", quality: "maj7#11" }, { root: "G", quality: "69" }, { root: "G", quality: "maj9" },
    { root: "Eb", quality: "maj7#11" }, { root: "Eb", quality: "maj7#11" }, { root: "Eb", quality: "maj9" }, { root: "Eb", quality: "69" },
    { root: "B", quality: "maj7#11" }, { root: "B", quality: "maj7" }, { root: "B", quality: "69" }, { root: "B", quality: "maj9" },
    { root: "G", quality: "maj7#11" }, { root: "G", quality: "69" }, { root: "D", quality: "9sus4" }, { root: "G", quality: "maj7" },
  ],
  // #4: Floating sus — G/A, F/G type slash chord textures (Metheny signature)
  [
    { root: "A", quality: "9sus4" }, { root: "A", quality: "9sus4" }, { root: "D", quality: "maj7#11" }, { root: "D", quality: "maj7#11" },
    { root: "G", quality: "9sus4" }, { root: "G", quality: "13sus4" }, { root: "C", quality: "maj7#11" }, { root: "C", quality: "69" },
    { root: "E", quality: "9sus4" }, { root: "E", quality: "9sus4" }, { root: "A", quality: "maj7#11" }, { root: "A", quality: "69" },
    { root: "D", quality: "9sus4" }, { root: "D", quality: "13sus4" }, { root: "G", quality: "maj7" }, { root: "G", quality: "69" },
  ],
];

// Turnaround 8-bar — Metheny bright turnarounds
const METHENY_TURNAROUND_8: Chord[][] = [
  // #1: Bright Size Life turnaround (D→G→Bb chromatic mediant loop)
  [
    { root: "D", quality: "maj7" }, { root: "G", quality: "maj7#11" },
    { root: "Bb", quality: "maj7#11" }, { root: "A", quality: "9sus4" },
    { root: "D", quality: "69" }, { root: "G", quality: "maj7" },
    { root: "Bb", quality: "maj9" }, { root: "D", quality: "maj7" },
  ],
  // #2: Sirabhorn — descending Lydian cascade
  [
    { root: "E", quality: "maj7#11" }, { root: "D", quality: "maj7#11" },
    { root: "C", quality: "maj7#11" }, { root: "Bb", quality: "maj7#11" },
    { root: "Ab", quality: "maj9" }, { root: "F", quality: "69" },
    { root: "G", quality: "9sus4" }, { root: "G", quality: "maj7" },
  ],
  // #3: Unity Village — angular sevenths
  [
    { root: "C", quality: "maj7" }, { root: "B", quality: "m9" },
    { root: "Bb", quality: "maj7#11" }, { root: "A", quality: "m9" },
    { root: "Ab", quality: "maj7#11" }, { root: "G", quality: "9sus4" },
    { root: "F", quality: "maj9" }, { root: "G", quality: "maj7" },
  ],
  // #4: Midwestern Nights Dream — simple, warm
  [
    { root: "D", quality: "maj7" }, { root: "G", quality: "69" },
    { root: "B", quality: "m9" }, { root: "E", quality: "m9" },
    { root: "D", quality: "69" }, { root: "G", quality: "maj7" },
    { root: "A", quality: "9sus4" }, { root: "D", quality: "maj7" },
  ],
];

// Through-composed 12-bar — Metheny flowing narrative
const METHENY_THROUGH_COMPOSED_12: Chord[][] = [
  // Sirabhorn full shape — descending harmonized scales + Jaco bass counterpoint
  [
    { root: "G", quality: "maj7" }, { root: "G", quality: "maj7#11" }, { root: "F", quality: "maj9" }, { root: "F", quality: "69" },
    { root: "Eb", quality: "maj7#11" }, { root: "D", quality: "m9" }, { root: "C", quality: "maj7#11" }, { root: "C", quality: "69" },
    { root: "Bb", quality: "maj7#11" }, { root: "A", quality: "9sus4" }, { root: "D", quality: "9sus4" }, { root: "G", quality: "maj7" },
  ],
];

// Pentatonic 8-bar — Metheny open vamps
const METHENY_PENTATONIC_8: Chord[][] = [
  // #1: Two-chord Lydian vamp (Metheny delays fill the space)
  [
    { root: "D", quality: "maj7#11" }, { root: "D", quality: "maj7#11" },
    { root: "Bb", quality: "maj7#11" }, { root: "Bb", quality: "maj7#11" },
    { root: "D", quality: "69" }, { root: "D", quality: "69" },
    { root: "Bb", quality: "maj9" }, { root: "A", quality: "9sus4" },
  ],
  // #2: Sus pedal vamp (G/A texture held)
  [
    { root: "A", quality: "9sus4" }, { root: "A", quality: "9sus4" },
    { root: "A", quality: "13sus4" }, { root: "A", quality: "9sus4" },
    { root: "D", quality: "maj7#11" }, { root: "D", quality: "69" },
    { root: "A", quality: "9sus4" }, { root: "A", quality: "9sus4" },
  ],
  // #3: Major thirds cycle (Metheny chromatic mediant)
  [
    { root: "G", quality: "maj7" }, { root: "G", quality: "maj7#11" },
    { root: "Eb", quality: "maj7#11" }, { root: "Eb", quality: "maj9" },
    { root: "B", quality: "maj7#11" }, { root: "B", quality: "69" },
    { root: "G", quality: "maj7" }, { root: "D", quality: "9sus4" },
  ],
];

// Quartal 16-bar — Metheny stacked-fourths harmony
const METHENY_QUARTAL_16: Chord[][] = [
  // Quartal wash with Lydian color — ECM-adjacent spaciousness
  [
    { root: "D", quality: "9sus4" }, { root: "D", quality: "9sus4" }, { root: "D", quality: "13sus4" }, { root: "D", quality: "9sus4" },
    { root: "G", quality: "9sus4" }, { root: "G", quality: "9sus4" }, { root: "G", quality: "13sus4" }, { root: "G", quality: "9sus4" },
    { root: "C", quality: "9sus4" }, { root: "C", quality: "9sus4" }, { root: "C", quality: "13sus4" }, { root: "C", quality: "9sus4" },
    { root: "A", quality: "9sus4" }, { root: "A", quality: "13sus4" }, { root: "D", quality: "9sus4" }, { root: "D", quality: "9sus4" },
  ],
];

// Fragments for free-form stitching (2 measures each)
const FREE_FRAGMENTS: Chord[][] = [
  [{ root: "D", quality: "m9" }, { root: "G", quality: "13" }],
  [{ root: "C", quality: "maj9" }, { root: "C", quality: "69" }],
  [{ root: "A", quality: "m9" }, { root: "D", quality: "7#9" }],
  [{ root: "F", quality: "m9" }, { root: "Bb", quality: "7alt" }],
  [{ root: "D", quality: "m7b5" }, { root: "G", quality: "7b9b13" }],
  [{ root: "E", quality: "m9" }, { root: "A", quality: "7#5" }],
  [{ root: "C", quality: "m9" }, { root: "F", quality: "9" }],
  [{ root: "Ab", quality: "maj7#11" }, { root: "Db", quality: "9" }],
  [{ root: "Eb", quality: "maj9" }, { root: "Eb", quality: "maj7#11" }],
  [{ root: "Bb", quality: "m9" }, { root: "Eb", quality: "7#5" }],
  [{ root: "G", quality: "m9" }, { root: "C", quality: "7alt" }],
  [{ root: "B", quality: "m9" }, { root: "E", quality: "13" }],
  [{ root: "C", quality: "m(maj7)" }, { root: "C", quality: "m6" }],
  [{ root: "F", quality: "maj7#11" }, { root: "G", quality: "7b9#11" }],
  [{ root: "D", quality: "9sus4" }, { root: "G", quality: "13sus4" }],
  [{ root: "Ab", quality: "m9" }, { root: "Db", quality: "7#5" }],
];

// ── Style → Form Affinity ──

const STYLE_FORM_AFFINITY: Record<PracticeStyle, JamForm[]> = {
  swing: ["blues12", "aaba32", "rhythm32", "turnaround8", "abac32", "songForm24", "rondo20", "fullSong"],
  hardBop: ["blues12", "rhythm32", "aaba32", "turnaround8", "minorBlues12", "abac32", "throughComposed12", "fullSong"],
  coolJazz: ["aaba32", "turnaround8", "blues12", "abac32", "songForm24", "rondo20", "fullSong"],
  ballad: ["aaba32", "turnaround8", "blues12", "abac32", "songForm24", "fullSong"],
  bossa: ["aaba32", "turnaround8", "modal16", "songForm24", "clave16", "fullSong"],
  latin: ["blues12", "aaba32", "modal16", "clave16", "secondLine16", "fullSong"],
  funk: ["blues12", "modal16", "turnaround8", "pentatonic8", "songForm24", "fullSong"],
  fusion: ["modal16", "turnaround8", "blues12", "quartal16", "throughComposed12", "coltraneMatrix16", "fullSong"],
  ecm: ["modal16", "turnaround8", "free", "quartal16", "throughComposed12", "fullSong"],
  modal: ["modal16", "turnaround8", "quartal16", "pentatonic8", "fullSong"],
  jazzWaltz: ["blues12", "aaba32", "turnaround8", "abac32", "rondo20", "fullSong"],
  shuffleBlues: ["blues12", "turnaround8", "minorBlues12", "secondLine16", "fullSong"],
  neoSoul: ["modal16", "turnaround8", "blues12", "pentatonic8", "songForm24", "fullSong"],
  contemporaryJazz: ["aaba32", "modal16", "turnaround8", "throughComposed12", "quartal16", "abac32", "fullSong"],
  mathRock: ["modal16", "free", "turnaround8", "throughComposed12", "pentatonic8", "rondo20", "fullSong"],
  idm: ["modal16", "free", "turnaround8", "quartal16", "pentatonic8", "fullSong"],
  metheny: ["modal16", "turnaround8", "throughComposed12", "pentatonic8", "quartal16", "free", "fullSong"],
  holdsworth: ["modal16", "throughComposed12", "quartal16", "free", "coltraneMatrix16", "turnaround8", "fullSong"],
  alfaMist: ["modal16", "turnaround8", "minorBlues12", "pentatonic8", "aaba32", "quartal16", "fullSong"],
};

export function getFormsForStyle(style: PracticeStyle): JamForm[] {
  return STYLE_FORM_AFFINITY[style] ?? ["blues12", "turnaround8"];
}

// ── Template Pools ──

function getTemplatePool(form: JamForm, style?: PracticeStyle): Chord[][] {
  // Pat Metheny: Lydian shimmer, chromatic mediants, open sus voicings
  if (style === "metheny") {
    switch (form) {
      case "modal16": return METHENY_MODAL_16;
      case "turnaround8": return METHENY_TURNAROUND_8;
      case "throughComposed12": return METHENY_THROUGH_COMPOSED_12;
      case "pentatonic8": return METHENY_PENTATONIC_8;
      case "quartal16": return METHENY_QUARTAL_16;
      default: break; // fall through to generic
    }
  }

  // Alfa Mist: use dedicated pools transcribed from actual albums
  // when available, fall back to generic pools for other forms
  if (style === "alfaMist") {
    switch (form) {
      case "modal16": return ALFA_MIST_MODAL_16;
      case "turnaround8": return ALFA_MIST_TURNAROUND_8;
      case "aaba32": return ALFA_MIST_AABA_32;
      case "minorBlues12": return ALFA_MIST_MINOR_BLUES_12;
      case "pentatonic8": return ALFA_MIST_PENTATONIC_8;
      case "quartal16": return ALFA_MIST_QUARTAL_16;
      default: break; // fall through to generic
    }
  }

  switch (form) {
    case "blues12": return BLUES_12;
    case "rhythm32": return RHYTHM_32;
    case "aaba32": return AABA_32;
    case "modal16": return MODAL_16;
    case "turnaround8": return TURNAROUND_8;
    case "abac32": return ABAC_32;
    case "songForm24": return SONG_FORM_24;
    case "rondo20": return RONDO_20;
    case "clave16": return CLAVE_16;
    case "minorBlues12": return MINOR_BLUES_12;
    case "secondLine16": return SECOND_LINE_16;
    case "coltraneMatrix16": return COLTRANE_MATRIX_16;
    case "throughComposed12": return THROUGH_COMPOSED_12;
    case "pentatonic8": return PENTATONIC_8;
    case "quartal16": return QUARTAL_16;
    case "fullSong": return []; // handled by generateFullSong()
    case "free": return []; // handled separately
  }
}

/** Detect the "home key" of a template for transposition offset. */
function detectTemplateKey(template: Chord[]): JamKey {
  // Last chord's root is usually the tonic, or first chord for vamps
  const last = template[template.length - 1];
  const first = template[0];
  // For minor templates, the root is still the key center
  const root = last.root;
  return (ALL_KEYS.includes(root as JamKey) ? root : first.root) as JamKey;
}

function generateFreeForm(measures: number, toKey: JamKey): Chord[] {
  const chords: Chord[] = [];
  while (chords.length < measures) {
    const fragment = FREE_FRAGMENTS[Math.floor(Math.random() * FREE_FRAGMENTS.length)];
    const remaining = measures - chords.length;
    const slice = fragment.slice(0, remaining);
    chords.push(...slice);
  }
  return transposeProgression(chords, "C" as JamKey, toKey);
}

// ── Score Builder ──

export function buildScoreFromChords(
  chords: Chord[],
  opts: { key: JamKey; tempo: number; timeSignature: [number, number] },
): QuantizedScore {
  const { tempo, timeSignature, key } = opts;
  const beatsPerMeasure = timeSignature[0] * (4 / timeSignature[1]);
  const beatDuration = 60 / tempo;
  const measureDuration = beatsPerMeasure * beatDuration;

  const measures: QuantizedMeasure[] = chords.map((chord, i) => ({
    index: i,
    notes: [],
    chords: [{ root: chord.root, quality: chord.quality, startTime: i * measureDuration }],
    chord: { root: chord.root, quality: chord.quality, startTime: i * measureDuration },
    timeSignature,
    keySignature: key,
    tempo,
    startTime: i * measureDuration,
    endTime: (i + 1) * measureDuration,
  }));

  return {
    measures,
    keySignature: key,
    timeSignature,
    tempo,
    duration: chords.length * measureDuration,
  };
}

// ── Labels ──

function buildLabel(form: JamForm, key: JamKey): string {
  switch (form) {
    case "blues12": return `Blues in ${key}`;
    case "rhythm32": return `Rhythm Changes in ${key}`;
    case "aaba32": return `AABA in ${key}`;
    case "modal16": return `Modal in ${key}`;
    case "turnaround8": return `Turnaround in ${key}`;
    case "abac32": return `ABAC in ${key}`;
    case "songForm24": return `Song Form in ${key}`;
    case "rondo20": return `Rondo in ${key}`;
    case "clave16": return `Montuno in ${key}`;
    case "minorBlues12": return `Minor Blues in ${key}`;
    case "secondLine16": return `Second Line in ${key}`;
    case "coltraneMatrix16": return `Coltrane Matrix in ${key}`;
    case "throughComposed12": return `Through-Composed in ${key}`;
    case "pentatonic8": return `Pentatonic in ${key}`;
    case "quartal16": return `Quartal in ${key}`;
    case "fullSong": return `Full Song in ${key}`;
    case "free": return `Free in ${key}`;
  }
}

// ── Quality Enrichment ──
// Probabilistic upgrades: style-gated, position-aware.
// Templates already contain rich voicings; this adds variety on repeated plays.

/** Quality upgrade tables — only upgrades that are musically valid in context. */
const ENRICH_MAJ: string[] = ["maj9", "69", "maj7#11", "maj7#5"];
const ENRICH_MIN: string[] = ["m9", "m11", "m6", "m(maj7)"];
const ENRICH_DOM: string[] = ["9", "13", "7#11", "7#5", "7b5"];
const _ENRICH_ALT: string[] = ["7alt", "7b9b13", "7#9b13", "7b9#11", "7#9#11"];
const ENRICH_SUS: string[] = ["9sus4", "13sus4"];

/** Styles that favor simpler harmony — lower enrichment probability. */
const SIMPLE_STYLES = new Set(["shuffleBlues", "funk", "latin"]);
/** Styles that favor complex harmony — higher enrichment probability. */
const COMPLEX_STYLES = new Set(["fusion", "ecm", "contemporaryJazz", "modal", "mathRock", "idm", "holdsworth", "alfaMist", "metheny"]);

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Probabilistically enrich a chord quality based on style and position.
 * - `position`: 0-1 where the chord sits in the form (0 = start, 1 = end)
 * - Held chords (early in phrases) get more extensions
 * - Passing chords and turnaround bars stay simpler
 * - Returns original quality if no upgrade triggered
 */
export function enrichQuality(
  quality: string,
  style: PracticeStyle,
  position: number,
): string {
  // Base probability: 25% chance to upgrade
  let prob = 0.25;
  if (SIMPLE_STYLES.has(style)) prob = 0.12;
  if (COMPLEX_STYLES.has(style)) prob = 0.40;
  if (style === "holdsworth") prob = 0.60; // Holdsworth: melodic minor harmony dominates
  if (style === "alfaMist") prob = 0.50; // Alfa Mist: lush extensions, warm not angular
  if (style === "metheny") prob = 0.55; // Metheny: Lydian shimmer, bright extensions

  // Position bias: held chords (first half of form) upgrade more
  if (position < 0.3) prob *= 1.3;
  if (position > 0.85) prob *= 0.7; // near end — let resolutions be clean

  if (Math.random() > prob) return quality;

  // Holdsworth-specific upgrades: favor melodic minor derivatives,
  // lydian augmented, altered dominants, wide-interval voicings
  if (style === "holdsworth") {
    switch (quality) {
      case "maj7": return pickRandom(["maj7#5", "maj7#11", "maj9", "maj7#5"]);
      case "maj9": case "69": return pickRandom(["maj7#5", "maj7#11"]);
      case "m7": return pickRandom(["m(maj7)", "m9", "m11", "m(maj7)"]);
      case "m9": return pickRandom(["m(maj7)", "m11"]);
      case "7": return pickRandom(["7alt", "7b5", "7#11", "7b9", "7#5"]);
      case "9": case "13": return pickRandom(["7alt", "7#11", "7b5"]);
      case "7b9": return pickRandom(["7alt", "7b9b13"]);
      case "7#9": return pickRandom(["7alt", "7#9b13"]);
      case "7sus": return pickRandom(["9sus4", "13sus4"]);
      case "7alt": case "m7b5": case "dim7": case "aug":
      case "5": case "m(maj7)": case "m6": case "maj7#5":
        return quality;
      default: return quality;
    }
  }

  // Alfa Mist: warm extensions only — m9, m11, maj9, 69, sus.
  // NO altered dominants (no 7alt, 7b9, 7#9). Lush and dreamy, not angular.
  // Based on Antiphon/Structuralism/Variables transcriptions.
  if (style === "alfaMist") {
    switch (quality) {
      case "maj7": return pickRandom(["maj9", "69", "maj9", "maj7"]);
      case "": return pickRandom(["maj7", "maj9", "69"]); // bare triad → warm extension
      case "m": return pickRandom(["m7", "m9"]); // bare minor → 7th/9th
      case "m7": return pickRandom(["m9", "m11", "m9", "m6"]);
      case "m9": return Math.random() < 0.4 ? "m11" : quality;
      case "7": return pickRandom(["9", "13", "9"]);
      case "9": return Math.random() < 0.3 ? "13" : quality;
      case "7sus": case "sus4": return pickRandom(["9sus4", "13sus4"]);
      case "9sus4": return Math.random() < 0.3 ? "13sus4" : quality;
      case "add9": return pickRandom(["maj9", "69"]);
      case "m7b5": case "dim7": case "aug": case "5":
      case "m(maj7)": case "m6": case "7alt":
        return quality;
      default: return quality;
    }
  }

  // Pat Metheny: Lydian dominant, bright extensions — maj7#11, 6/9, 9sus4.
  // Chromatic mediants, modal interchange. Some altered dominants for B-section tension.
  // Based on Bright Size Life / Unity Village / Sirabhorn analysis.
  if (style === "metheny") {
    switch (quality) {
      case "maj7": return pickRandom(["maj7#11", "maj9", "69", "maj7#11"]);
      case "maj9": case "69": return Math.random() < 0.5 ? "maj7#11" : quality;
      case "": return pickRandom(["maj7", "maj7#11", "69"]); // bare triad → Lydian extension
      case "m7": return pickRandom(["m9", "m11", "m9"]);
      case "m9": return Math.random() < 0.3 ? "m11" : quality;
      case "7": return pickRandom(["9", "13", "9sus4", "7#11"]);
      case "9": return Math.random() < 0.3 ? pickRandom(["13", "7#11"]) : quality;
      case "7sus": case "sus4": return pickRandom(["9sus4", "13sus4"]);
      case "9sus4": return Math.random() < 0.3 ? "13sus4" : quality;
      case "m7b5": case "dim7": case "aug": case "5":
      case "m(maj7)": case "m6": case "7alt": case "maj7#11":
        return quality;
      default: return quality;
    }
  }

  // Choose upgrade based on quality family
  switch (quality) {
    case "maj7":
      return pickRandom(ENRICH_MAJ);
    case "maj9":
    case "69":
      // Already rich — small chance for lydian color
      return Math.random() < 0.3 ? "maj7#11" : quality;

    case "m7":
      return pickRandom(ENRICH_MIN);
    case "m9":
      // Already extended — add color
      return Math.random() < 0.3 ? pickRandom(["m11", "m6"]) : quality;

    case "7":
      return pickRandom(ENRICH_DOM);
    case "9":
    case "13":
      // Dominant already extended — small chance for altered
      return Math.random() < 0.25 ? pickRandom(["7#11", "7#5"]) : quality;

    case "7b9":
      return Math.random() < 0.4 ? pickRandom(["7b9b13", "7b9#11"]) : quality;
    case "7#9":
      return Math.random() < 0.4 ? pickRandom(["7#9b13", "7#9#11"]) : quality;
    case "7alt":
      // Already maximally altered
      return quality;

    case "7sus":
      return pickRandom(ENRICH_SUS);
    case "9sus4":
      return Math.random() < 0.3 ? "13sus4" : quality;

    case "m7b5":
    case "dim7":
    case "aug":
    case "5":
    case "m(maj7)":
    case "m6":
      // These serve specific harmonic functions — don't alter
      return quality;

    default:
      return quality;
  }
}

// ── Full Song Generator ──

interface SongStructureEntry {
  type: SongSectionType;
  label: string;
  formSource: "head" | "bridge" | "intro" | "outro";
  dynamicLevel: number;
}

interface SongStructureTemplate {
  sections: SongStructureEntry[];
  soloCountRange: [number, number]; // [min, max] solo choruses
}

// Style → structure template mapping
function getSongStructure(style: PracticeStyle): SongStructureTemplate {
  // Jazz standard: swing, hardBop, coolJazz, jazzWaltz, shuffleBlues, contemporaryJazz, ballad
  if (["swing", "hardBop", "coolJazz", "jazzWaltz", "shuffleBlues", "contemporaryJazz", "ballad"].includes(style)) {
    return {
      sections: [
        { type: "intro", label: "Intro", formSource: "intro", dynamicLevel: 0.65 },
        { type: "head", label: "Head In", formSource: "head", dynamicLevel: 0.80 },
        { type: "solo", label: "Solo", formSource: "head", dynamicLevel: 0.88 },
        { type: "shout", label: "Shout", formSource: "bridge", dynamicLevel: 1.00 },
        { type: "head", label: "Head Out", formSource: "head", dynamicLevel: 0.90 },
        { type: "outro", label: "Outro", formSource: "outro", dynamicLevel: 0.70 },
      ],
      soloCountRange: [1, 3],
    };
  }

  // Modal jam: modal, ecm
  if (["modal", "ecm"].includes(style)) {
    return {
      sections: [
        { type: "intro", label: "Intro", formSource: "intro", dynamicLevel: 0.60 },
        { type: "head", label: "Head", formSource: "head", dynamicLevel: 0.78 },
        { type: "solo", label: "Solo", formSource: "head", dynamicLevel: 0.88 },
        { type: "head", label: "Head Out", formSource: "head", dynamicLevel: 0.85 },
        { type: "outro", label: "Outro", formSource: "outro", dynamicLevel: 0.65 },
      ],
      soloCountRange: [2, 4],
    };
  }

  // Broken beat: alfaMist, neoSoul
  if (["alfaMist", "neoSoul"].includes(style)) {
    return {
      sections: [
        { type: "intro", label: "Intro", formSource: "intro", dynamicLevel: 0.55 },
        { type: "head", label: "Head In", formSource: "head", dynamicLevel: 0.75 },
        { type: "solo", label: "Solo", formSource: "head", dynamicLevel: 0.88 },
        { type: "interlude", label: "Interlude", formSource: "bridge", dynamicLevel: 0.70 },
        { type: "head", label: "Head Out", formSource: "head", dynamicLevel: 0.85 },
        { type: "outro", label: "Outro", formSource: "outro", dynamicLevel: 0.60 },
      ],
      soloCountRange: [1, 3],
    };
  }

  // Fusion: fusion, holdsworth, metheny
  if (["fusion", "holdsworth", "metheny"].includes(style)) {
    return {
      sections: [
        { type: "intro", label: "Intro", formSource: "intro", dynamicLevel: 0.65 },
        { type: "head", label: "Head In", formSource: "head", dynamicLevel: 0.80 },
        { type: "solo", label: "Solo", formSource: "head", dynamicLevel: 0.90 },
        { type: "bridge", label: "Bridge", formSource: "bridge", dynamicLevel: 0.82 },
        { type: "solo", label: "Solo", formSource: "head", dynamicLevel: 0.95 },
        { type: "head", label: "Head Out", formSource: "head", dynamicLevel: 0.88 },
        { type: "outro", label: "Outro", formSource: "outro", dynamicLevel: 0.68 },
      ],
      soloCountRange: [1, 2],
    };
  }

  // Latin: bossa, latin
  if (["bossa", "latin"].includes(style)) {
    return {
      sections: [
        { type: "intro", label: "Intro", formSource: "intro", dynamicLevel: 0.70 },
        { type: "head", label: "Head In", formSource: "head", dynamicLevel: 0.82 },
        { type: "solo", label: "Solo", formSource: "head", dynamicLevel: 0.90 },
        { type: "head", label: "Head Out", formSource: "head", dynamicLevel: 0.85 },
        { type: "outro", label: "Outro", formSource: "outro", dynamicLevel: 0.72 },
      ],
      soloCountRange: [1, 3],
    };
  }

  // Other: funk, mathRock, idm
  return {
    sections: [
      { type: "intro", label: "Intro", formSource: "intro", dynamicLevel: 0.68 },
      { type: "head", label: "Head In", formSource: "head", dynamicLevel: 0.80 },
      { type: "solo", label: "Solo", formSource: "head", dynamicLevel: 0.90 },
      { type: "bridge", label: "Bridge", formSource: "bridge", dynamicLevel: 0.78 },
      { type: "head", label: "Head Out", formSource: "head", dynamicLevel: 0.85 },
      { type: "outro", label: "Outro", formSource: "outro", dynamicLevel: 0.65 },
    ],
    soloCountRange: [1, 2],
  };
}

/**
 * Pick a head form from style affinity, excluding fullSong/free.
 */
function pickHeadForm(style: PracticeStyle): JamForm {
  const candidates = (STYLE_FORM_AFFINITY[style] ?? ["blues12"]).filter(
    f => f !== "fullSong" && f !== "free",
  );
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Pick a contrasting bridge form — shorter than head, different feel.
 */
function pickBridgeForm(headForm: JamForm, style: PracticeStyle): JamForm {
  const short: JamForm[] = ["turnaround8", "pentatonic8", "modal16"];
  const candidates = short.filter(f => f !== headForm);
  // Prefer forms the style knows
  const styleForms = STYLE_FORM_AFFINITY[style] ?? [];
  const preferred = candidates.filter(f => styleForms.includes(f));
  const pool = preferred.length > 0 ? preferred : candidates;
  return pool[Math.floor(Math.random() * pool.length)] ?? "turnaround8";
}

/**
 * Generate a full multi-section song.
 * Assembles intro, head, solo choruses, bridge, head out, and outro
 * from existing template pools.
 */
function generateFullSong(
  key: JamKey,
  style: PracticeStyle,
): { chords: Chord[]; sections: SongSection[] } {
  const structure = getSongStructure(style);
  const headForm = pickHeadForm(style);

  // Get head chords
  const headPool = getTemplatePool(headForm, style);
  const headTemplate = headPool[Math.floor(Math.random() * headPool.length)];
  const headKey = detectTemplateKey(headTemplate);
  const headChords = transposeProgression(headTemplate, headKey, key);

  // Get bridge chords (contrasting harmony — modulate up a 4th)
  const bridgeForm = pickBridgeForm(headForm, style);
  const bridgePool = getTemplatePool(bridgeForm, style);
  const bridgeTemplate = bridgePool[Math.floor(Math.random() * bridgePool.length)];
  const bridgeKey = detectTemplateKey(bridgeTemplate);
  // Bridge modulates up a perfect 4th for contrast
  const bridgeTargetIdx = (ALL_KEYS.indexOf(key) + 5) % 12;
  const bridgeTarget = ALL_KEYS[bridgeTargetIdx];
  const bridgeChords = transposeProgression(bridgeTemplate, bridgeKey, bridgeTarget);

  // Intro: last 4 bars of head (turnaround feel)
  const introLen = Math.min(4, headChords.length);
  const introChords = headChords.slice(-introLen).map(c => ({ ...c }));

  // Outro: last 4 bars of head repeated (tag ending)
  const outroLen = Math.min(4, headChords.length);
  const outroChords = headChords.slice(-outroLen).map(c => ({ ...c }));

  // Determine solo count
  const [minSolos, maxSolos] = structure.soloCountRange;
  const soloCount = minSolos + Math.floor(Math.random() * (maxSolos - minSolos + 1));

  // Assemble sections
  const allChords: Chord[] = [];
  const sections: SongSection[] = [];
  let soloNum = 0;

  for (const entry of structure.sections) {
    const startMeasure = allChords.length;
    let sectionChords: Chord[];

    switch (entry.formSource) {
      case "intro":
        sectionChords = introChords.map(c => ({ ...c }));
        break;
      case "outro":
        sectionChords = outroChords.map(c => ({ ...c }));
        break;
      case "bridge":
        sectionChords = bridgeChords.map(c => ({ ...c }));
        break;
      case "head":
        if (entry.type === "solo") {
          // Expand solo sections into soloCount repetitions
          for (let s = 0; s < soloCount; s++) {
            soloNum++;
            const soloStart = allChords.length;
            const soloChords = headChords.map(c => ({ ...c }));
            allChords.push(...soloChords);
            // Dynamic escalation across solo choruses
            const soloProgress = soloCount > 1 ? s / (soloCount - 1) : 0;
            const soloDynamic = entry.dynamicLevel + soloProgress * 0.10;
            sections.push({
              type: "solo",
              label: soloCount > 1 ? `Solo ${soloNum}` : "Solo",
              startMeasure: soloStart,
              endMeasure: allChords.length,
              sourceForm: headForm,
              dynamicLevel: Math.min(soloDynamic, 1.0),
            });
          }
          continue; // already pushed chords+sections
        }
        sectionChords = headChords.map(c => ({ ...c }));
        break;
      default:
        sectionChords = headChords.map(c => ({ ...c }));
    }

    allChords.push(...sectionChords);
    sections.push({
      type: entry.type,
      label: entry.label,
      startMeasure,
      endMeasure: allChords.length,
      sourceForm: entry.formSource === "bridge" ? bridgeForm : headForm,
      dynamicLevel: entry.dynamicLevel,
    });
  }

  return { chords: allChords, sections };
}

// ── Main Generator ──

export function generateJamSession(config: JamConfig): JamResult {
  if (config.tempo <= 0) throw new RangeError(`tempo must be > 0, got ${config.tempo}`);
  const { key, form, style, tempo, timeSignature } = config;

  let chords: Chord[];
  let sections: SongSection[] | undefined;

  if (form === "fullSong") {
    const result = generateFullSong(key, style);
    chords = result.chords;
    sections = result.sections;
  } else if (form === "free") {
    const count = config.measures ?? 16;
    chords = generateFreeForm(count, key);
  } else {
    const pool = getTemplatePool(form, style);
    const template = pool[Math.floor(Math.random() * pool.length)];
    const templateKey = detectTemplateKey(template);
    chords = transposeProgression(template, templateKey, key);
  }

  // Probabilistic quality enrichment — adds variety on repeated plays
  const total = chords.length;
  chords = chords.map((c, i) => ({
    root: c.root,
    quality: enrichQuality(c.quality, style, i / total),
  }));

  const score = buildScoreFromChords(chords, { key, tempo, timeSignature });
  const progressionLabel = buildLabel(form, key);

  return { score, config, progressionLabel, sections };
}
