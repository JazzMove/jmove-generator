import { describe, it, expect } from "vitest";
import { applyGroove, getGrooveTemplate } from "../src/grooveTemplates";
import type { ElementTiming } from "../src/types";

describe("Groove Templates", () => {
  // ── applyGroove ──

  it("with zero bias and jitter, returns original time", () => {
    const elem: ElementTiming = { bias: 0, jitter: 0 };
    const rng = () => 0.5;
    expect(applyGroove(1.0, elem, rng)).toBe(1.0);
  });

  it("applies bias offset", () => {
    const elem: ElementTiming = { bias: 0.01, jitter: 0 };
    const rng = () => 0.5;
    expect(applyGroove(1.0, elem, rng)).toBeCloseTo(1.01, 6);
  });

  it("triangular distribution peaks at center (u=0.5 -> tri=0)", () => {
    const elem: ElementTiming = { bias: 0, jitter: 0.01 };
    const rng = () => 0.5;
    // tri = sqrt(1) - 1 = 0, so jitter contribution = 0
    expect(applyGroove(1.0, elem, rng)).toBe(1.0);
  });

  it("triangular distribution min at u=0 -> tri=-1", () => {
    const elem: ElementTiming = { bias: 0, jitter: 0.01 };
    const rng = () => 0.0001; // near 0
    const result = applyGroove(1.0, elem, rng);
    // Should be close to 1.0 - 0.01 = 0.99
    expect(result).toBeLessThan(1.0);
    expect(result).toBeGreaterThan(0.989);
  });

  it("triangular distribution max at u=1 -> tri=+1", () => {
    const elem: ElementTiming = { bias: 0, jitter: 0.01 };
    const rng = () => 0.9999; // near 1
    const result = applyGroove(1.0, elem, rng);
    // Should be close to 1.0 + 0.01 = 1.01
    expect(result).toBeGreaterThan(1.0);
    expect(result).toBeLessThan(1.011);
  });

  it("triangular distribution is symmetric and peaked at center", () => {
    const elem: ElementTiming = { bias: 0, jitter: 0.01 };
    let idx = 0;
    const values = Array.from({ length: 10000 }, () => Math.random());
    const rng = () => values[idx++];

    const offsets: number[] = [];
    for (idx = 0; idx < values.length; idx++) {
      // Reset idx for each call since rng() consumes one value
    }
    idx = 0;
    for (let i = 0; i < values.length; i++) {
      offsets.push(applyGroove(0, elem, () => values[i]) );
    }

    // Mean should be near 0 (symmetric distribution + zero bias)
    const mean = offsets.reduce((s, v) => s + v, 0) / offsets.length;
    expect(Math.abs(mean)).toBeLessThan(0.001);

    // More values should cluster near center than edges
    const nearCenter = offsets.filter(v => Math.abs(v) < 0.005).length;
    const nearEdge = offsets.filter(v => Math.abs(v) > 0.008).length;
    expect(nearCenter).toBeGreaterThan(nearEdge);

    // All values within [-jitter, +jitter]
    for (const v of offsets) {
      expect(v).toBeGreaterThanOrEqual(-0.011);
      expect(v).toBeLessThanOrEqual(0.011);
    }
  });

  // ── getGrooveTemplate ──

  it("returns template for known styles", () => {
    for (const style of ["swing", "hardBop", "bossa", "ballad", "latin", "fusion"]) {
      const tmpl = getGrooveTemplate(style);
      expect(tmpl).toBeDefined();
      expect(tmpl.kick).toBeDefined();
      expect(tmpl.bass).toBeDefined();
      expect(tmpl.piano).toBeDefined();
    }
  });

  it("returns swing as fallback for unknown style", () => {
    const tmpl = getGrooveTemplate("unknownStyle123");
    expect(tmpl).toBeDefined();
    expect(tmpl.kick).toBeDefined();
  });

  it("all templates have valid bias and jitter ranges", () => {
    for (const style of ["swing", "hardBop", "bossa", "ballad", "latin", "fusion", "ecm", "modal"]) {
      const tmpl = getGrooveTemplate(style);
      for (const [key, elem] of Object.entries(tmpl)) {
        const e = elem as ElementTiming;
        // Bias should be small (-20ms to +20ms)
        expect(Math.abs(e.bias)).toBeLessThanOrEqual(0.020);
        // Jitter should be non-negative and small
        expect(e.jitter).toBeGreaterThanOrEqual(0);
        expect(e.jitter).toBeLessThanOrEqual(0.020);
      }
    }
  });
});
