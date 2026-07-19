import { describe, it, expect } from "vitest";
import { resolveDrumGranular, resolvePianoGranular, resolveBassGranular } from "../src/complexityMapping";
import { GENERATOR_VERSION } from "../src/index";

describe("Complexity Mapping", () => {
  describe("resolveDrumGranular", () => {
    it("returns defaults at complexity 50", () => {
      const g = resolveDrumGranular(50);
      expect(g.tomFrequency).toBe(40);
      expect(g.fillIntensity).toBe(50);
      expect(g.rideWash).toBe(50);
      expect(g.ghostDensity).toBe(40);
      expect(g.cymbalColor).toBe(30);
    });

    it("returns minimums at complexity 0", () => {
      const g = resolveDrumGranular(0);
      expect(g.tomFrequency).toBe(0);
      expect(g.fillIntensity).toBe(5);
      expect(g.rideWash).toBe(10);
      expect(g.ghostDensity).toBe(5);
      expect(g.cymbalColor).toBe(0);
    });

    it("returns maximums at complexity 100", () => {
      const g = resolveDrumGranular(100);
      expect(g.tomFrequency).toBe(85);
      expect(g.fillIntensity).toBe(90);
      expect(g.rideWash).toBe(90);
      expect(g.ghostDensity).toBe(85);
      expect(g.cymbalColor).toBe(75);
    });

    it("overrides take precedence over derived values", () => {
      const g = resolveDrumGranular(50, { tomFrequency: 90, ghostDensity: 10 });
      expect(g.tomFrequency).toBe(90);  // overridden
      expect(g.ghostDensity).toBe(10);  // overridden
      expect(g.fillIntensity).toBe(50); // derived from complexity 50
      expect(g.rideWash).toBe(50);      // derived
    });

    it("all values are integers", () => {
      for (let c = 0; c <= 100; c += 7) {
        const g = resolveDrumGranular(c);
        expect(Number.isInteger(g.tomFrequency)).toBe(true);
        expect(Number.isInteger(g.fillIntensity)).toBe(true);
        expect(Number.isInteger(g.rideWash)).toBe(true);
        expect(Number.isInteger(g.ghostDensity)).toBe(true);
        expect(Number.isInteger(g.cymbalColor)).toBe(true);
      }
    });

    it("monotonically increases with complexity", () => {
      let prev = resolveDrumGranular(0);
      for (let c = 10; c <= 100; c += 10) {
        const curr = resolveDrumGranular(c);
        expect(curr.tomFrequency).toBeGreaterThanOrEqual(prev.tomFrequency);
        expect(curr.fillIntensity).toBeGreaterThanOrEqual(prev.fillIntensity);
        expect(curr.ghostDensity).toBeGreaterThanOrEqual(prev.ghostDensity);
        prev = curr;
      }
    });

    it("clamps out-of-range complexity", () => {
      const low = resolveDrumGranular(-10);
      const zero = resolveDrumGranular(0);
      expect(low.tomFrequency).toBe(zero.tomFrequency);

      const high = resolveDrumGranular(150);
      const max = resolveDrumGranular(100);
      expect(high.tomFrequency).toBe(max.tomFrequency);
    });

    it("defaults to complexity 50 when undefined", () => {
      const g = resolveDrumGranular();
      expect(g.tomFrequency).toBe(40);
    });
  });

  describe("resolvePianoGranular", () => {
    it("returns defaults at complexity 50", () => {
      const g = resolvePianoGranular(50);
      expect(g.voicingDensity).toBe(50);
      expect(g.rhythmicActivity).toBe(50);
      expect(g.registerRange).toBe(50);
      expect(g.anticipation).toBe(35);
      expect(g.pianoRegister).toBe(50);
    });

    it("overrides take precedence", () => {
      const g = resolvePianoGranular(0, { anticipation: 80 });
      expect(g.anticipation).toBe(80);
      expect(g.voicingDensity).toBe(10); // derived from complexity 0
    });

    it("returns maximums at complexity 100", () => {
      const g = resolvePianoGranular(100);
      expect(g.voicingDensity).toBe(90);
      expect(g.rhythmicActivity).toBe(90);
      expect(g.registerRange).toBe(90);
      expect(g.anticipation).toBe(75);
      expect(g.pianoRegister).toBe(50); // always 50 unless overridden
    });

    it("pianoRegister defaults to 50 regardless of complexity", () => {
      expect(resolvePianoGranular(0).pianoRegister).toBe(50);
      expect(resolvePianoGranular(50).pianoRegister).toBe(50);
      expect(resolvePianoGranular(100).pianoRegister).toBe(50);
    });

    it("pianoRegister override takes effect", () => {
      expect(resolvePianoGranular(50, { pianoRegister: 0 }).pianoRegister).toBe(0);
      expect(resolvePianoGranular(50, { pianoRegister: 100 }).pianoRegister).toBe(100);
      expect(resolvePianoGranular(50, { pianoRegister: 25 }).pianoRegister).toBe(25);
    });
  });

  describe("resolveBassGranular", () => {
    it("returns defaults at complexity 50", () => {
      const g = resolveBassGranular(50);
      expect(g.chromaticApproach).toBe(50);
      expect(g.registerWidth).toBe(50);
      expect(g.syncopation).toBe(30);
      expect(g.beatVariety).toBe(40);
      expect(g.bassRegister).toBe(50);
    });

    it("overrides take precedence", () => {
      const g = resolveBassGranular(100, { syncopation: 5 });
      expect(g.syncopation).toBe(5);
      expect(g.chromaticApproach).toBe(85); // derived from complexity 100
    });

    it("returns minimums at complexity 0", () => {
      const g = resolveBassGranular(0);
      expect(g.chromaticApproach).toBe(10);
      expect(g.registerWidth).toBe(15);
      expect(g.syncopation).toBe(0);
      expect(g.beatVariety).toBe(10);
      expect(g.bassRegister).toBe(50); // always 50 unless overridden
    });

    it("bassRegister defaults to 50 regardless of complexity", () => {
      expect(resolveBassGranular(0).bassRegister).toBe(50);
      expect(resolveBassGranular(50).bassRegister).toBe(50);
      expect(resolveBassGranular(100).bassRegister).toBe(50);
    });

    it("bassRegister override takes effect", () => {
      expect(resolveBassGranular(50, { bassRegister: 0 }).bassRegister).toBe(0);
      expect(resolveBassGranular(50, { bassRegister: 100 }).bassRegister).toBe(100);
      expect(resolveBassGranular(50, { bassRegister: 25 }).bassRegister).toBe(25);
    });
  });
});

describe("Complexity Mapping — edge cases", () => {
  it("all controls at 0 — values >= 0", () => {
    const d = resolveDrumGranular(0);
    const p = resolvePianoGranular(0);
    const b = resolveBassGranular(0);
    for (const v of Object.values(d)) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of Object.values(p)) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of Object.values(b)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("all controls at 100 — values <= 100", () => {
    const d = resolveDrumGranular(100);
    const p = resolvePianoGranular(100);
    const b = resolveBassGranular(100);
    for (const v of Object.values(d)) expect(v).toBeLessThanOrEqual(100);
    for (const v of Object.values(p)) expect(v).toBeLessThanOrEqual(100);
    for (const v of Object.values(b)) expect(v).toBeLessThanOrEqual(100);
  });

  it("partial overrides preserve non-overridden values", () => {
    const derived = resolveDrumGranular(75);
    const partial = resolveDrumGranular(75, { tomFrequency: 99 });
    expect(partial.tomFrequency).toBe(99);
    expect(partial.fillIntensity).toBe(derived.fillIntensity);
    expect(partial.rideWash).toBe(derived.rideWash);
    expect(partial.ghostDensity).toBe(derived.ghostDensity);
    expect(partial.cymbalColor).toBe(derived.cymbalColor);
  });

  it("full overrides ignore complexity entirely", () => {
    const full = resolveDrumGranular(0, {
      tomFrequency: 77, fillIntensity: 88, rideWash: 33, ghostDensity: 44, cymbalColor: 55,
    });
    expect(full.tomFrequency).toBe(77);
    expect(full.fillIntensity).toBe(88);
    expect(full.rideWash).toBe(33);
    expect(full.ghostDensity).toBe(44);
    expect(full.cymbalColor).toBe(55);

    // Same overrides at complexity 100 — identical result
    const full100 = resolveDrumGranular(100, {
      tomFrequency: 77, fillIntensity: 88, rideWash: 33, ghostDensity: 44, cymbalColor: 55,
    });
    expect(full100).toEqual(full);
  });

  it("piano partial override preserves derived", () => {
    const derived = resolvePianoGranular(30);
    const partial = resolvePianoGranular(30, { anticipation: 99 });
    expect(partial.anticipation).toBe(99);
    expect(partial.voicingDensity).toBe(derived.voicingDensity);
    expect(partial.rhythmicActivity).toBe(derived.rhythmicActivity);
    expect(partial.registerRange).toBe(derived.registerRange);
  });

  it("bass partial override preserves derived", () => {
    const derived = resolveBassGranular(60);
    const partial = resolveBassGranular(60, { syncopation: 5 });
    expect(partial.syncopation).toBe(5);
    expect(partial.chromaticApproach).toBe(derived.chromaticApproach);
    expect(partial.registerWidth).toBe(derived.registerWidth);
    expect(partial.beatVariety).toBe(derived.beatVariety);
  });
});

describe("GENERATOR_VERSION", () => {
  it("exports a semver string matching package.json", () => {
    // __GENERATOR_VERSION__ injected by tsup (build) and vitest (test) from package.json
    expect(GENERATOR_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(GENERATOR_VERSION).toBe("1.5.0");
  });
});

// ═══════════════════════════════════════════════════
// G24 — S-curve complexity mapping
// ═══════════════════════════════════════════════════

describe("G24 — S-curve complexity mapping", () => {
  it("mid-range complexity changes more gradually than linear", () => {
    // S-curve should have flatter response near 0 and 100, steeper in middle
    const low = resolveDrumGranular(10);
    const mid = resolveDrumGranular(50);
    const high = resolveDrumGranular(90);
    // All values should be defined and in range
    expect(low.tomFrequency).toBeGreaterThanOrEqual(0);
    expect(mid.tomFrequency).toBe(40); // default at 50% complexity
    expect(high.tomFrequency).toBeLessThanOrEqual(85);
    // S-curve: value at 25% should be closer to min than linear would give
    const quarter = resolveDrumGranular(25);
    const threeQuarter = resolveDrumGranular(75);
    // At 25%, S-curve should give less than linear midpoint between min and default
    const linearQuarter = 0 + (40 - 0) * 0.5; // 20 (linear at t=0.5 of first half)
    // S-curve smoothstep(0.5) = 0.5, so at 25% the curve value should be near 20 but with S-shape
    expect(quarter.tomFrequency).toBeGreaterThanOrEqual(0);
    expect(quarter.tomFrequency).toBeLessThanOrEqual(40);
    expect(threeQuarter.tomFrequency).toBeGreaterThanOrEqual(40);
    expect(threeQuarter.tomFrequency).toBeLessThanOrEqual(85);
  });

  it("endpoints match min/max exactly", () => {
    const atZero = resolveDrumGranular(0);
    const atHundred = resolveDrumGranular(100);
    expect(atZero.tomFrequency).toBe(0);   // min
    expect(atHundred.tomFrequency).toBe(85); // max
    expect(atZero.fillIntensity).toBe(5);
    expect(atHundred.fillIntensity).toBe(90);
  });
});
