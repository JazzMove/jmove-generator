import { describe, it, expect } from "vitest";
import { analyzeHarmony } from "../src/harmonicAnalysis";
import type { ChordEvent } from "../src/types";

// ── Helpers ──

/** Build chord events from a simple progression (1 chord per measure, 4/4 at 120bpm). */
function makeChords(progression: string[], tempo = 120): ChordEvent[] {
  const beatDur = 60 / tempo;
  const measureDur = 4 * beatDur;
  return progression.map((str, i) => {
    const match = str.match(/^([A-G][b#]?)(.*)$/);
    const root = match ? match[1] : "C";
    const quality = match ? match[2] : "";
    return { root, quality, time: i * measureDur, duration: measureDur };
  });
}

const MEASURE_DUR_120 = 4 * (60 / 120); // 2 seconds

// ── Key Detection ──

describe("Key Detection", () => {
  it("detects C major from simple ii-V-I", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, undefined, MEASURE_DUR_120);
    expect(result.keyCenter).toBe("C");
  });

  it("detects Bb from Autumn Leaves progression", () => {
    // Autumn Leaves: Cm7 F7 Bbmaj7 Ebmaj7 Am7b5 D7 Gm7
    const chords = makeChords(["Cm7", "F7", "Bbmaj7", "Ebmaj7", "Am7b5", "D7", "Gm7"]);
    const result = analyzeHarmony(chords, undefined, MEASURE_DUR_120);
    // Bb or Gm are both valid (relative major/minor) - Bb is the convention
    expect(["Bb", "G"]).toContain(result.keyCenter);
  });

  it("trusts key hint when provided", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "F", MEASURE_DUR_120);
    expect(result.keyCenter).toBe("F");
  });

  it("uses last chord as fallback for ambiguous progressions", () => {
    const chords = makeChords(["Cmaj7", "Dbmaj7", "Dmaj7", "Ebmaj7"]);
    const result = analyzeHarmony(chords, undefined, MEASURE_DUR_120);
    // Should favor Eb (last chord gets bonus)
    expect(result.keyCenter).toBe("Eb");
  });

  it("handles empty progression", () => {
    const result = analyzeHarmony([], undefined, MEASURE_DUR_120);
    expect(result.keyCenter).toBe("C");
    expect(result.chordAnalyses).toHaveLength(0);
  });

  it("handles single chord", () => {
    const chords = makeChords(["Gmaj7"]);
    const result = analyzeHarmony(chords, undefined, MEASURE_DUR_120);
    expect(result.keyCenter).toBe("G");
  });
});

// ── Degree Assignment ──

describe("Degree Assignment", () => {
  it("assigns correct degrees for C major ii-V-I", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].degree).toBe("ii");
    expect(result.chordAnalyses[1].degree).toBe("V");
    expect(result.chordAnalyses[2].degree).toBe("I");
  });

  it("assigns correct degrees for minor key", () => {
    const chords = makeChords(["Am7b5", "D7", "Gm7"]);
    const result = analyzeHarmony(chords, "G", MEASURE_DUR_120);
    // Am7b5 = ii in Gm, D7 = V, Gm7 = i
    expect(result.chordAnalyses[0].degree).toBe("ii");  // half-dim is minor-ish
    expect(result.chordAnalyses[1].degree).toBe("V");
    expect(result.chordAnalyses[2].degree).toBe("i");
  });

  it("handles bVII (mixolydian borrow)", () => {
    const chords = makeChords(["Cmaj7", "Bb7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[1].degree).toBe("bVII");
    // bVII is a dominant chord but functions as predominant in jazz
  });

  it("handles bIII (parallel minor borrow)", () => {
    const chords = makeChords(["Cmaj7", "Ebmaj7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[1].degree).toBe("bIII");
  });

  it("handles all 12 degrees", () => {
    // One chord on each chromatic degree from C
    const chords = makeChords([
      "Cmaj7", "Dbmaj7", "Dm7", "Ebmaj7", "Em7", "Fmaj7",
      "Gb7", "G7", "Abmaj7", "Am7", "Bb7", "Bdim7",
    ]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    const degrees = result.chordAnalyses.map(a => a.degree);
    expect(degrees[0]).toBe("I");
    expect(degrees[1]).toBe("bII");
    expect(degrees[2]).toBe("ii");
    expect(degrees[3]).toBe("bIII");
    expect(degrees[4]).toBe("iii");
    expect(degrees[5]).toBe("IV");
    expect(degrees[6]).toBe("#IV");  // Gb7 is dominant quality
    expect(degrees[7]).toBe("V");
    expect(degrees[8]).toBe("bVI");
    expect(degrees[9]).toBe("vi");
    expect(degrees[10]).toBe("bVII");
    expect(degrees[11]).toBe("vii");
  });
});

// ── Harmonic Function ──

describe("Harmonic Function", () => {
  it("assigns tonic to I, iii, vi", () => {
    const chords = makeChords(["Cmaj7", "Em7", "Am7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].function).toBe("tonic");
    expect(result.chordAnalyses[1].function).toBe("tonic");
    expect(result.chordAnalyses[2].function).toBe("tonic");
  });

  it("assigns predominant to ii, IV", () => {
    const chords = makeChords(["Dm7", "Fmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].function).toBe("predominant");
    expect(result.chordAnalyses[1].function).toBe("predominant");
  });

  it("assigns dominant to V7, vii dim", () => {
    const chords = makeChords(["G7", "Bdim7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].function).toBe("dominant");
    expect(result.chordAnalyses[1].function).toBe("dominant");
  });

  it("assigns dominant to bII7 (tritone sub)", () => {
    const chords = makeChords(["Db7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].function).toBe("dominant");
  });
});

// ── ii-V-I Detection ──

describe("ii-V-I Detection", () => {
  it("detects simple ii-V-I in C", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.iiViLocations).toHaveLength(1);
    expect(result.iiViLocations[0]).toEqual({ ii: 0, V: 1, I: 2 });
  });

  it("detects multiple ii-V-Is", () => {
    // Autumn Leaves has two: Cm7-F7-Bbmaj7 and Am7b5-D7-Gm7
    const chords = makeChords(["Cm7", "F7", "Bbmaj7", "Ebmaj7", "Am7b5", "D7", "Gm7"]);
    const result = analyzeHarmony(chords, "Bb", MEASURE_DUR_120);
    expect(result.iiViLocations.length).toBeGreaterThanOrEqual(2);
  });

  it("detects V-I without ii", () => {
    const chords = makeChords(["Cmaj7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    // G7 -> Cmaj7 should be detected as V-I (ii = -1)
    const viOnly = result.iiViLocations.filter(m => m.ii === -1);
    expect(viOnly.length).toBeGreaterThanOrEqual(1);
  });

  it("marks ii-V-I member chords", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].isPartOfIiVI).toBe(true);
    expect(result.chordAnalyses[0].iiViPosition).toBe("ii");
    expect(result.chordAnalyses[1].isPartOfIiVI).toBe(true);
    expect(result.chordAnalyses[1].iiViPosition).toBe("V");
    expect(result.chordAnalyses[2].isPartOfIiVI).toBe(true);
    expect(result.chordAnalyses[2].iiViPosition).toBe("I");
  });

  it("detects ii-V-I with half-diminished ii (minor key)", () => {
    const chords = makeChords(["Am7b5", "D7", "Gm7"]);
    const result = analyzeHarmony(chords, "G", MEASURE_DUR_120);
    expect(result.iiViLocations).toHaveLength(1);
    expect(result.iiViLocations[0].ii).toBe(0);
  });
});

// ── Secondary Dominants ──

describe("Secondary Dominants", () => {
  it("detects V/ii (A7 -> Dm7 in C)", () => {
    const chords = makeChords(["Cmaj7", "A7", "Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[1].isSecondaryDominant).toBe(true);
    expect(result.chordAnalyses[1].secondaryTarget).toBe("ii");
  });

  it("does NOT flag diatonic V as secondary dominant", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[1].isSecondaryDominant).toBe(false);
  });

  it("detects V/V (D7 -> G7 in C)", () => {
    const chords = makeChords(["Cmaj7", "D7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[1].isSecondaryDominant).toBe(true);
    expect(result.chordAnalyses[1].secondaryTarget).toBe("V");
  });
});

// ── Cadence Detection ──

describe("Cadence Detection", () => {
  it("detects authentic cadence (V-I)", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[1].cadenceType).toBe("authentic");
    expect(result.chordAnalyses[1].cadenceRole).toBe("dominant");
    expect(result.chordAnalyses[2].cadenceType).toBe("authentic");
    expect(result.chordAnalyses[2].cadenceRole).toBe("resolution");
  });

  it("detects deceptive cadence (V-vi)", () => {
    const chords = makeChords(["G7", "Am7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].cadenceType).toBe("deceptive");
    expect(result.chordAnalyses[1].cadenceType).toBe("deceptive");
  });

  it("detects plagal cadence (IV-I)", () => {
    const chords = makeChords(["Fmaj7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].cadenceType).toBe("plagal");
    expect(result.chordAnalyses[1].cadenceType).toBe("plagal");
  });

  it("marks predominant in ii-V-I cadence", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].cadenceRole).toBe("predominant");
    expect(result.chordAnalyses[0].cadenceType).toBe("authentic");
  });
});

// ── Tension Values ──

describe("Tension Values", () => {
  it("tonic has lowest tension", () => {
    const chords = makeChords(["Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].tension).toBeLessThan(0.2);
  });

  it("dominant V has high tension", () => {
    const chords = makeChords(["G7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].tension).toBeGreaterThanOrEqual(0.7);
  });

  it("V in ii-V-I has highest tension", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[1].tension).toBeGreaterThanOrEqual(0.8);
  });

  it("I resolution after V has very low tension", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[2].tension).toBeLessThanOrEqual(0.1);
  });

  it("secondary dominant has elevated tension", () => {
    const chords = makeChords(["Cmaj7", "A7", "Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[1].tension).toBeGreaterThanOrEqual(0.6);
  });

  it("ii has moderate tension (preparation)", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    const iiTension = result.chordAnalyses[0].tension;
    expect(iiTension).toBeGreaterThan(0.2);
    expect(iiTension).toBeLessThan(0.6);
  });
});

// ── Real Jazz Progressions ──

describe("Real Jazz Progressions", () => {
  it("analyzes Bb Blues correctly", () => {
    const chords = makeChords([
      "Bb7", "Bb7", "Bb7", "Bb7",
      "Eb7", "Eb7", "Bb7", "Bb7",
      "F7", "Eb7", "Bb7", "F7",
    ]);
    const result = analyzeHarmony(chords, "Bb", MEASURE_DUR_120);
    expect(result.keyCenter).toBe("Bb");
    expect(result.chordAnalyses[0].degree).toBe("I");
    expect(result.chordAnalyses[4].degree).toBe("IV");
    expect(result.chordAnalyses[8].degree).toBe("V");
  });

  it("analyzes Autumn Leaves with ii-V-I detection", () => {
    const chords = makeChords([
      "Cm7", "F7", "Bbmaj7", "Ebmaj7",
      "Am7b5", "D7", "Gm7", "Gm7",
    ]);
    const result = analyzeHarmony(chords, "Bb", MEASURE_DUR_120);
    // Should find at least the Cm7-F7-Bbmaj7 ii-V-I
    const fullIiVIs = result.iiViLocations.filter(m => m.ii >= 0);
    expect(fullIiVIs.length).toBeGreaterThanOrEqual(1);
    // Cm7 should be ii in Bb
    expect(result.chordAnalyses[0].degree).toBe("ii");
    // F7 should be V in Bb
    expect(result.chordAnalyses[1].degree).toBe("V");
    // Bbmaj7 should be I
    expect(result.chordAnalyses[2].degree).toBe("I");
  });

  it("analyzes All The Things You Are (modulating)", () => {
    // First 8 bars: Ab major section
    const chords = makeChords([
      "Fm7", "Bbm7", "Eb7", "Abmaj7",
      "Dbmaj7", "Dm7", "G7", "Cmaj7",
    ]);
    const result = analyzeHarmony(chords, "Ab", MEASURE_DUR_120);
    // Should detect Eb7->Abmaj7 and G7->Cmaj7 patterns
    expect(result.iiViLocations.length).toBeGreaterThanOrEqual(1);
  });

  it("analyzes rhythm changes (I-vi-ii-V turnaround)", () => {
    const chords = makeChords([
      "Bbmaj7", "Gm7", "Cm7", "F7",
      "Bbmaj7", "Gm7", "Cm7", "F7",
    ]);
    const result = analyzeHarmony(chords, "Bb", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].degree).toBe("I");
    expect(result.chordAnalyses[1].degree).toBe("vi");
    expect(result.chordAnalyses[2].degree).toBe("ii");
    expect(result.chordAnalyses[3].degree).toBe("V");
    // Should detect ii-V (Cm7-F7)
    expect(result.iiViLocations.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Modulation Detection ──

describe("Modulation Detection", () => {
  it("detects key change in progression with multiple ii-V-I targets", () => {
    // ii-V-I to C, then ii-V-I to Eb
    // Global key detection picks Eb (last chord bonus + equal ii-V-I count)
    // but modulation detection sees two different ii-V-I targets
    const chords = makeChords([
      "Dm7", "G7", "Cmaj7", "Cmaj7",
      "Fm7", "Bb7", "Ebmaj7", "Ebmaj7",
    ]);
    const result = analyzeHarmony(chords, undefined, MEASURE_DUR_120);
    // Should have at least 2 key regions with different keys
    expect(result.keyCenters.length).toBeGreaterThanOrEqual(2);
    const keys = result.keyCenters.map(r => r.key);
    expect(keys).toContain("C");
    expect(keys).toContain("Eb");
  });

  it("marks modulation points", () => {
    const chords = makeChords([
      "Dm7", "G7", "Cmaj7", "Cmaj7",
      "Fm7", "Bb7", "Ebmaj7", "Ebmaj7",
    ]);
    const result = analyzeHarmony(chords, undefined, MEASURE_DUR_120);
    const modPoints = result.chordAnalyses.filter(a => a.isModulationPoint);
    // Should mark at least one modulation point (if detected)
    if (result.keyCenters.length >= 2) {
      expect(modPoints.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Harmonic Rhythm ──

describe("Harmonic Rhythm", () => {
  it("computes 1 chord per measure for simple progressions", () => {
    const chords = makeChords(["Cmaj7", "Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.harmonicRhythm).toBeCloseTo(1, 0);
  });

  it("computes higher rate for dense progressions", () => {
    // 2 chords per measure (each chord is half a measure)
    const beatDur = 60 / 120;
    const halfMeasure = 2 * beatDur;
    const chords: ChordEvent[] = [
      { root: "D", quality: "m7", time: 0, duration: halfMeasure },
      { root: "G", quality: "7", time: halfMeasure, duration: halfMeasure },
      { root: "C", quality: "maj7", time: 2 * halfMeasure, duration: halfMeasure },
      { root: "A", quality: "m7", time: 3 * halfMeasure, duration: halfMeasure },
    ];
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.harmonicRhythm).toBeGreaterThan(1.5);
  });
});

// ── Edge Cases ──

describe("Edge Cases", () => {
  it("handles unknown quality gracefully", () => {
    const chords = makeChords(["Cweird"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses).toHaveLength(1);
    // Should not crash, degree should be I (root matches key)
    expect(result.chordAnalyses[0].degree).toBeDefined();
  });

  it("handles slash chords", () => {
    const chords: ChordEvent[] = [
      { root: "C", quality: "maj7/G", time: 0, duration: 2 },
    ];
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    // Quality classification should strip the slash
    expect(result.chordAnalyses[0].function).toBe("tonic");
  });

  it("handles sus chords", () => {
    const chords = makeChords(["Csus4", "C7sus4"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    // sus4 is not dominant, not minor, not major
    expect(result.chordAnalyses).toHaveLength(2);
  });

  it("handles aug chords", () => {
    const chords = makeChords(["Caug"]);
    const result = analyzeHarmony(chords, "C", MEASURE_DUR_120);
    expect(result.chordAnalyses[0].degree).toBe("I");
  });

  it("no measure duration still works (skips cadence placement)", () => {
    const chords = makeChords(["Dm7", "G7", "Cmaj7"]);
    const result = analyzeHarmony(chords, "C");
    expect(result.chordAnalyses).toHaveLength(3);
    expect(result.iiViLocations).toHaveLength(1);
  });
});
