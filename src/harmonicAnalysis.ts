/**
 * Harmonic Analysis Engine
 *
 * Analyzes chord progressions to determine key centers, Roman numeral degrees,
 * harmonic function (tonic/predominant/dominant), ii-V-I patterns, cadences,
 * secondary dominants, modulations, and per-chord tension values.
 *
 * This data feeds into all three generators so they can make musically
 * intelligent decisions: bass approaches cadences differently, piano uses
 * altered voicings on resolving dominants, drums place fills at cadence points.
 */

import type {
  ChordEvent,
  ChordAnalysis,
  HarmonicFunction,
  HarmonicAnalysisResult,
} from "./types";
import {
  isDominant as isDominantQuality,
  isMinor as isMinorQuality,
  isDiminished as isDiminishedQuality,
  isHalfDiminished as isHalfDiminishedQuality,
} from "./chordQuality";

// ── Pitch Class Utilities ──

const NOTE_TO_PC: Record<string, number> = {
  "C": 0, "C#": 1, "Db": 1,
  "D": 2, "D#": 3, "Eb": 3,
  "E": 4, "Fb": 4, "E#": 5,
  "F": 5, "F#": 6, "Gb": 6,
  "G": 7, "G#": 8, "Ab": 8,
  "A": 9, "A#": 10, "Bb": 10,
  "B": 11, "Cb": 11, "B#": 0,
};

const PC_TO_NAME: string[] = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];

function rootToPC(root: string): number {
  return NOTE_TO_PC[root] ?? 0;
}

// ── Key Detection ──

/**
 * Detect the key center from a chord progression.
 *
 * Strategy:
 * 1. If keySignature hint provided and valid, use it
 * 2. Find all V-I root motions (P4 up = P5 down), count resolution targets
 * 3. Weight by duration and position (last chord gets bonus)
 * 4. Highest-scoring pitch class = key
 */
export function detectKeyCenter(chords: ChordEvent[], keyHint?: string): string {
  if (chords.length === 0) return keyHint ?? "C";

  // Trust the hint if provided
  if (keyHint && NOTE_TO_PC[keyHint] !== undefined) {
    return keyHint;
  }

  // Score each pitch class as potential key center
  const scores = new Array(12).fill(0);

  // Method 1: V-I resolution targets (strongest signal)
  for (let i = 0; i < chords.length - 1; i++) {
    const curr = chords[i];
    const next = chords[i + 1];
    const interval = (rootToPC(next.root) - rootToPC(curr.root) + 12) % 12;

    // V-I = root moves up P4 (5 semitones) or down P5 (7 semitones = same thing mod 12)
    if (interval === 5 && isDominantQuality(curr.quality)) {
      const targetPC = rootToPC(next.root);
      // Weight by duration of the resolution target
      scores[targetPC] += 3 + (next.duration > 1 ? 2 : 0);
    }
  }

  // Method 2: ii-V-I patterns (very strong signal)
  for (let i = 0; i < chords.length - 2; i++) {
    const a = chords[i], b = chords[i + 1], c = chords[i + 2];
    const abInterval = (rootToPC(b.root) - rootToPC(a.root) + 12) % 12;
    const bcInterval = (rootToPC(c.root) - rootToPC(b.root) + 12) % 12;

    if (abInterval === 5 && bcInterval === 5
      && isMinorQuality(a.quality) && isDominantQuality(b.quality)) {
      scores[rootToPC(c.root)] += 5;
    }
  }

  // Method 3: Last chord bonus (jazz standards usually end on I)
  const lastPC = rootToPC(chords[chords.length - 1].root);
  scores[lastPC] += 2;

  // Method 4: First chord bonus (weaker - many tunes start on non-I)
  scores[rootToPC(chords[0].root)] += 1;

  const bestPC = scores.indexOf(Math.max(...scores));
  return PC_TO_NAME[bestPC];
}

// ── Degree Assignment ──

/** Interval (semitones from key root) to scale degree label. */
function intervalToDegree(interval: number, quality: string): string {
  const minor = isMinorQuality(quality);
  const dim = isDiminishedQuality(quality) || isHalfDiminishedQuality(quality);
  const dom = isDominantQuality(quality);

  // Use lowercase for minor/diminished, uppercase for major/dominant
  const lowerCase = minor || dim;

  switch (interval) {
    case 0:  return lowerCase ? "i" : "I";
    case 1:  return dom ? "bII" : (lowerCase ? "bi" : "bII");
    case 2:  return lowerCase ? "ii" : "II";
    case 3:  return lowerCase ? "biii" : "bIII";
    case 4:  return lowerCase ? "iii" : "III";
    case 5:  return lowerCase ? "iv" : "IV";
    case 6:  return dom ? "#IV" : (lowerCase ? "#iv" : "#IV");
    case 7:  return lowerCase ? "v" : "V";
    case 8:  return lowerCase ? "bvi" : "bVI";
    case 9:  return lowerCase ? "vi" : "VI";
    case 10: return lowerCase ? "bvii" : "bVII";
    case 11: return dim ? "vii" : (lowerCase ? "vii" : "VII");
    default: return "?";
  }
}

/** Determine harmonic function from scale degree interval. */
function intervalToFunction(interval: number, quality: string): HarmonicFunction {
  const dom = isDominantQuality(quality);
  const dim = isDiminishedQuality(quality) || isHalfDiminishedQuality(quality);

  switch (interval) {
    case 0:  return "tonic";        // I
    case 1:  return dom ? "dominant" : "chromatic"; // bII (tritone sub) or Neapolitan
    case 2:  return "predominant";  // ii
    case 3:  return "tonic";        // bIII (parallel minor)
    case 4:  return "tonic";        // iii
    case 5:  return "predominant";  // IV
    case 6:  return "chromatic";    // #IV / bV
    case 7:  return dom || dim ? "dominant" : "chromatic"; // V
    case 8:  return "predominant";  // bVI (borrowed)
    case 9:  return "tonic";        // vi
    case 10: return "predominant";  // bVII (mixolydian)
    case 11: return dim ? "dominant" : "chromatic"; // vii (leading tone dim)
    default: return "chromatic";
  }
}

// ── ii-V-I Detection ──

interface IiViMatch {
  ii: number;
  V: number;
  I: number;
}

/**
 * Find all ii-V-I patterns in the progression.
 * Also detects ii-V (unresolved) and V-I (without ii).
 */
function detectIiVIs(chords: ChordEvent[]): IiViMatch[] {
  const matches: IiViMatch[] = [];
  const used = new Set<number>();

  // Pass 1: full ii-V-I
  for (let i = 0; i < chords.length - 2; i++) {
    const a = chords[i], b = chords[i + 1], c = chords[i + 2];
    const abInterval = (rootToPC(b.root) - rootToPC(a.root) + 12) % 12;
    const bcInterval = (rootToPC(c.root) - rootToPC(b.root) + 12) % 12;

    if (abInterval === 5 && bcInterval === 5
      && (isMinorQuality(a.quality) || isHalfDiminishedQuality(a.quality))
      && isDominantQuality(b.quality)) {
      matches.push({ ii: i, V: i + 1, I: i + 2 });
      used.add(i);
      used.add(i + 1);
      used.add(i + 2);
    }
  }

  // Pass 2: V-I without ii (only if not already part of a ii-V-I)
  for (let i = 0; i < chords.length - 1; i++) {
    if (used.has(i) || used.has(i + 1)) continue;
    const curr = chords[i], next = chords[i + 1];
    const interval = (rootToPC(next.root) - rootToPC(curr.root) + 12) % 12;

    if (interval === 5 && isDominantQuality(curr.quality)) {
      matches.push({ ii: -1, V: i, I: i + 1 });
      used.add(i);
      used.add(i + 1);
    }
  }

  return matches;
}

// ── Secondary Dominant Detection ──

/**
 * Detect secondary dominants: dominant-quality chords that resolve by P4 up
 * to a non-tonic diatonic target.
 */
function detectSecondaryDominants(
  chords: ChordEvent[],
  keyPC: number,
  analyses: ChordAnalysis[],
): void {
  for (let i = 0; i < chords.length - 1; i++) {
    const curr = chords[i];
    const next = chords[i + 1];
    const interval = (rootToPC(next.root) - rootToPC(curr.root) + 12) % 12;
    const currInterval = (rootToPC(curr.root) - keyPC + 12) % 12;

    // Must be dominant quality, must resolve up P4, must NOT be the diatonic V
    if (isDominantQuality(curr.quality) && interval === 5 && currInterval !== 7) {
      // The target must be a diatonic chord (not chromatic)
      if (analyses[i + 1].function !== "chromatic") {
        analyses[i].isSecondaryDominant = true;
        analyses[i].secondaryTarget = analyses[i + 1].degree;
        analyses[i].function = "dominant";
        // Raise tension for secondary dominants
        analyses[i].tension = Math.max(analyses[i].tension, 0.65);
      }
    }
  }
}

// ── Cadence Detection ──

/**
 * Detect cadences at natural phrase boundaries (every 4 or 8 bars).
 * Marks the 2-3 chords involved with cadenceRole and cadenceType.
 */
function detectCadences(
  chords: ChordEvent[],
  analyses: ChordAnalysis[],
  measureDuration: number,
): void {
  if (chords.length < 2 || measureDuration <= 0) return;

  // Check every pair of adjacent chords for cadential patterns
  for (let i = 0; i < chords.length - 1; i++) {
    const curr = analyses[i];
    const next = analyses[i + 1];
    const currInterval = (rootToPC(chords[i].root) - rootToPC(curr.keyCenter) + 12) % 12;
    const nextInterval = (rootToPC(chords[i + 1].root) - rootToPC(next.keyCenter) + 12) % 12;

    // Authentic cadence: V -> I (or vii -> I)
    if ((currInterval === 7 && isDominantQuality(chords[i].quality)) && nextInterval === 0) {
      curr.cadenceRole = "dominant";
      curr.cadenceType = "authentic";
      next.cadenceRole = "resolution";
      next.cadenceType = "authentic";
      // Boost tension on the dominant
      curr.tension = Math.max(curr.tension, 0.85);
      // Resolution is very stable
      next.tension = Math.min(next.tension, 0.1);
    }

    // Half cadence: anything -> V (phrase ends on V)
    if (nextInterval === 7 && isDominantQuality(chords[i + 1].quality)) {
      // Only mark if next chord is dominant and current is predominant or tonic
      if (curr.function === "predominant" || curr.function === "tonic") {
        curr.cadenceRole = "predominant";
        curr.cadenceType = "half";
        next.cadenceRole = "dominant";
        next.cadenceType = "half";
      }
    }

    // Deceptive cadence: V -> vi (or V -> bVI)
    if (currInterval === 7 && isDominantQuality(chords[i].quality)
      && (nextInterval === 9 || nextInterval === 8)) {
      curr.cadenceRole = "dominant";
      curr.cadenceType = "deceptive";
      next.cadenceRole = "resolution";
      next.cadenceType = "deceptive";
      // Deceptive resolution is partially stable
      next.tension = 0.35;
    }

    // Plagal cadence: IV -> I
    if (currInterval === 5 && !isDominantQuality(chords[i].quality) && nextInterval === 0) {
      curr.cadenceRole = "predominant";
      curr.cadenceType = "plagal";
      next.cadenceRole = "resolution";
      next.cadenceType = "plagal";
    }

    // Mark predominant before a cadential dominant (ii -> V -> I)
    if (i > 0 && curr.cadenceRole === "dominant" && curr.cadenceType === "authentic") {
      const prevInterval = (rootToPC(chords[i - 1].root) - rootToPC(analyses[i - 1].keyCenter) + 12) % 12;
      if (prevInterval === 2 && isMinorQuality(chords[i - 1].quality)) {
        analyses[i - 1].cadenceRole = "predominant";
        analyses[i - 1].cadenceType = "authentic";
      }
    }
  }
}

// ── Modulation Detection ──

interface KeyRegion {
  key: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Detect key center changes by analyzing ii-V-I patterns in windows.
 * If a window's ii-V-I targets differ from the global key, mark modulation.
 */
function detectModulations(
  chords: ChordEvent[],
  globalKeyPC: number,
  iiVIs: IiViMatch[],
): KeyRegion[] {
  if (chords.length === 0) return [{ key: PC_TO_NAME[globalKeyPC], startIndex: 0, endIndex: 0 }];

  // Start with one region covering everything
  const regions: KeyRegion[] = [
    { key: PC_TO_NAME[globalKeyPC], startIndex: 0, endIndex: chords.length - 1 },
  ];

  if (iiVIs.length < 2) return regions;

  // Find ii-V-I patterns targeting different keys
  const fullIiVIs = iiVIs.filter(m => m.ii >= 0); // only complete ii-V-I
  if (fullIiVIs.length < 2) return regions;

  // Group consecutive ii-V-Is by their target (I chord root)
  let currentKey = globalKeyPC;
  let regionStart = 0;
  const detailedRegions: KeyRegion[] = [];

  for (const match of fullIiVIs) {
    const targetPC = rootToPC(chords[match.I].root);
    if (targetPC !== currentKey) {
      // Key change detected
      detailedRegions.push({
        key: PC_TO_NAME[currentKey],
        startIndex: regionStart,
        endIndex: match.ii - 1,
      });
      currentKey = targetPC;
      regionStart = match.ii;
    }
  }

  // Close last region
  detailedRegions.push({
    key: PC_TO_NAME[currentKey],
    startIndex: regionStart,
    endIndex: chords.length - 1,
  });

  // Only use detailed regions if there's actually more than one key
  if (detailedRegions.length > 1) return detailedRegions;
  return regions;
}

// ── Tension Computation ──

/** Base tension from harmonic function and degree. */
function baseTension(interval: number, quality: string): number {
  const dom = isDominantQuality(quality);
  const dim = isDiminishedQuality(quality) || isHalfDiminishedQuality(quality);

  switch (interval) {
    case 0:  return 0.05;  // I - home, very stable
    case 1:  return dom ? 0.75 : 0.5;  // bII (tritone sub = high tension, Neapolitan = moderate)
    case 2:  return 0.3;   // ii - mild preparation
    case 3:  return 0.2;   // bIII - stable (modal interchange)
    case 4:  return 0.15;  // iii - relatively stable
    case 5:  return dom ? 0.55 : 0.3;  // IV - predominant
    case 6:  return 0.6;   // #IV/bV - unstable
    case 7:  return dom ? 0.75 : 0.35; // V - high tension if dominant quality
    case 8:  return 0.35;  // bVI - moderate
    case 9:  return 0.1;   // vi - stable (tonic function)
    case 10: return 0.4;   // bVII - moderate (mixolydian)
    case 11: return dim ? 0.65 : 0.4;  // vii - unstable if diminished
    default: return 0.5;
  }
}

// ── Main Entry Point ──

/**
 * Analyze a chord progression for harmonic content.
 *
 * Returns per-chord analysis (degree, function, tension, ii-V-I membership,
 * cadences, secondary dominants) plus global summary (key centers, harmonic
 * rhythm).
 *
 * @param chords - Chord events to analyze
 * @param keyHint - Optional key signature hint (trusted if provided)
 * @param measureDuration - Duration of one measure in seconds (for cadence detection)
 * @returns Complete harmonic analysis
 */
export function analyzeHarmony(
  chords: ChordEvent[],
  keyHint?: string,
  measureDuration = 0,
): HarmonicAnalysisResult {
  if (chords.length === 0) {
    return {
      keyCenter: keyHint ?? "C",
      keyCenters: [],
      chordAnalyses: [],
      iiViLocations: [],
      harmonicRhythm: 0,
    };
  }

  // Step 1: Detect global key
  const keyCenter = detectKeyCenter(chords, keyHint);
  const keyPC = rootToPC(keyCenter);

  // Step 2: Detect ii-V-I patterns
  const iiVIs = detectIiVIs(chords);

  // Step 3: Detect modulations (key regions)
  const keyCenters = detectModulations(chords, keyPC, iiVIs);

  // Step 4: Assign degree and function per chord (using local key center)
  const analyses: ChordAnalysis[] = chords.map((chord, idx) => {
    // Find which key region this chord belongs to
    const region = keyCenters.find(r => idx >= r.startIndex && idx <= r.endIndex);
    const localKey = region?.key ?? keyCenter;
    const localKeyPC = rootToPC(localKey);

    const interval = (rootToPC(chord.root) - localKeyPC + 12) % 12;
    const degree = intervalToDegree(interval, chord.quality);
    const func = intervalToFunction(interval, chord.quality);
    const tension = baseTension(interval, chord.quality);

    return {
      degree,
      function: func,
      keyCenter: localKey,
      isSecondaryDominant: false,
      isPartOfIiVI: false,
      isModulationPoint: false,
      tension,
    };
  });

  // Step 5: Mark ii-V-I membership
  for (const match of iiVIs) {
    if (match.ii >= 0) {
      analyses[match.ii].isPartOfIiVI = true;
      analyses[match.ii].iiViPosition = "ii";
      // Raise tension slightly on ii (it's going somewhere)
      analyses[match.ii].tension = Math.max(analyses[match.ii].tension, 0.35);
    }
    analyses[match.V].isPartOfIiVI = true;
    analyses[match.V].iiViPosition = "V";
    // V in ii-V-I has high tension
    analyses[match.V].tension = Math.max(analyses[match.V].tension, 0.8);

    if (match.ii >= 0) {
      analyses[match.I].isPartOfIiVI = true;
      analyses[match.I].iiViPosition = "I";
      // Resolution is stable
      analyses[match.I].tension = Math.min(analyses[match.I].tension, 0.1);
    }
  }

  // Step 6: Detect secondary dominants
  detectSecondaryDominants(chords, keyPC, analyses);

  // Step 7: Detect cadences
  detectCadences(chords, analyses, measureDuration);

  // Step 8: Mark modulation points
  for (let i = 1; i < keyCenters.length; i++) {
    const startIdx = keyCenters[i].startIndex;
    if (startIdx >= 0 && startIdx < analyses.length) {
      analyses[startIdx].isModulationPoint = true;
    }
  }

  // Step 9: Compute harmonic rhythm
  const totalDuration = chords.reduce((sum, c) => sum + c.duration, 0);
  const harmonicRhythm = measureDuration > 0
    ? chords.length / (totalDuration / measureDuration)
    : chords.length > 0 ? 1 : 0;

  return {
    keyCenter,
    keyCenters,
    chordAnalyses: analyses,
    iiViLocations: iiVIs,
    harmonicRhythm,
  };
}
