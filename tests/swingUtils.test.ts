import { describe, it, expect } from "vitest";
import { tempoSwingMultiplier, dynamicMultiplier, instrumentSwingFactor } from "../src/index";

describe("tempoSwingMultiplier", () => {
  it("ballad tempo (≤80) returns 1.5 (heavy swing, ~3:1 ratio)", () => {
    expect(tempoSwingMultiplier(60)).toBe(1.5);
    expect(tempoSwingMultiplier(80)).toBe(1.5);
  });

  it("medium-slow tempo (80-100) returns 1.3 (~2.5:1 ratio)", () => {
    expect(tempoSwingMultiplier(90)).toBe(1.3);
    expect(tempoSwingMultiplier(100)).toBe(1.3);
  });

  it("medium tempo (100-180) returns 1.0 (neutral)", () => {
    expect(tempoSwingMultiplier(120)).toBe(1.0);
    expect(tempoSwingMultiplier(140)).toBe(1.0);
    expect(tempoSwingMultiplier(180)).toBe(1.0);
  });

  it("fast tempo (180-240) linearly decreases 1.0→0.6", () => {
    expect(tempoSwingMultiplier(210)).toBeCloseTo(0.8, 2);
    expect(tempoSwingMultiplier(240)).toBeCloseTo(0.6, 2);
  });

  it("very fast tempo (≥240) returns 0.3 (nearly straight)", () => {
    expect(tempoSwingMultiplier(240)).toBeCloseTo(0.6, 2);
    expect(tempoSwingMultiplier(280)).toBe(0.3);
    expect(tempoSwingMultiplier(300)).toBe(0.3);
  });
});

describe("dynamicMultiplier", () => {
  it("opening bars (0-15%) return 0.88 (subdued)", () => {
    expect(dynamicMultiplier(0, 32)).toBe(0.88);
    expect(dynamicMultiplier(4, 32)).toBe(0.88);
  });

  it("build section (15-60%) rises linearly 0.88→1.0", () => {
    const mid = dynamicMultiplier(12, 32); // ~37.5%
    expect(mid).toBeGreaterThan(0.88);
    expect(mid).toBeLessThan(1.0);
  });

  it("peak section (60-85%) returns 1.0", () => {
    expect(dynamicMultiplier(22, 32)).toBe(1.0); // ~69%
    expect(dynamicMultiplier(26, 32)).toBe(1.0); // ~81%
  });

  it("taper section (85-100%) returns 0.92", () => {
    expect(dynamicMultiplier(30, 32)).toBe(0.92); // ~94%
  });

  it("totalMeasures=0 returns 1.0 (safe fallback)", () => {
    expect(dynamicMultiplier(0, 0)).toBe(1.0);
  });

  it("each style has a distinct dynamic curve shape", () => {
    const styles = [
      "hardBop", "ballad", "ecm", "coolJazz", "fusion",
      "neoSoul", "bossa", "latin", "funk", "contemporaryJazz",
      "holdsworth", "shuffleBlues", "jazzWaltz", "modal", "mathRock", "idm",
    ];
    for (const style of styles) {
      const opening = dynamicMultiplier(0, 32, style);
      const mid = dynamicMultiplier(16, 32, style);
      // Every style: opening ≤ mid (builds or stays flat)
      expect(opening).toBeLessThanOrEqual(mid + 0.01);
      // Every style: opening < 1.0 (starts subdued or neutral)
      expect(opening).toBeLessThan(1.01);
    }
  });

  it("hardBop has wider range than ecm", () => {
    const hbOpen = dynamicMultiplier(0, 32, "hardBop");
    const hbPeak = dynamicMultiplier(24, 32, "hardBop"); // 75%
    const ecmOpen = dynamicMultiplier(0, 32, "ecm");
    const ecmPeak = dynamicMultiplier(22, 32, "ecm"); // ~69%
    expect(hbPeak - hbOpen).toBeGreaterThan(ecmPeak - ecmOpen);
  });

  it("neoSoul peaks late (after 80%)", () => {
    const at70 = dynamicMultiplier(22, 32, "neoSoul"); // ~69%
    const at87 = dynamicMultiplier(28, 32, "neoSoul"); // ~87%
    expect(at87).toBeGreaterThan(at70);
  });
});

describe("instrumentSwingFactor", () => {
  it("drums = 1.0 (full triplet feel)", () => {
    expect(instrumentSwingFactor("drums")).toBe(1.0);
  });

  it("piano = 0.85 (slightly behind ride)", () => {
    expect(instrumentSwingFactor("piano")).toBe(0.85);
  });

  it("bass = 0.70 (walks straighter)", () => {
    expect(instrumentSwingFactor("bass")).toBe(0.70);
  });

  it("drums > piano > bass ordering", () => {
    expect(instrumentSwingFactor("drums")).toBeGreaterThan(instrumentSwingFactor("piano"));
    expect(instrumentSwingFactor("piano")).toBeGreaterThan(instrumentSwingFactor("bass"));
  });
});
