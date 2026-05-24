import { describe, it, expect } from "vitest";
import { autoDetectPreset } from "../src/index";
import type { QuantizedScore, QuantizedMeasure } from "../src/index";

function makeScore(opts: {
  tempo?: number;
  timeSig?: [number, number];
  style?: string;
  chords?: { root: string; quality: string }[];
  measures?: number;
}): QuantizedScore {
  const tempo = opts.tempo ?? 120;
  const timeSig = opts.timeSig ?? [4, 4];
  const numMeasures = opts.measures ?? (opts.chords ? Math.ceil(opts.chords.length / 2) : 4);
  const chords = opts.chords ?? [
    { root: "D", quality: "m7" },
    { root: "G", quality: "7" },
    { root: "C", quality: "maj7" },
    { root: "A", quality: "m7" },
  ];

  const measures: QuantizedMeasure[] = [];
  let chordIdx = 0;
  for (let i = 0; i < numMeasures; i++) {
    const measureChords = [];
    // Put ~2 chords per measure
    for (let j = 0; j < 2 && chordIdx < chords.length; j++) {
      measureChords.push({ ...chords[chordIdx], startTime: i * 2 + j });
      chordIdx++;
    }
    measures.push({
      index: i,
      notes: [],
      chords: measureChords,
      timeSignature: timeSig,
      keySignature: "C",
      tempo,
      startTime: i * 2,
      endTime: (i + 1) * 2,
    });
  }

  return {
    measures,
    keySignature: "C",
    timeSignature: timeSig,
    tempo,
    duration: numMeasures * 2,
    style: opts.style,
  };
}

describe("autoDetectPreset", () => {
  it("detects waltz from 3/4 time signature", () => {
    const score = makeScore({ timeSig: [3, 4], tempo: 130 });
    const preset = autoDetectPreset(score);
    expect(preset.style).toBe("jazzWaltz");
  });

  it("detects bossa from iReal style string", () => {
    const score = makeScore({ style: "Bossa Nova", tempo: 130 });
    const preset = autoDetectPreset(score);
    expect(preset.style).toBe("bossa");
  });

  it("detects ballad from slow tempo", () => {
    const score = makeScore({ tempo: 60, chords: [
      { root: "C", quality: "maj7" },
      { root: "A", quality: "m7" },
    ], measures: 4 });
    const preset = autoDetectPreset(score);
    expect(["ballad", "ecm"]).toContain(preset.style);
  });

  it("detects blues from dominant 7th heavy progression", () => {
    const score = makeScore({
      tempo: 100,
      chords: [
        { root: "C", quality: "7" }, { root: "C", quality: "7" },
        { root: "F", quality: "7" }, { root: "C", quality: "7" },
        { root: "G", quality: "7" }, { root: "F", quality: "7" },
        { root: "C", quality: "7" }, { root: "C", quality: "7" },
      ],
    });
    const preset = autoDetectPreset(score);
    expect(preset.style).toBe("shuffleBlues");
  });

  it("detects modal from static harmony", () => {
    const score = makeScore({
      tempo: 80,
      chords: [{ root: "D", quality: "m7" }],
      measures: 8,
    });
    const preset = autoDetectPreset(score);
    expect(["modal", "ecm"]).toContain(preset.style);
  });

  it("detects hardBop from fast tempo with ii-V-I patterns", () => {
    const score = makeScore({
      tempo: 190,
      chords: [
        { root: "D", quality: "m7" }, { root: "G", quality: "7" },
        { root: "C", quality: "maj7" }, { root: "A", quality: "m7" },
        { root: "D", quality: "m7" }, { root: "G", quality: "7alt" },
        { root: "C", quality: "maj7" }, { root: "F", quality: "7#9" },
      ],
    });
    const preset = autoDetectPreset(score);
    expect(preset.style).toBe("hardBop");
  });

  it("detects swing from medium tempo ii-V-I", () => {
    const score = makeScore({
      tempo: 140,
      measures: 4,
      chords: [
        { root: "D", quality: "m7" }, { root: "G", quality: "7" },
        { root: "C", quality: "maj7" }, { root: "A", quality: "m7" },
        { root: "D", quality: "m7" }, { root: "G", quality: "7" },
        { root: "C", quality: "maj7" }, { root: "F", quality: "7" },
      ],
    });
    const preset = autoDetectPreset(score);
    expect(["swing", "hardBop", "coolJazz"]).toContain(preset.style);
  });

  it("uses iReal style string as strongest signal", () => {
    // Even with blues-like chords, if iReal says Latin → Latin wins
    const score = makeScore({
      style: "Latin",
      tempo: 140,
      chords: [
        { root: "C", quality: "7" }, { root: "F", quality: "7" },
      ],
    });
    const preset = autoDetectPreset(score);
    expect(preset.style).toBe("latin");
  });

  it("returns a valid preset with all required fields", () => {
    const score = makeScore({});
    const preset = autoDetectPreset(score);
    expect(preset.id).toBeTruthy();
    expect(preset.name).toBeTruthy();
    expect(preset.style).toBeTruthy();
    expect(preset.parameters.swingAmount).toBeGreaterThanOrEqual(0);
    expect(preset.parameters.density).toBeGreaterThanOrEqual(0);
    expect(preset.tempoRange.length).toBe(2);
  });

  it("detects ecm/modal from sus chord heavy progression", () => {
    const score = makeScore({
      tempo: 70,
      chords: [
        { root: "D", quality: "sus4" }, { root: "G", quality: "sus4" },
        { root: "C", quality: "sus4" }, { root: "A", quality: "sus4" },
      ],
      measures: 8,
    });
    const preset = autoDetectPreset(score);
    expect(["modal", "ecm"]).toContain(preset.style);
  });
});
