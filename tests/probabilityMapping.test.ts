import { describe, it, expect } from "vitest";
import {
  anticipationProb,
  passingChordProb,
  brokenVoicingProb,
  graceNoteProb,
  bassRootProb,
  enclosureProb,
  chromaticPassingProb,
  kickHihatInterlockProb,
  fillProbScale,
  alignmentThreshold,
  airGapDropProb,
} from "../src/probabilityMapping";

describe("G19 — Probability mapping functions", () => {
  it("all functions return values in [0, 1] for valid inputs", () => {
    for (let v = 0; v <= 100; v += 10) {
      expect(anticipationProb(v)).toBeGreaterThanOrEqual(0);
      expect(anticipationProb(v)).toBeLessThanOrEqual(1);
      expect(passingChordProb(v)).toBeGreaterThanOrEqual(0);
      expect(passingChordProb(v)).toBeLessThanOrEqual(1);
      expect(brokenVoicingProb(v)).toBeGreaterThanOrEqual(0);
      expect(brokenVoicingProb(v)).toBeLessThanOrEqual(1);
      expect(graceNoteProb(v)).toBeGreaterThanOrEqual(0);
      expect(graceNoteProb(v)).toBeLessThanOrEqual(1);
      expect(bassRootProb(v)).toBeGreaterThanOrEqual(0);
      expect(bassRootProb(v)).toBeLessThanOrEqual(1);
      expect(enclosureProb(v)).toBeGreaterThanOrEqual(0);
      expect(enclosureProb(v)).toBeLessThanOrEqual(1);
      expect(chromaticPassingProb(v)).toBeGreaterThanOrEqual(0);
      expect(chromaticPassingProb(v)).toBeLessThanOrEqual(1);
      expect(kickHihatInterlockProb(v)).toBeGreaterThanOrEqual(0);
      expect(kickHihatInterlockProb(v)).toBeLessThanOrEqual(1);
      expect(airGapDropProb(v)).toBeGreaterThanOrEqual(0);
      expect(airGapDropProb(v)).toBeLessThanOrEqual(1);
    }
  });

  it("anticipationProb increases with harmonicFreedom", () => {
    expect(anticipationProb(0)).toBeLessThan(anticipationProb(50));
    expect(anticipationProb(50)).toBeLessThan(anticipationProb(100));
  });

  it("bassRootProb decreases with creativity (more adventurous)", () => {
    expect(bassRootProb(100)).toBeLessThan(bassRootProb(0));
  });

  it("fillProbScale returns correct scaling", () => {
    expect(fillProbScale(0)).toBeCloseTo(0.1, 2); // minimum
    expect(fillProbScale(50)).toBeCloseTo(1.0, 2); // neutral
    expect(fillProbScale(100)).toBeCloseTo(2.0, 2); // max
  });

  it("alignmentThreshold gets tighter with more conversation", () => {
    const loose = alignmentThreshold(0);
    const tight = alignmentThreshold(100);
    expect(tight).toBeLessThan(loose);
    expect(loose).toBeCloseTo(0.020, 3);
    expect(tight).toBeCloseTo(0.010, 3);
  });
});
