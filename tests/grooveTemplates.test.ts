import { describe, it, expect } from "vitest";
import { applyGroove, getGrooveTemplate, evolveElement, rubatoOffset } from "../src/grooveTemplates";
import { tempoSwingMultiplier } from "../src/swingUtils";
import type { ElementTiming, PhraseArc } from "../src/types";

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

// ═══════════════════════════════════════════════════
// G4: Dynamic Groove Templates - evolveElement
// ═══════════════════════════════════════════════════

describe("G4 — evolveElement (dynamic groove evolution)", () => {
  const base: ElementTiming = { bias: 0.005, jitter: 0.004 };

  it("build arc pushes ahead (negative bias shift) and tightens jitter", () => {
    const evolved = evolveElement(base, 0.7, "build");
    expect(evolved.bias).toBeLessThan(base.bias);
    expect(evolved.bias).toBeCloseTo(base.bias - 0.001, 6);
    expect(evolved.jitter).toBeLessThan(base.jitter);
  });

  it("climax arc pushes ahead slightly and tightens jitter the most", () => {
    const evolved = evolveElement(base, 0.7, "climax");
    expect(evolved.bias).toBeCloseTo(base.bias - 0.0005, 6);
    // Climax jitter should be tighter than build jitter
    const buildEvolved = evolveElement(base, 0.7, "build");
    expect(evolved.jitter).toBeLessThan(buildEvolved.jitter);
  });

  it("release arc lays back (positive bias shift) and loosens jitter", () => {
    const evolved = evolveElement(base, 0.7, "release");
    expect(evolved.bias).toBeCloseTo(base.bias + 0.001, 6);
    expect(evolved.jitter).toBeGreaterThan(base.jitter);
  });

  it("drop arc lays back most and gives loosest jitter", () => {
    const evolved = evolveElement(base, 0.7, "drop");
    expect(evolved.bias).toBeCloseTo(base.bias + 0.002, 6);
    const releaseEvolved = evolveElement(base, 0.7, "release");
    expect(evolved.jitter).toBeGreaterThan(releaseEvolved.jitter);
  });

  it("sustain arc does not shift bias", () => {
    const evolved = evolveElement(base, 0.7, "sustain");
    expect(evolved.bias).toBeCloseTo(base.bias, 6);
  });

  it("null/undefined arc does not shift bias", () => {
    const evolvedNull = evolveElement(base, 0.7, null);
    expect(evolvedNull.bias).toBeCloseTo(base.bias, 6);
    const evolvedUndefined = evolveElement(base, 0.7, undefined);
    expect(evolvedUndefined.bias).toBeCloseTo(base.bias, 6);
  });

  it("high energy (1.0) produces tighter jitter than low energy (0.3)", () => {
    const highE = evolveElement(base, 1.0, "sustain");
    const lowE = evolveElement(base, 0.3, "sustain");
    expect(highE.jitter).toBeLessThan(lowE.jitter);
  });

  it("energy is clamped to [0.3, 1.0]", () => {
    // Energy below 0.3 should behave same as 0.3
    const e0 = evolveElement(base, 0.0, "sustain");
    const e03 = evolveElement(base, 0.3, "sustain");
    expect(e0.jitter).toBeCloseTo(e03.jitter, 8);

    // Energy above 1.0 should behave same as 1.0
    const e15 = evolveElement(base, 1.5, "sustain");
    const e10 = evolveElement(base, 1.0, "sustain");
    expect(e15.jitter).toBeCloseTo(e10.jitter, 8);
  });

  it("jitter formula: scale = (1.2 - 0.4 * energy) with energy [0.3, 1.0]", () => {
    // At energy 0.3: scale = 1.2 - 0.4 * 0.3 = 1.08
    // At energy 1.0: scale = 1.2 - 0.4 * 1.0 = 0.80
    const at03 = evolveElement({ bias: 0, jitter: 0.010 }, 0.3, "sustain");
    expect(at03.jitter).toBeCloseTo(0.010 * 1.08, 6);
    const at10 = evolveElement({ bias: 0, jitter: 0.010 }, 1.0, "sustain");
    expect(at10.jitter).toBeCloseTo(0.010 * 0.80, 6);
  });

  it("arc and energy combine multiplicatively on jitter", () => {
    // Build at energy 0.5: jitterScale = (1.2 - 0.4*0.5) * 0.85 = 1.0 * 0.85 = 0.85
    const evolved = evolveElement({ bias: 0, jitter: 0.010 }, 0.5, "build");
    expect(evolved.jitter).toBeCloseTo(0.010 * 0.85, 6);
  });

  it("original element is not mutated", () => {
    const original: ElementTiming = { bias: 0.003, jitter: 0.005 };
    evolveElement(original, 0.8, "climax");
    expect(original.bias).toBe(0.003);
    expect(original.jitter).toBe(0.005);
  });

  it("all arcs produce valid (non-negative) jitter", () => {
    const arcs: (PhraseArc | null | undefined)[] = ["build", "sustain", "release", "drop", "climax", null, undefined];
    const energies = [0, 0.3, 0.5, 0.7, 1.0, 1.5];
    for (const arc of arcs) {
      for (const energy of energies) {
        const evolved = evolveElement(base, energy, arc);
        expect(evolved.jitter).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// G4: applyGroove with energy/arc params
// ═══════════════════════════════════════════════════

describe("G4 — applyGroove with energy and arc", () => {
  const elem: ElementTiming = { bias: 0.005, jitter: 0.004 };
  const rng = () => 0.5; // deterministic: tri distribution = 0 at u=0.5

  it("passing energy/arc changes the output vs without", () => {
    const without = applyGroove(1.0, elem, rng);
    const withParams = applyGroove(1.0, elem, rng, 0.9, "build");
    expect(without).not.toBeCloseTo(withParams, 6);
  });

  it("build arc at high energy produces earlier timing (lower value)", () => {
    const sustain = applyGroove(1.0, elem, rng, 0.7, "sustain");
    const build = applyGroove(1.0, elem, rng, 0.7, "build");
    // Build shifts bias negative, so build < sustain
    expect(build).toBeLessThan(sustain);
  });

  it("drop arc at low energy produces later timing (higher value)", () => {
    const sustain = applyGroove(1.0, elem, rng, 0.5, "sustain");
    const drop = applyGroove(1.0, elem, rng, 0.5, "drop");
    // Drop shifts bias positive, so drop > sustain
    expect(drop).toBeGreaterThan(sustain);
  });

  it("energy=undefined falls through to original element (backward compatible)", () => {
    const without = applyGroove(1.0, elem, rng);
    const undefinedEnergy = applyGroove(1.0, elem, rng, undefined, undefined);
    expect(without).toBe(undefinedEnergy);
  });
});

// ═══════════════════════════════════════════════════
// G5: Tempo Rubato
// ═══════════════════════════════════════════════════

describe("G5 — rubatoOffset (tempo micro-variation)", () => {
  // ── Ballad/ECM beat position rubato ──

  it("ballad: beat 4 area (>75%) gets +4ms stretch", () => {
    // beatInMeasure = 3.5 out of 4 beats → 87.5% → >75%
    const offset = rubatoOffset("ballad", 3.5, 4);
    expect(offset).toBeCloseTo(0.004, 6);
  });

  it("ecm: beat 4 area (>75%) gets +4ms stretch", () => {
    const offset = rubatoOffset("ecm", 3.5, 4);
    expect(offset).toBeCloseTo(0.004, 6);
  });

  it("ballad: beat 1 area (>0, <25%) gets -2ms compress", () => {
    // beatInMeasure = 0.5 out of 4 beats → 12.5% → <25% and > 0
    const offset = rubatoOffset("ballad", 0.5, 4);
    expect(offset).toBeCloseTo(-0.002, 6);
  });

  it("ballad: beat 0 (exactly 0%) gets no compression", () => {
    // beatPct = 0 → does not satisfy >0 condition
    const offset = rubatoOffset("ballad", 0, 4);
    expect(offset).toBe(0);
  });

  it("ballad: mid-measure positions get no rubato", () => {
    // beatInMeasure = 2.0 out of 4 = 50% → neither <25% nor >75%
    const offset = rubatoOffset("ballad", 2.0, 4);
    expect(offset).toBe(0);
  });

  it("non-ballad/non-ecm styles get no beat-position rubato (no arc)", () => {
    for (const style of ["swing", "hardBop", "latin", "fusion", "funk"]) {
      const offset = rubatoOffset(style, 3.5, 4);
      expect(offset, `${style} should have no rubato without arc`).toBe(0);
    }
  });

  // ── Arc-driven rubato ──

  it("build arc gives -1ms (accelerando)", () => {
    const offset = rubatoOffset("swing", 2.0, 4, "build");
    expect(offset).toBeCloseTo(-0.001, 6);
  });

  it("release arc gives +2ms (ritardando)", () => {
    const offset = rubatoOffset("swing", 2.0, 4, "release");
    expect(offset).toBeCloseTo(0.002, 6);
  });

  it("drop arc gives +3ms (significant slowdown)", () => {
    const offset = rubatoOffset("swing", 2.0, 4, "drop");
    expect(offset).toBeCloseTo(0.003, 6);
  });

  it("sustain arc gives 0 offset", () => {
    const offset = rubatoOffset("swing", 2.0, 4, "sustain");
    expect(offset).toBe(0);
  });

  it("climax arc gives slight forward push", () => {
    const offset = rubatoOffset("swing", 2.0, 4, "climax");
    expect(offset).toBe(-0.0005); // driving: half ms ahead
  });

  // ── Combined beat-position + arc rubato ──

  it("ballad beat 4 with build arc: +4ms -1ms = +3ms", () => {
    const offset = rubatoOffset("ballad", 3.5, 4, "build");
    expect(offset).toBeCloseTo(0.003, 6);
  });

  it("ballad beat 1 area with release arc: -2ms +2ms = 0ms", () => {
    const offset = rubatoOffset("ballad", 0.5, 4, "release");
    expect(offset).toBeCloseTo(0.0, 6);
  });

  it("ecm beat 4 with drop arc: +4ms +3ms = +7ms", () => {
    const offset = rubatoOffset("ecm", 3.5, 4, "drop");
    expect(offset).toBeCloseTo(0.007, 6);
  });

  // ── Edge cases ──

  it("beatsPerMeasure = 0 does not crash (division guard)", () => {
    const offset = rubatoOffset("ballad", 0, 0);
    expect(typeof offset).toBe("number");
    expect(Number.isFinite(offset)).toBe(true);
  });

  it("null arc treated as no arc (no arc offset)", () => {
    const offset = rubatoOffset("swing", 2.0, 4, null);
    expect(offset).toBe(0);
  });

  it("undefined arc treated as no arc (no arc offset)", () => {
    const offset = rubatoOffset("swing", 2.0, 4, undefined);
    expect(offset).toBe(0);
  });

  it("waltz time (3/4) beat positions work correctly", () => {
    // Beat 2.5 out of 3 beats = 83.3% → >75% → stretch in ballad
    const offset = rubatoOffset("ballad", 2.5, 3);
    expect(offset).toBeCloseTo(0.004, 6);
  });

  it("new arc types produce expected offsets", () => {
    expect(rubatoOffset("swing", 2.0, 4, "shout")).toBe(-0.0005); // driving
    expect(rubatoOffset("swing", 2.0, 4, "solo")).toBe(-0.001);   // forward
    expect(rubatoOffset("swing", 2.0, 4, "outro")).toBe(0.002);   // relaxing
    expect(rubatoOffset("swing", 2.0, 4, "breakdown")).toBe(0.003); // floating
    expect(rubatoOffset("swing", 2.0, 4, "intro")).toBe(0.001);   // settling
    expect(rubatoOffset("swing", 2.0, 4, "vamp")).toBe(0);        // neutral
    expect(rubatoOffset("swing", 2.0, 4, "interlude")).toBe(0.002); // relaxing
  });
});

// ═══════════════════════════════════════════════════
// G20 — Energy-aware swing ratio
// ═══════════════════════════════════════════════════

describe("G20 — Energy-aware swing", () => {
  it("high energy produces slightly straighter swing than low energy", () => {
    const lowEnergy = tempoSwingMultiplier(140, 0.3);
    const highEnergy = tempoSwingMultiplier(140, 1.0);
    // High energy should be slightly lower (straighter)
    expect(highEnergy).toBeLessThan(lowEnergy);
  });

  it("energy=undefined gives same result as no energy parameter", () => {
    const withoutEnergy = tempoSwingMultiplier(140);
    const withUndefined = tempoSwingMultiplier(140, undefined);
    expect(withoutEnergy).toBe(withUndefined);
  });

  it("energy modulation stays within ±10% of base", () => {
    const base = tempoSwingMultiplier(140);
    const low = tempoSwingMultiplier(140, 0.0);
    const high = tempoSwingMultiplier(140, 1.0);
    expect(low).toBeLessThanOrEqual(base * 1.06);
    expect(high).toBeGreaterThanOrEqual(base * 0.94);
  });
});

// ═══════════════════════════════════════════════════
// G27 — evolveElement handles new arc types
// ═══════════════════════════════════════════════════

describe("G27 — evolveElement new arcs", () => {
  const base: ElementTiming = { bias: 0, jitter: 0.003 };

  it("shout arc tightens jitter (locked in)", () => {
    const evolved = evolveElement(base, 0.8, "shout");
    expect(evolved.jitter).toBeLessThan(base.jitter);
  });

  it("breakdown arc loosens jitter (spacious)", () => {
    const evolved = evolveElement(base, 0.5, "breakdown");
    expect(evolved.jitter).toBeGreaterThan(base.jitter);
  });

  it("vamp arc keeps tight jitter (locked groove)", () => {
    const evolved = evolveElement(base, 0.7, "vamp");
    expect(evolved.jitter).toBeLessThan(base.jitter);
  });

  it("intro arc is slightly loose", () => {
    const evolved = evolveElement(base, 0.5, "intro");
    expect(evolved.jitter).toBeGreaterThan(base.jitter * 0.9);
  });
});
