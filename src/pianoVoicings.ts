/** Piano voicing engine - builders, voice leading, and selection. Extracted from pianoComping.ts for G29. */

import { VOICINGS, ROOT_SEMITONES, UST_TRIADS, type VoicingTemplate } from "./pianoVoicingData";
import { isDominant as isDominantQuality, classifyQuality } from "./chordQuality";

// ── Voicing State ──
// Set by pianoComping.ts before each generation call.
// ES module live bindings allow importers to read current values.
let _voicingLow = 55;   // replaces getPianoLow()
let _voicingHigh = 84;  // replaces getPianoHigh()
let _voicingRng: () => number = Math.random;  // replaces _rng

interface SavedVoicingState {
  low: number;
  high: number;
  rng: () => number;
}

export function initVoicingState(low: number, high: number, rng: () => number): SavedVoicingState {
  const saved = { low: _voicingLow, high: _voicingHigh, rng: _voicingRng };
  _voicingLow = low;
  _voicingHigh = high;
  _voicingRng = rng;
  return saved;
}

export function restoreVoicingState(saved: SavedVoicingState): void {
  _voicingLow = saved.low;
  _voicingHigh = saved.high;
  _voicingRng = saved.rng;
}

export function rootMidi(root: string): number {
  return ROOT_SEMITONES[root] ?? 0;
}

/** Reverse lookup: MIDI pitch class → root name (for tritone sub). */
const MIDI_TO_ROOT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Tritone sub piano voicing probability per style. */
function tritoneSubPianoWeight(style?: string): number {
  const w: Record<string, number> = {
    hardBop: 0.18, contemporaryJazz: 0.22, fusion: 0.15,
    metheny: 0.12, alfaMist: 0.12, swing: 0.10, holdsworth: 0.10,
    neoSoul: 0.08, ecm: 0.08, modal: 0.06, coolJazz: 0.05,
    bossa: 0.04, latin: 0.04, ballad: 0.06,
  };
  return w[style ?? "swing"] ?? 0;
}

/** Build voicing pitches from root + template, placed in piano range.
 * Critical: must keep all notes in ascending order (no individual octave wrapping). */
export function buildVoicing(root: string, template: VoicingTemplate): number[] {
  const rootPC = rootMidi(root);
  const minInterval = Math.min(...template.intervals);
  const maxInterval = Math.max(...template.intervals);

  // Find the octave where entire voicing fits within PIANO range.
  // Prefer k=4 (octave 4, middle register) then try k=3, k=5, k=2.
  let base = -1;
  for (const k of [4, 3, 5, 2]) {
    const candidate = 12 * k + rootPC;
    if (candidate + minInterval >= _voicingLow && candidate + maxInterval <= _voicingHigh) {
      base = candidate;
      break;
    }
  }

  if (base < 0) {
    // Fallback: fit as many as possible starting from lowest valid position
    base = _voicingLow - minInterval;
    while ((base % 12) !== rootPC) base++;
    if (base + maxInterval > _voicingHigh) base -= 12;
  }

  const clamped = template.intervals.map((i) => {
    let p = base + i;
    while (p < _voicingLow) p += 12;
    while (p > _voicingHigh) p -= 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Compute total voice-leading distance between two voicings.
 *  Uses greedy minimum-cost matching: each voice in `a` finds its closest
 *  unmatched voice in `b`. This correctly handles Type A vs Type B voicings
 *  where sorted-index comparison fails (3rd-on-bottom vs 7th-on-bottom). */
export function voiceLeadingDistance(a: number[], b: number[]): number {
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
export function resolveVoicingQuality(q: string): [VoicingTemplate, VoicingTemplate] {
  // Direct match (covers all common iReal Pro qualities)
  if (VOICINGS[q]) return VOICINGS[q];

  // Family-based fallback via centralized quality classification
  const family = classifyQuality(q);
  switch (family) {
    case "diminished":    return VOICINGS["dim7"];
    case "halfDiminished": return VOICINGS["m7b5"];
    case "augmented":     return VOICINGS["aug"];
    case "suspended":     return VOICINGS["7sus"];
    case "minor":
      return (q.includes("7") || q.includes("9") || q.includes("11") || q.includes("13"))
        ? VOICINGS["m7"] : VOICINGS["m"];
    case "major":
      return (q.includes("7") || q.includes("9") || q.includes("13"))
        ? VOICINGS["maj7"] : VOICINGS[""];
    case "power":         return VOICINGS[""];
    case "dominant":
    default:              return VOICINGS["7"];
  }
}

/** Build cluster voicing (tight groupings, span 5-8 semitones) for Alfa Mist Rhodes.
 *  Rootless — bass handles the root. Mid-register placement for Rhodes sweetspot. */
export function buildClusterVoicing(root: string, quality: string): number[] {
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
    if (pitches[0] >= _voicingLow && pitches[pitches.length - 1] <= _voicingHigh) {
      return pitches;
    }
  }
  // Fallback: octave 4
  const base = 60 + rootPC;
  const clamped = intervals.map(i => {
    let p = base + i;
    while (p > _voicingHigh) p -= 12;
    while (p < _voicingLow) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Alfa Mist warm inversion voicing — first/second inversion triads with 9th.
 *  Self-taught, ear-based: NOT textbook Evans. Spacious but tighter than Metheny.
 *  Root may appear, inversions create warm bottom, 9th adds color on top.
 *  Research: "clever chord inversions" (Qwest TV), Antiphon/Structuralism. */
export function buildAlfaMistInversionVoicing(root: string, quality: string): number[] {
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

  const intervals = shapes[Math.floor(_voicingRng() * shapes.length)];

  for (let k = 3; k <= 5; k++) {
    const base = 12 * k + rootPC;
    const pitches = intervals.map(i => base + i);
    if (pitches[0] >= _voicingLow && pitches[pitches.length - 1] <= _voicingHigh) {
      return pitches;
    }
  }
  const base = 60 + rootPC;
  const clamped = intervals.map(i => {
    let p = base + i;
    while (p > _voicingHigh) p -= 12;
    while (p < _voicingLow) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Post-clamping cleanup: if individual note clamping created semitone clusters,
 *  bump the higher note up an octave. If that's out of range, drop it. */
function removeSemitoneClusters(pitches: number[]): number[] {
  const sorted = [...pitches];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) {
      const bumped = sorted[i] + 12;
      if (bumped <= _voicingHigh) {
        sorted[i] = bumped;
      } else {
        sorted.splice(i, 1);
        i--;
      }
    }
  }
  return sorted.sort((a, b) => a - b);
}

/** Build open voicing (wide intervals, open 5ths) for Metheny — translates
 *  guitar open-string voicings to piano. Lydian shimmer: 3-note or 4-note
 *  spread across 12-17 semitones. Rootless — bass handles the root. */
export function buildOpenVoicing(root: string, quality: string): number[] {
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
  } else if (q.includes("maj") && q.includes("#5")) {
    // Major augmented: 3-#5-maj7 (augmented triad + maj7)
    intervals = [4, 8, 11];
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
    if (pitches[0] >= _voicingLow && pitches[pitches.length - 1] <= _voicingHigh) {
      return pitches;
    }
  }
  // Fallback: octave 4 — clamping can create clusters, guard against them
  const base = 60 + rootPC;
  const clamped = intervals.map(i => {
    let p = base + i;
    while (p > _voicingHigh) p -= 12;
    while (p < _voicingLow) p += 12;
    return p;
  });
  return removeSemitoneClusters([...new Set(clamped)].sort((a, b) => a - b));
}

/** Build quartal voicing (stacked diatonic 4ths) for modal/ECM styles.
 *  Uses quality-derived scale tones so voicings are harmonically correct.
 *  Real quartal voicings stack 4ths FROM THE SCALE, not chromatic P4ths. */
export function buildQuartalVoicing(root: string, quality?: string): number[] {
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
    while (p > _voicingHigh) p -= 12;
    while (p < _voicingLow) p += 12;
    return p;
  });
  return removeSemitoneClusters([...new Set(clamped)].sort((a, b) => a - b));
}

/** Open 5ths voicing — wide intervals, Holdsworth keyboard signature.
 *  Stacked 5ths (or P5 + M3) spanning 2+ octaves for open, airy sound. */
export function buildOpen5thsVoicing(root: string, quality: string): number[] {
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
    while (p > _voicingHigh) p -= 12;
    while (p < _voicingLow) p += 12;
    return p;
  });
  return removeSemitoneClusters([...new Set(clamped)].sort((a, b) => a - b));
}

/** Standard Evans rootless voicing with voice-leading optimization. */
export function buildStandardVoicing(
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
      while (p > _voicingHigh) p -= 12;
      while (p < _voicingLow) p += 12;
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
export function buildRootPositionVoicing(root: string, quality: string): number[] {
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
    while (p > _voicingHigh) p -= 12;
    while (p < _voicingLow) p += 12;
    return p;
  });
  return [...new Set(clamped)].sort((a, b) => a - b);
}

/** Upper structure triad voicing - major triad superimposed over dominant b7.
 *  Standard jazz technique: E/C7 = altered, D/C7 = Lydian dom, etc.
 *  Layout: b7 anchor on bottom, triad placed above with voice-leading optimization. */
export function buildUpperStructureVoicing(
  root: string,
  quality: string,
  prevPitches: number[] | null,
): number[] {
  const r = rootMidi(root);
  const q = quality.replace(/\/.*$/, "");

  // Match quality to UST key in specificity order
  let ustKey = "7";
  if (q.includes("#11") || q.includes("lyd")) ustKey = "7#11";
  else if (q.includes("alt")) ustKey = "7alt";
  else if (q.includes("b9") && !q.includes("#9")) ustKey = "7b9";
  else if (q.includes("#9")) ustKey = "7#9";
  else if (q.includes("#5") || q.includes("aug")) ustKey = "7#5";
  else if (q.includes("b5")) ustKey = "7#11"; // b5 = #11 enharmonic (Lydian dominant)

  const ustCandidates = UST_TRIADS[ustKey] ?? UST_TRIADS["7"];
  const entry = ustCandidates[Math.floor(_voicingRng() * ustCandidates.length)];
  const [pcA, pcB, pcC] = entry.triadPCs;

  // Build 3 inversions: ascending close-position per rotation
  const b7 = 10;
  const inversions: number[][] = [];
  const rawPCs = [pcA, pcB, pcC];
  for (let inv = 0; inv < 3; inv++) {
    const rotated = [rawPCs[inv % 3], rawPCs[(inv + 1) % 3], rawPCs[(inv + 2) % 3]];
    // Each triad note placed above the previous (ascending close-position)
    const placed: number[] = [b7];
    let floor = b7;
    for (const pc of rotated) {
      let note = pc;
      while (note <= floor) note += 12;
      placed.push(note);
      floor = note;
    }
    inversions.push(placed);
  }

  // Filter: span <= 15 AND no semitone clusters (adjacent gap >= 2)
  const valid = inversions.filter(inv => {
    if (inv[inv.length - 1] - inv[0] > 15) return false;
    for (let i = 1; i < inv.length; i++) {
      if (inv[i] - inv[i - 1] < 2) return false;
    }
    return true;
  });
  if (valid.length === 0) {
    return buildStandardVoicing(root, quality, prevPitches, false);
  }

  // Place each valid inversion in piano range and pick best voice-leading
  const base = 60 + r;
  const candidates: number[][] = [];
  const isClean = (ps: number[]) => {
    for (let i = 1; i < ps.length; i++) if (ps[i] - ps[i - 1] < 2) return false;
    return ps[ps.length - 1] - ps[0] <= 15;
  };
  for (const inv of valid) {
    let pitches = inv.map(i => {
      let p = base + i;
      while (p > _voicingHigh) p -= 12;
      while (p < _voicingLow) p += 12;
      return p;
    });
    pitches = [...new Set(pitches)].sort((a, b) => a - b);
    // Octave clamping can introduce new clusters - recheck
    if (!isClean(pitches)) continue;
    candidates.push(pitches);

    // Also try octave-shifted variant for better voice leading
    if (prevPitches) {
      const prevCenter = prevPitches.reduce((s, p) => s + p, 0) / prevPitches.length;
      const currCenter = pitches.reduce((s, p) => s + p, 0) / pitches.length;
      const shift = Math.round((prevCenter - currCenter) / 12) * 12;
      if (shift !== 0) {
        const shifted = pitches.map(p => p + shift);
        if (shifted.every(p => p >= _voicingLow && p <= _voicingHigh) && isClean(shifted)) {
          candidates.push(shifted);
        }
      }
    }
  }
  if (candidates.length === 0) {
    return buildStandardVoicing(root, quality, prevPitches, false);
  }

  // Pick candidate with best voice leading
  if (prevPitches && candidates.length > 1) {
    let bestDist = Infinity;
    let best = candidates[0];
    for (const c of candidates) {
      const dist = voiceLeadingDistance(prevPitches, c);
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    return best;
  }
  return candidates[0];
}

/** Check if root motion is V-I (up a perfect 4th = 5 semitones). */
export function isResolvingDominant(currentRoot: string, nextRoot: string): boolean {
  return (rootMidi(nextRoot) - rootMidi(currentRoot) + 12) % 12 === 5;
}

/** Pick best voicing type based on style, with variety tracking.
 *  `lastType` is a mutable ref [value] — avoids picking same voicing type consecutively. */
export function pickVoicing(
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
    let roll = _voicingRng() * total;
    let chosen = options.length - 1;
    for (let i = 0; i < options.length; i++) {
      roll -= options[i][0];
      if (roll <= 0) { chosen = i; break; }
    }
    // If same as last type and there are alternatives, re-roll once
    if (lastType && chosen === lastType[0] && options.length > 1) {
      const alt = (chosen + 1 + Math.floor(_voicingRng() * (options.length - 1))) % options.length;
      chosen = alt;
    }
    if (lastType) lastType[0] = chosen;
    return options[chosen][1]();
  };

  const isDom = isDominantQuality(quality);
  const ustBuilder = () => buildUpperStructureVoicing(root, quality, prevPitches);

  // Tritone substitution: on resolving dominants, build voicing from bII root instead.
  // Creates chromatic voice leading and altered color. Style-gated.
  if (resolving && isDom) {
    const triWeight = tritoneSubPianoWeight(style);
    if (triWeight > 0 && _voicingRng() < triWeight) {
      const triRootMidi = (rootMidi(root) + 6) % 12;
      const triRoot = MIDI_TO_ROOT[triRootMidi];
      return buildStandardVoicing(triRoot, "7", prevPitches, shell, false);
    }
  }

  // Pat Metheny: 65% wide open voicings (guitar translation), 35% quartal (variety)
  if (style === "metheny") {
    const opts: [number, () => number[]][] = [
      [65, () => buildOpenVoicing(root, quality)],
      [35, () => buildQuartalVoicing(root, quality)],
    ];
    if (isDom) opts.push([20, ustBuilder]);
    return pickWithVariety(opts);
  }

  // Alfa Mist: 45% cluster (tight, dreamy), 20% warm inversions (1st/2nd inv + 9th),
  // 35% standard Evans (variety). Self-taught ear-based voicing approach.
  if (style === "alfaMist") {
    const opts: [number, () => number[]][] = [
      [45, () => buildClusterVoicing(root, quality)],
      [20, () => buildAlfaMistInversionVoicing(root, quality)],
      [35, () => buildStandardVoicing(root, quality, prevPitches, shell)],
    ];
    if (isDom) opts.push([10, ustBuilder]);
    return pickWithVariety(opts);
  }

  // Modal: 60% quartal (McCoy Tyner), 40% standard rootless (variety)
  if (style === "modal") {
    const opts: [number, () => number[]][] = [
      [60, () => buildQuartalVoicing(root, quality)],
      [40, () => buildStandardVoicing(root, quality, prevPitches, shell)],
    ];
    if (isDom) opts.push([15, ustBuilder]);
    return pickWithVariety(opts);
  }

  // ECM: 70% quartal (Nordic clarity), 30% standard
  if (style === "ecm") {
    const opts: [number, () => number[]][] = [
      [70, () => buildQuartalVoicing(root, quality)],
      [30, () => buildStandardVoicing(root, quality, prevPitches, shell)],
    ];
    if (isDom) opts.push([10, ustBuilder]);
    return pickWithVariety(opts);
  }

  // Cool Jazz: always shell voicings (2-note guide tones) for lighter texture
  if (style === "coolJazz") {
    return buildStandardVoicing(root, quality, prevPitches, true);
  }

  // Holdsworth: 40% open 5ths (wide intervals), 35% quartal (4th stacks), 25% open voicings
  if (style === "holdsworth") {
    const opts: [number, () => number[]][] = [
      [40, () => buildOpen5thsVoicing(root, quality)],
      [35, () => buildQuartalVoicing(root, quality)],
      [25, () => buildOpenVoicing(root, quality)],
    ];
    if (isDom) opts.push([15, ustBuilder]);
    return pickWithVariety(opts);
  }

  // Fusion: 50% quartal (Herbie Hancock), 50% open voicings
  if (style === "fusion") {
    const opts: [number, () => number[]][] = [
      [50, () => buildQuartalVoicing(root, quality)],
      [50, () => buildOpenVoicing(root, quality)],
    ];
    if (isDom) opts.push([25, ustBuilder]);
    return pickWithVariety(opts);
  }

  // Neo-Soul: 55% cluster voicings (Glasper, higher register), 45% standard
  if (style === "neoSoul" && _voicingRng() < 0.55) {
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

  // Default (swing, hardBop, bossa, latin, ballad, etc.): Evans rootless
  // On dominant chords, 20% chance of upper structure triad (not ballad - traditional guide tones)
  if (isDom && style !== "ballad") {
    return pickWithVariety([
      [80, () => buildStandardVoicing(root, quality, prevPitches, shell, resolving)],
      [20, ustBuilder],
    ]);
  }
  return buildStandardVoicing(root, quality, prevPitches, shell, resolving);
}

/** Reduce to 2-note shell voicing (3rd + 7th — the guide tones). */
export function toShellVoicing(pitches: number[]): number[] {
  if (pitches.length <= 2) return pitches;
  // Shell = lowest + third-by-pitch (3rd + 7th in rootless voicings, skipping 5th and tensions)
  const sorted = [...pitches].sort((a, b) => a - b);
  return [sorted[0], sorted[2] ?? sorted[1]];
}
