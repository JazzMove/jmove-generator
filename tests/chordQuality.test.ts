import { describe, it, expect } from "vitest";
import {
  parseQuality,
  getChordIntervals,
  getQualityScale,
  classifyQuality,
  isDominant,
  isMinor,
  isDiminished,
  isHalfDiminished,
  SCALES,
  type QualityFamily,
} from "../src/chordQuality";

// ── Known quality interval round-trips ──

describe("parseQuality - known qualities", () => {
  const cases: [string, number[], QualityFamily][] = [
    // Major family
    ["",        [0, 4, 7],      "major"],
    ["maj7",    [0, 4, 7, 11],  "major"],
    ["maj9",    [0, 4, 7, 11],  "major"],
    ["maj13",   [0, 4, 7, 11],  "major"],
    ["maj7#11", [0, 4, 7, 11],  "major"],
    ["maj7#5",  [0, 4, 8, 11],  "major"],
    ["6",       [0, 4, 7, 9],   "major"],
    ["69",      [0, 4, 7, 9],   "major"],
    ["6/9",     [0, 4, 7, 9],   "major"],
    ["add9",    [0, 4, 7],      "major"],
    ["5",       [0, 7],         "power"],

    // Minor family
    ["m",       [0, 3, 7],      "minor"],
    ["m7",      [0, 3, 7, 10],  "minor"],
    ["m9",      [0, 3, 7, 10],  "minor"],
    ["m6",      [0, 3, 7, 9],   "minor"],
    ["m6/9",    [0, 3, 7, 9],   "minor"],
    ["m(maj7)", [0, 3, 7, 11],  "minor"],
    ["m11",     [0, 3, 7, 10],  "minor"],

    // Dominant family
    ["7",       [0, 4, 7, 10],  "dominant"],
    ["9",       [0, 4, 7, 10],  "dominant"],
    ["13",      [0, 4, 7, 10],  "dominant"],
    ["7b9",     [0, 4, 7, 10],  "dominant"],
    ["7#9",     [0, 4, 7, 10],  "dominant"],
    ["7b5",     [0, 4, 6, 10],  "dominant"],
    ["7#5",     [0, 4, 8, 10],  "dominant"],
    ["7alt",    [0, 4, 8, 10],  "dominant"],
    ["7b13",    [0, 4, 7, 10],  "dominant"],
    ["7#11",    [0, 4, 7, 10],  "dominant"],
    ["7b9b13",  [0, 4, 7, 10],  "dominant"],
    ["7#9b13",  [0, 4, 7, 10],  "dominant"],
    ["7b9#11",  [0, 4, 7, 10],  "dominant"],
    ["7#9#11",  [0, 4, 7, 10],  "dominant"],
    ["7#9b5",   [0, 4, 6, 10],  "dominant"],
    ["7b9b5",   [0, 4, 6, 10],  "dominant"],
    ["aug7",    [0, 4, 8, 10],  "dominant"],

    // Suspended family
    ["sus4",    [0, 5, 7],      "suspended"],
    ["7sus",    [0, 5, 7, 10],  "suspended"],
    ["7sus4",   [0, 5, 7, 10],  "suspended"],
    ["9sus4",   [0, 5, 7, 10],  "suspended"],
    ["13sus4",  [0, 5, 7, 10],  "suspended"],
    ["sus2",    [0, 2, 7],      "suspended"],

    // Diminished
    ["dim",     [0, 3, 6],      "diminished"],
    ["dim7",    [0, 3, 6, 9],   "diminished"],

    // Half-diminished
    ["m7b5",    [0, 3, 6, 10],  "halfDiminished"],

    // Augmented
    ["aug",     [0, 4, 8],      "augmented"],
  ];

  for (const [quality, expectedIntervals, expectedFamily] of cases) {
    it(`"${quality}" → intervals ${JSON.stringify(expectedIntervals)}, family ${expectedFamily}`, () => {
      const parsed = parseQuality(quality);
      expect(parsed.intervals).toEqual(expectedIntervals);
      expect(parsed.family).toBe(expectedFamily);
    });
  }
});

// ── iReal Pro symbol normalization ──

describe("parseQuality - iReal Pro symbols", () => {
  it("o → dim", () => {
    expect(parseQuality("o").intervals).toEqual([0, 3, 6]);
    expect(parseQuality("o").family).toBe("diminished");
  });

  it("o7 → dim7", () => {
    expect(parseQuality("o7").intervals).toEqual([0, 3, 6, 9]);
    expect(parseQuality("o7").family).toBe("diminished");
  });

  it("h → m7b5 (half-diminished)", () => {
    expect(parseQuality("h").intervals).toEqual([0, 3, 6, 10]);
    expect(parseQuality("h").family).toBe("halfDiminished");
  });

  it("h7 → m7b5", () => {
    expect(parseQuality("h7").intervals).toEqual([0, 3, 6, 10]);
  });

  it("0 → m7b5 (numeric zero)", () => {
    expect(parseQuality("0").intervals).toEqual([0, 3, 6, 10]);
    expect(parseQuality("0").family).toBe("halfDiminished");
  });

  it("07 → m7b5", () => {
    expect(parseQuality("07").intervals).toEqual([0, 3, 6, 10]);
  });

  it("ø → m7b5 (Unicode)", () => {
    expect(parseQuality("ø").intervals).toEqual([0, 3, 6, 10]);
    expect(parseQuality("ø").family).toBe("halfDiminished");
  });

  it("ø7 → m7b5", () => {
    expect(parseQuality("ø7").intervals).toEqual([0, 3, 6, 10]);
  });

  it("^7 → maj7 (caret)", () => {
    expect(parseQuality("^7").intervals).toEqual([0, 4, 7, 11]);
    expect(parseQuality("^7").family).toBe("major");
  });

  it("^ → maj7", () => {
    expect(parseQuality("^").intervals).toEqual([0, 4, 7, 11]);
  });

  it("+ → aug", () => {
    expect(parseQuality("+").intervals).toEqual([0, 4, 8]);
    expect(parseQuality("+").family).toBe("augmented");
  });

  it("+7 → aug7 (dominant)", () => {
    expect(parseQuality("+7").intervals).toEqual([0, 4, 8, 10]);
    expect(parseQuality("+7").family).toBe("dominant");
  });

  it("- → m (dash minor)", () => {
    expect(parseQuality("-").intervals).toEqual([0, 3, 7]);
    expect(parseQuality("-").family).toBe("minor");
  });

  it("-7 → m7", () => {
    expect(parseQuality("-7").intervals).toEqual([0, 3, 7, 10]);
    expect(parseQuality("-7").family).toBe("minor");
  });

  it("-9 → m9", () => {
    expect(parseQuality("-9").intervals).toEqual([0, 3, 7, 10]);
  });

  it("-11 → m11", () => {
    expect(parseQuality("-11").intervals).toEqual([0, 3, 7, 10]);
  });

  it("-(maj7) → m(maj7)", () => {
    expect(parseQuality("-(maj7)").intervals).toEqual([0, 3, 7, 11]);
  });

  it("-^7 → m(maj7)", () => {
    expect(parseQuality("-^7").intervals).toEqual([0, 3, 7, 11]);
  });

  it("-maj7 → m(maj7)", () => {
    expect(parseQuality("-maj7").intervals).toEqual([0, 3, 7, 11]);
    expect(parseQuality("-maj7").family).toBe("minor");
  });

  it("-6 → m6 (dash catch-all)", () => {
    expect(parseQuality("-6").intervals).toEqual([0, 3, 7, 9]);
    expect(parseQuality("-6").family).toBe("minor");
  });

  it("-69 → m69 (dash catch-all)", () => {
    expect(parseQuality("-69").intervals).toEqual([0, 3, 7, 9]);
    expect(parseQuality("-69").family).toBe("minor");
  });

  it("-b5 → mb5 (dash catch-all)", () => {
    const parsed = parseQuality("-b5");
    expect(parsed.family).toBe("minor");
    expect(parsed.intervals).toContain(3); // minor 3rd
  });
});

// ── Slash chord handling ──

describe("parseQuality - slash chords", () => {
  it("strips slash bass note (maj7/E → maj7)", () => {
    expect(parseQuality("maj7/E").intervals).toEqual([0, 4, 7, 11]);
    expect(parseQuality("maj7/E").family).toBe("major");
  });

  it("strips slash bass with accidental (7/Bb → 7)", () => {
    expect(parseQuality("7/Bb").intervals).toEqual([0, 4, 7, 10]);
  });

  it("strips slash bass with sharp (m7/F# → m7)", () => {
    expect(parseQuality("m7/F#").intervals).toEqual([0, 3, 7, 10]);
  });

  it("preserves 6/9 (not a slash chord)", () => {
    expect(parseQuality("6/9").intervals).toEqual([0, 4, 7, 9]);
    expect(parseQuality("6/9").family).toBe("major");
  });

  it("preserves m6/9", () => {
    expect(parseQuality("m6/9").intervals).toEqual([0, 3, 7, 9]);
  });
});

// ── Scale selection ──

describe("parseQuality - scale selection", () => {
  it("major → ionian", () => {
    expect(parseQuality("maj7").scale).toEqual(SCALES.ionian);
  });

  it("major #11 → lydian", () => {
    expect(parseQuality("maj7#11").scale).toEqual(SCALES.lydian);
  });

  it("minor → dorian", () => {
    expect(parseQuality("m7").scale).toEqual(SCALES.dorian);
  });

  it("minor maj7 → melodic minor", () => {
    expect(parseQuality("m(maj7)").scale).toEqual(SCALES.melodicMinor);
  });

  it("dominant → mixolydian", () => {
    expect(parseQuality("7").scale).toEqual(SCALES.mixolydian);
  });

  it("dominant alt → altered", () => {
    expect(parseQuality("7alt").scale).toEqual(SCALES.altered);
  });

  it("dominant #11 → lydian dominant", () => {
    expect(parseQuality("7#11").scale).toEqual(SCALES.lydianDom);
  });

  it("dominant b9 → half-whole diminished", () => {
    expect(parseQuality("7b9").scale).toEqual(SCALES.hwDim);
  });

  it("half-diminished → locrian nat2", () => {
    expect(parseQuality("m7b5").scale).toEqual(SCALES.locrianNat2);
  });

  it("diminished → whole-half diminished", () => {
    expect(parseQuality("dim7").scale).toEqual(SCALES.diminishedWH);
  });

  it("augmented → whole tone", () => {
    expect(parseQuality("aug").scale).toEqual(SCALES.wholeTone);
  });

  it("suspended → mixolydian", () => {
    expect(parseQuality("sus4").scale).toEqual(SCALES.mixolydian);
  });

  it("power → ionian", () => {
    expect(parseQuality("5").scale).toEqual(SCALES.ionian);
  });
});

// ── Algorithmic parsing of unknown qualities ──

describe("parseQuality - algorithmic (unknown qualities)", () => {
  it("parses unknown minor extension (m13)", () => {
    const parsed = parseQuality("m13");
    expect(parsed.family).toBe("minor");
    // Should produce minor chord tones with b7
    expect(parsed.intervals).toEqual([0, 3, 7, 10]);
  });

  it("parses unknown dominant extension (11)", () => {
    const parsed = parseQuality("11");
    expect(parsed.family).toBe("dominant");
    expect(parsed.intervals).toEqual([0, 4, 7, 10]);
  });

  it("parses unknown dominant combo (7#9#5)", () => {
    const parsed = parseQuality("7#9#5");
    expect(parsed.family).toBe("dominant");
    // #5 reflected in chord tones
    expect(parsed.intervals).toEqual([0, 4, 8, 10]);
  });

  it("parses unknown quality (maj7b5)", () => {
    const parsed = parseQuality("maj7b5");
    expect(parsed.family).toBe("major");
    expect(parsed.intervals).toEqual([0, 4, 6, 11]);
  });

  it("parses unknown sus variant (sus4b7)", () => {
    const parsed = parseQuality("sus4b7");
    expect(parsed.family).toBe("suspended");
    // sus4 + b7
    expect(parsed.intervals).toEqual([0, 5, 7, 10]);
  });

  it("parses unknown diminished variant (dimmaj7)", () => {
    const parsed = parseQuality("dimmaj7");
    expect(parsed.family).toBe("diminished");
    // dim triad + maj7
    expect(parsed.intervals).toEqual([0, 3, 6, 11]);
  });

  it("maj11 gets major 7th (not minor)", () => {
    const parsed = parseQuality("maj11");
    expect(parsed.family).toBe("major");
    expect(parsed.intervals).toEqual([0, 4, 7, 11]); // major 7th, not minor
  });

  it("maj13 (unknown path) gets major 7th", () => {
    // "maj13" IS in KNOWN, but verify algorithmic would agree
    const parsed = parseQuality("maj13");
    expect(parsed.intervals).toEqual([0, 4, 7, 11]);
  });

  it("algorithmic result cached on second call", () => {
    const first = parseQuality("unknownQuality123");
    const second = parseQuality("unknownQuality123");
    expect(first).toBe(second); // same reference
  });

  it("cached result is frozen (immutable)", () => {
    const parsed = parseQuality("m7");
    expect(() => { (parsed.intervals as number[]).push(99); }).toThrow();
    expect(() => { (parsed.scale as number[]).push(99); }).toThrow();
    expect(() => { (parsed as { family: string }).family = "bogus"; }).toThrow();
  });
});

// ── Predicate functions ──

describe("isDominant", () => {
  const dominants = ["7", "9", "13", "7b9", "7#9", "7alt", "7b5", "7#5", "aug7",
    "7b13", "7#11", "7b9b13", "7#9b13", "7b9#11", "7#9#11", "7#9b5", "7b9b5"];
  const nonDominants = ["", "maj7", "m7", "m", "dim", "dim7", "m7b5", "aug",
    "sus4", "7sus", "6", "5", "add9", "m(maj7)"];

  for (const q of dominants) {
    it(`"${q}" is dominant`, () => expect(isDominant(q)).toBe(true));
  }
  for (const q of nonDominants) {
    it(`"${q}" is NOT dominant`, () => expect(isDominant(q)).toBe(false));
  }
});

describe("isMinor", () => {
  const minors = ["m", "m7", "m9", "m6", "m11", "m(maj7)", "dim", "dim7"];
  const nonMinors = ["", "maj7", "7", "aug", "sus4", "m7b5", "5"];

  for (const q of minors) {
    it(`"${q}" is minor`, () => expect(isMinor(q)).toBe(true));
  }
  for (const q of nonMinors) {
    it(`"${q}" is NOT minor`, () => expect(isMinor(q)).toBe(false));
  }
});

describe("isDiminished", () => {
  const dims = ["dim", "dim7", "o", "o7"];
  const nonDims = ["m7b5", "m7", "7", "aug", "m"];

  for (const q of dims) {
    it(`"${q}" is diminished`, () => expect(isDiminished(q)).toBe(true));
  }
  for (const q of nonDims) {
    it(`"${q}" is NOT diminished`, () => expect(isDiminished(q)).toBe(false));
  }
});

describe("isHalfDiminished", () => {
  const halfDims = ["m7b5", "h", "h7", "0", "07", "ø", "ø7"];
  const nonHalfDims = ["dim", "dim7", "m7", "7", "m"];

  for (const q of halfDims) {
    it(`"${q}" is half-diminished`, () => expect(isHalfDiminished(q)).toBe(true));
  }
  for (const q of nonHalfDims) {
    it(`"${q}" is NOT half-diminished`, () => expect(isHalfDiminished(q)).toBe(false));
  }
});

// ── Convenience functions ──

describe("getChordIntervals", () => {
  it("returns same intervals as parseQuality", () => {
    expect(getChordIntervals("m7")).toEqual(parseQuality("m7").intervals);
    expect(getChordIntervals("7alt")).toEqual(parseQuality("7alt").intervals);
  });
});

describe("getQualityScale", () => {
  it("returns same scale as parseQuality", () => {
    expect(getQualityScale("m7")).toEqual(parseQuality("m7").scale);
    expect(getQualityScale("7alt")).toEqual(parseQuality("7alt").scale);
  });
});

describe("classifyQuality", () => {
  it("returns same family as parseQuality", () => {
    expect(classifyQuality("m7")).toBe("minor");
    expect(classifyQuality("7")).toBe("dominant");
    expect(classifyQuality("maj7")).toBe("major");
    expect(classifyQuality("dim7")).toBe("diminished");
    expect(classifyQuality("m7b5")).toBe("halfDiminished");
  });
});

// ── Backward compatibility with walkingBass.ts ──

describe("backward compat - walkingBass CHORD_TONES equivalence", () => {
  // Every entry from the old CHORD_TONES constant must produce identical intervals
  const oldChordTones: Record<string, number[]> = {
    "": [0, 4, 7], "maj7": [0, 4, 7, 11], "maj9": [0, 4, 7, 11],
    "maj13": [0, 4, 7, 11], "maj7#11": [0, 4, 7, 11], "maj7#5": [0, 4, 8, 11],
    "6": [0, 4, 7, 9], "69": [0, 4, 7, 9], "6/9": [0, 4, 7, 9],
    "add9": [0, 4, 7], "5": [0, 7],
    "m": [0, 3, 7], "m7": [0, 3, 7, 10], "m9": [0, 3, 7, 10],
    "m6": [0, 3, 7, 9], "m6/9": [0, 3, 7, 9], "m(maj7)": [0, 3, 7, 11],
    "m11": [0, 3, 7, 10],
    "7": [0, 4, 7, 10], "9": [0, 4, 7, 10], "13": [0, 4, 7, 10],
    "7b9": [0, 4, 7, 10], "7#9": [0, 4, 7, 10], "7b5": [0, 4, 6, 10],
    "7#5": [0, 4, 8, 10], "7alt": [0, 4, 8, 10], "7b13": [0, 4, 7, 10],
    "7#11": [0, 4, 7, 10], "7b9b13": [0, 4, 7, 10], "7#9b13": [0, 4, 7, 10],
    "7b9#11": [0, 4, 7, 10], "7#9#11": [0, 4, 7, 10],
    "7#9b5": [0, 4, 6, 10], "7b9b5": [0, 4, 6, 10], "aug7": [0, 4, 8, 10],
    "7sus": [0, 5, 7, 10], "7sus4": [0, 5, 7, 10], "9sus4": [0, 5, 7, 10],
    "13sus4": [0, 5, 7, 10], "sus4": [0, 5, 7], "sus2": [0, 2, 7],
    "dim": [0, 3, 6], "dim7": [0, 3, 6, 9], "m7b5": [0, 3, 6, 10],
    "aug": [0, 4, 8],
  };

  for (const [q, expected] of Object.entries(oldChordTones)) {
    it(`"${q}" matches old CHORD_TONES`, () => {
      expect(getChordIntervals(q)).toEqual(expected);
    });
  }
});

// ── Backward compatibility with harmonicAnalysis.ts predicates ──

describe("backward compat - harmonicAnalysis predicates", () => {
  // Test cases that mirror the old inline classifier behavior

  it("isDominant matches old isDominantQuality", () => {
    // The old function: strips slash, rejects m*, maj*, dim*, sus*, then checks 7/9/13
    expect(isDominant("7")).toBe(true);
    expect(isDominant("7/G")).toBe(true);     // slash stripped
    expect(isDominant("m7")).toBe(false);      // starts with m
    expect(isDominant("maj7")).toBe(false);    // contains maj
    expect(isDominant("dim7")).toBe(false);    // contains dim
    expect(isDominant("7sus")).toBe(false);    // contains sus
    expect(isDominant("9")).toBe(true);
    expect(isDominant("13")).toBe(true);
    expect(isDominant("aug7")).toBe(true);
  });

  it("isMinor matches old isMinorQuality", () => {
    // Old: rejects maj*, then checks m* or dim or dim7
    expect(isMinor("m7")).toBe(true);
    expect(isMinor("m")).toBe(true);
    expect(isMinor("dim")).toBe(true);
    expect(isMinor("dim7")).toBe(true);
    expect(isMinor("maj7")).toBe(false);
    expect(isMinor("7")).toBe(false);
  });

  it("isDiminished matches old isDiminishedQuality", () => {
    // Old: strips slash, exact matches dim/dim7/o/o7
    expect(isDiminished("dim")).toBe(true);
    expect(isDiminished("dim7")).toBe(true);
    expect(isDiminished("o")).toBe(true);
    expect(isDiminished("o7")).toBe(true);
    expect(isDiminished("m7b5")).toBe(false);
    expect(isDiminished("m")).toBe(false);
  });

  it("isHalfDiminished matches old isHalfDiminishedQuality", () => {
    // Old: strips slash, exact matches m7b5/h/h7/0/07
    expect(isHalfDiminished("m7b5")).toBe(true);
    expect(isHalfDiminished("h")).toBe(true);
    expect(isHalfDiminished("h7")).toBe(true);
    expect(isHalfDiminished("0")).toBe(true);
    expect(isHalfDiminished("07")).toBe(true);
    expect(isHalfDiminished("dim")).toBe(false);
    expect(isHalfDiminished("m7")).toBe(false);
  });
});
