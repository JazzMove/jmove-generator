/**
 * Central chord quality resolution module.
 *
 * Parses ANY chord quality string into a normalized interval set,
 * classifies quality family, and selects appropriate scale.
 * Single source of truth - replaces duplicated quality handling
 * across walkingBass.ts, pianoComping.ts, and harmonicAnalysis.ts.
 *
 * Known qualities get O(1) lookup. Unknown qualities are parsed
 * algorithmically from their component tokens (triad type, 7th,
 * alterations). Handles both normalized internal format AND raw
 * iReal Pro symbols (o, h, ^, +, etc.).
 */

// ── Types ──

export type QualityFamily =
  | "major"
  | "minor"
  | "dominant"
  | "diminished"
  | "halfDiminished"
  | "augmented"
  | "suspended"
  | "power";

export interface ParsedQuality {
  /** Chord tone intervals from root (semitones). Bass-friendly: R-3-5-7/6, no upper extensions. */
  intervals: number[];
  /** Quality family classification. */
  family: QualityFamily;
  /** Scale intervals for passing tones (semitones from root). */
  scale: number[];
}

// ── Scales ──

const IONIAN: readonly number[] = [0, 2, 4, 5, 7, 9, 11];
const DORIAN: readonly number[] = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN: readonly number[] = [0, 2, 4, 5, 7, 9, 10];
const DIMINISHED_WH: readonly number[] = [0, 2, 3, 5, 6, 8, 9, 11];
const LOCRIAN_NAT2: readonly number[] = [0, 2, 3, 5, 6, 8, 10];
const MELODIC_MINOR: readonly number[] = [0, 2, 3, 5, 7, 9, 11];
const ALTERED: readonly number[] = [0, 1, 3, 4, 6, 8, 10];
const LYDIAN_DOM: readonly number[] = [0, 2, 4, 6, 7, 9, 10];
const WHOLE_TONE: readonly number[] = [0, 2, 4, 6, 8, 10];
const HW_DIM: readonly number[] = [0, 1, 3, 4, 6, 7, 9, 10];
const LYDIAN: readonly number[] = [0, 2, 4, 6, 7, 9, 11];

// ── Known Quality Map ──
// Exact interval sets for all qualities found in iReal Pro charts.
// Each entry: [family, chordToneIntervals].
// Chord tones = R-3rd-5th-7th/6th. No upper extensions (bass walks on these).

type KnownEntry = [QualityFamily, number[]];

const KNOWN: Record<string, KnownEntry> = {
  // ── Major family ──
  "":           ["major", [0, 4, 7]],
  "maj7":       ["major", [0, 4, 7, 11]],
  "maj9":       ["major", [0, 4, 7, 11]],
  "maj13":      ["major", [0, 4, 7, 11]],
  "maj7#11":    ["major", [0, 4, 7, 11]],
  "maj7#5":     ["major", [0, 4, 8, 11]],
  "6":          ["major", [0, 4, 7, 9]],
  "69":         ["major", [0, 4, 7, 9]],
  "6/9":        ["major", [0, 4, 7, 9]],
  "add9":       ["major", [0, 4, 7]],
  "5":          ["power", [0, 7]],

  // ── Minor family ──
  "m":          ["minor", [0, 3, 7]],
  "m7":         ["minor", [0, 3, 7, 10]],
  "m9":         ["minor", [0, 3, 7, 10]],
  "m6":         ["minor", [0, 3, 7, 9]],
  "m6/9":       ["minor", [0, 3, 7, 9]],
  "m(maj7)":    ["minor", [0, 3, 7, 11]],
  "m11":        ["minor", [0, 3, 7, 10]],

  // ── Dominant family ──
  "7":          ["dominant", [0, 4, 7, 10]],
  "9":          ["dominant", [0, 4, 7, 10]],
  "13":         ["dominant", [0, 4, 7, 10]],
  "7b9":        ["dominant", [0, 4, 7, 10]],
  "7#9":        ["dominant", [0, 4, 7, 10]],
  "7b5":        ["dominant", [0, 4, 6, 10]],
  "7#5":        ["dominant", [0, 4, 8, 10]],
  "7alt":       ["dominant", [0, 4, 8, 10]],
  "7b13":       ["dominant", [0, 4, 7, 10]],
  "7#11":       ["dominant", [0, 4, 7, 10]],
  "7b9b13":     ["dominant", [0, 4, 7, 10]],
  "7#9b13":     ["dominant", [0, 4, 7, 10]],
  "7b9#11":     ["dominant", [0, 4, 7, 10]],
  "7#9#11":     ["dominant", [0, 4, 7, 10]],
  "7#9b5":      ["dominant", [0, 4, 6, 10]],
  "7b9b5":      ["dominant", [0, 4, 6, 10]],
  "aug7":       ["dominant", [0, 4, 8, 10]],

  // ── Suspended family ──
  "sus4":       ["suspended", [0, 5, 7]],
  "7sus":       ["suspended", [0, 5, 7, 10]],
  "7sus4":      ["suspended", [0, 5, 7, 10]],
  "9sus4":      ["suspended", [0, 5, 7, 10]],
  "13sus4":     ["suspended", [0, 5, 7, 10]],
  "sus2":       ["suspended", [0, 2, 7]],

  // ── Diminished family ──
  "dim":        ["diminished", [0, 3, 6]],
  "dim7":       ["diminished", [0, 3, 6, 9]],

  // ── Half-diminished ──
  "m7b5":       ["halfDiminished", [0, 3, 6, 10]],

  // ── Augmented ──
  "aug":        ["augmented", [0, 4, 8]],
};

// ── iReal Pro Symbol Normalization ──
// Maps raw iReal symbols to internal quality strings before lookup.

const IREAL_ALIASES: Record<string, string> = {
  "o":     "dim",
  "o7":    "dim7",
  "h":     "m7b5",
  "h7":    "m7b5",
  "0":     "m7b5",
  "07":    "m7b5",
};

// ── Quality Normalization ──

/** Strip slash bass note and normalize iReal Pro symbols. */
function normalize(raw: string): string {
  const slashIdx = raw.indexOf("/");
  // Preserve "/" that's part of quality (e.g., "6/9"), strip slash bass (e.g., "/E")
  let q: string;
  if (slashIdx >= 0) {
    const after = raw.slice(slashIdx + 1);
    // Slash bass = single uppercase letter optionally followed by # or b
    if (/^[A-G][#b]?$/.test(after)) {
      q = raw.slice(0, slashIdx);
    } else {
      q = raw; // "6/9" stays as-is
    }
  } else {
    q = raw;
  }

  // Normalize Unicode: ø → m7b5
  q = q.replace(/ø7?/, "m7b5");
  // Normalize dash+caret combo BEFORE generic caret replacement
  if (q === "-^7" || q === "-^") q = "m(maj7)";
  // Normalize caret: ^7 → maj7, ^ → maj7
  q = q.replace(/\^7/, "maj7").replace(/\^/, "maj7");
  // Normalize +7 → aug7, bare + → aug
  if (q === "+") q = "aug";
  else if (q === "+7") q = "aug7";
  // Normalize dash: -X → mX (iReal Pro minus = minor)
  if (q === "-") q = "m";
  else if (q === "-7") q = "m7";
  else if (q === "-9") q = "m9";
  else if (q === "-11") q = "m11";
  else if (q === "-(maj7)" || q === "-maj7") q = "m(maj7)";
  else if (q.startsWith("-")) q = "m" + q.slice(1); // catch-all: -6, -69, etc.

  return IREAL_ALIASES[q] ?? q;
}

// ── Family Classification ──

/** Classify a normalized quality string into its family. */
function classifyNormalized(q: string): QualityFamily {
  // Order matters: check specific patterns before general ones

  // Power chord
  if (q === "5") return "power";

  // Half-diminished (before minor, since m7b5 starts with "m")
  if (q === "m7b5") return "halfDiminished";

  // Diminished
  if (q.includes("dim")) return "diminished";

  // Augmented (but not aug7 which is dominant)
  if (q === "aug") return "augmented";

  // Suspended
  if (q.includes("sus")) return "suspended";

  // Minor (starts with "m" but not "maj")
  if (q.startsWith("m") && !q.startsWith("maj")) return "minor";

  // Dominant: has 7/9/13 but no "maj" prefix, and not already caught above
  // aug7 is dominant (augmented dominant 7th)
  if (q === "aug7") return "dominant";
  if (!q.startsWith("maj") && (q.includes("7") || q === "9" || q === "11" || q === "13"
    || q.startsWith("9") || q.startsWith("11") || q.startsWith("13"))) return "dominant";

  // Major: maj-prefixed, 6ths, empty string, add9, bare triad
  return "major";
}

// ── Scale Selection ──

/**
 * Select scale for passing tones based on quality and family.
 * Musically informed: uses alterations to pick the most appropriate scale.
 */
function selectScale(q: string, family: QualityFamily): readonly number[] {
  switch (family) {
    case "diminished":
      return DIMINISHED_WH;
    case "halfDiminished":
      return LOCRIAN_NAT2;
    case "augmented":
      return WHOLE_TONE;
    case "suspended":
      return MIXOLYDIAN;
    case "power":
      return IONIAN;
    case "minor":
      if (q.includes("maj7") || q === "m(maj7)") return MELODIC_MINOR;
      return DORIAN;
    case "dominant":
      // Priority: alt > #11 > b9 > generic. For combos like 7b9#11,
      // #11 wins (lydian dominant subsumes b9 as passing tone).
      if (q.includes("alt")) return ALTERED;
      if (q.includes("#11")) return LYDIAN_DOM;
      if (q.includes("b9")) return HW_DIM;
      return MIXOLYDIAN;
    case "major":
      if (q.includes("#11") || q.includes("lyd")) return LYDIAN;
      return IONIAN;
  }
}

// ── Algorithmic Interval Builder ──

/**
 * Build chord tone intervals for an unknown quality string by parsing its tokens.
 * Produces R-3rd-5th-7th (no upper extensions) matching the KNOWN map convention.
 */
function buildIntervals(q: string, family: QualityFamily): number[] {
  const intervals: number[] = [0]; // root always present

  // 3rd
  switch (family) {
    case "suspended":
      intervals.push(q.includes("sus2") ? 2 : 5);
      break;
    case "power":
      // no 3rd
      break;
    case "minor":
    case "diminished":
    case "halfDiminished":
      intervals.push(3);
      break;
    default: // major, dominant, augmented
      intervals.push(4);
      break;
  }

  // 5th
  if (family === "diminished" || family === "halfDiminished" || q.includes("b5")) {
    intervals.push(6);
  } else if (family === "augmented" || q.includes("#5") || q.includes("alt")) {
    intervals.push(8);
  } else {
    intervals.push(7);
  }

  // 7th / 6th — order matters: maj7 before dim7, dim7 before generic "7"
  if (q.includes("6") && !q.includes("b6") && !q.includes("b13") && !q.includes("7")) {
    intervals.push(9); // major 6th
  } else if (/maj\d/.test(q) || q === "m(maj7)") {
    // "maj" + digit: maj7, maj9, maj11, maj13, m(maj7) all imply major 7th
    intervals.push(11); // major 7th
  } else if (family === "diminished" && !q.includes("maj") && (q.includes("7") || q.endsWith("7"))) {
    intervals.push(9); // diminished 7th (enharmonic major 6th)
  } else if (
    q.includes("7") || q.includes("9") || q.includes("11") || q.includes("13")
    || family === "halfDiminished"
  ) {
    intervals.push(10); // minor 7th
  }
  // else: no 7th (plain triads, add9, sus without 7, etc.)

  return intervals;
}

// ── Parse Cache ──
const cache = new Map<string, ParsedQuality>();

/** Freeze a ParsedQuality so cached results can't be mutated by consumers. */
function freeze(result: ParsedQuality): ParsedQuality {
  Object.freeze(result.intervals);
  Object.freeze(result.scale);
  return Object.freeze(result) as ParsedQuality;
}

// ── Public API ──

/**
 * Parse a chord quality string into its interval set, family, and scale.
 * Handles all known iReal Pro qualities plus arbitrary extensions/alterations.
 * Results are cached and frozen (immutable).
 */
export function parseQuality(raw: string): ParsedQuality {
  const cached = cache.get(raw);
  if (cached) return cached;

  const q = normalize(raw);

  // Fast path: known quality
  const known = KNOWN[q];
  if (known) {
    const [family, intervals] = known;
    const result = freeze({
      intervals: [...intervals],
      family,
      scale: [...selectScale(q, family)],
    });
    cache.set(raw, result);
    return result;
  }

  // Algorithmic path: parse tokens
  const family = classifyNormalized(q);
  const intervals = buildIntervals(q, family);
  const scale = [...selectScale(q, family)] as number[];
  const result = freeze({ intervals, family, scale });
  cache.set(raw, result);
  return result;
}

/**
 * Get chord tone intervals for a quality string.
 * Shorthand for parseQuality(q).intervals.
 */
export function getChordIntervals(q: string): number[] {
  return parseQuality(q).intervals;
}

/**
 * Get scale intervals for passing tones over a quality.
 * Shorthand for parseQuality(q).scale.
 */
export function getQualityScale(q: string): number[] {
  return parseQuality(q).scale;
}

/**
 * Classify a quality string into its family.
 * Shorthand for parseQuality(q).family.
 */
export function classifyQuality(q: string): QualityFamily {
  return parseQuality(q).family;
}

/** True for dominant-function qualities (7, 9, 13, 7alt, aug7, etc.). */
export function isDominant(q: string): boolean {
  return parseQuality(q).family === "dominant";
}

/** True for minor-family qualities (m, m7, m9, m11, dim, dim7, etc.). */
export function isMinor(q: string): boolean {
  const f = parseQuality(q).family;
  return f === "minor" || f === "diminished";
}

/** True for fully diminished qualities (dim, dim7, o, o7). */
export function isDiminished(q: string): boolean {
  return parseQuality(q).family === "diminished";
}

/** True for half-diminished qualities (m7b5, h, h7, 0, 07, ø). */
export function isHalfDiminished(q: string): boolean {
  return parseQuality(q).family === "halfDiminished";
}

// ── Exported Scale Constants ──
// Consumers that need raw scale arrays (e.g., for range generation) can import these.

export const SCALES = {
  ionian: IONIAN as number[],
  dorian: DORIAN as number[],
  mixolydian: MIXOLYDIAN as number[],
  diminishedWH: DIMINISHED_WH as number[],
  locrianNat2: LOCRIAN_NAT2 as number[],
  melodicMinor: MELODIC_MINOR as number[],
  altered: ALTERED as number[],
  lydianDom: LYDIAN_DOM as number[],
  wholeTone: WHOLE_TONE as number[],
  hwDim: HW_DIM as number[],
  lydian: LYDIAN as number[],
} as const;
