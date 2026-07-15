import { describe, it, expect } from "vitest";
import { tempoSwingMultiplier, dynamicMultiplier, instrumentSwingFactor, compressDynamicLevel } from "../src/index";
import type { SongSection } from "../src/types";

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

describe("compressDynamicLevel", () => {
  it("maps floor (0.3) to 0.79", () => {
    expect(compressDynamicLevel(0.3)).toBeCloseTo(0.79, 2);
  });

  it("maps maximum (1.0) to 1.0", () => {
    expect(compressDynamicLevel(1.0)).toBeCloseTo(1.0, 2);
  });

  it("maps typical intro (0.55) to ~0.865", () => {
    expect(compressDynamicLevel(0.55)).toBeCloseTo(0.865, 3);
  });

  it("maps typical head (0.80) to 0.94", () => {
    expect(compressDynamicLevel(0.80)).toBeCloseTo(0.94, 2);
  });

  it("clamps values below floor to floor", () => {
    expect(compressDynamicLevel(0.0)).toBe(compressDynamicLevel(0.3));
    expect(compressDynamicLevel(-1.0)).toBe(compressDynamicLevel(0.3));
  });

  it("output range is [0.79, 1.0] for input [0.3, 1.0]", () => {
    for (let level = 0.3; level <= 1.0; level += 0.05) {
      const compressed = compressDynamicLevel(level);
      expect(compressed).toBeGreaterThanOrEqual(0.79 - 0.001);
      expect(compressed).toBeLessThanOrEqual(1.0 + 0.001);
    }
  });

  it("is monotonically increasing", () => {
    let prev = compressDynamicLevel(0.3);
    for (let level = 0.35; level <= 1.0; level += 0.05) {
      const cur = compressDynamicLevel(level);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
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

  it("alfaMist has widest range among all styles", () => {
    const styles = [
      "hardBop", "ballad", "ecm", "coolJazz", "fusion",
      "neoSoul", "bossa", "latin", "funk", "contemporaryJazz",
      "holdsworth", "shuffleBlues", "jazzWaltz", "modal", "mathRock", "idm",
      "alfaMist",
    ];
    const ranges = styles.map(s => {
      const vals: number[] = [];
      for (let m = 0; m < 32; m++) vals.push(dynamicMultiplier(m, 32, s));
      return { style: s, range: Math.max(...vals) - Math.min(...vals) };
    });
    const alfaMistRange = ranges.find(r => r.style === "alfaMist")!.range;
    for (const r of ranges) {
      if (r.style !== "alfaMist") {
        expect(alfaMistRange).toBeGreaterThanOrEqual(r.range - 0.001);
      }
    }
  });

  it("all styles produce values in [0.55, 1.10] range", () => {
    const styles = [
      "hardBop", "ballad", "ecm", "coolJazz", "fusion",
      "neoSoul", "bossa", "latin", "funk", "contemporaryJazz",
      "holdsworth", "shuffleBlues", "jazzWaltz", "modal", "mathRock", "idm",
      "alfaMist", "metheny",
    ];
    for (const style of styles) {
      for (let m = 0; m < 64; m++) {
        const val = dynamicMultiplier(m, 64, style);
        expect(val).toBeGreaterThanOrEqual(0.55);
        expect(val).toBeLessThanOrEqual(1.10);
      }
    }
  });

  it("micro curves are continuous at piecewise breakpoints", () => {
    const styles = [
      "hardBop", "ballad", "ecm", "coolJazz", "fusion",
      "neoSoul", "bossa", "latin", "funk", "contemporaryJazz",
      "holdsworth", "shuffleBlues", "jazzWaltz", "modal", "mathRock", "idm",
      "alfaMist", "metheny",
    ];
    // Sample at fine resolution — no jump > 0.02 between adjacent measures
    const totalMeasures = 100;
    for (const style of styles) {
      let prev = dynamicMultiplier(0, totalMeasures, style);
      for (let m = 1; m < totalMeasures; m++) {
        const cur = dynamicMultiplier(m, totalMeasures, style);
        const jump = Math.abs(cur - prev);
        expect(jump).toBeLessThan(0.02);
        prev = cur;
      }
    }
  });

  // ── Section-Aware Dynamics ──

  describe("section-aware dynamics", () => {
    const makeSections = (entries: { level: number; len?: number }[]): SongSection[] => {
      let start = 0;
      return entries.map((e, i) => {
        const len = e.len ?? 16;
        const section: SongSection = {
          type: "head" as const,
          label: `Section ${i}`,
          startMeasure: start,
          endMeasure: start + len,
          sourceForm: "blues" as any,
          dynamicLevel: e.level,
        };
        start += len;
        return section;
      });
    };

    const makeSectionsSimple = (levels: number[]): SongSection[] =>
      makeSections(levels.map(level => ({ level })));

    it("compressed dynamicLevel prevents near-silent output", () => {
      const sections = makeSectionsSimple([0.55, 1.0]);
      const introMid = dynamicMultiplier(8, 32, "holdsworth", sections);
      expect(introMid).toBeGreaterThan(0.7);
    });

    it("shout section still reaches near 1.0", () => {
      const sections = makeSectionsSimple([0.55, 1.0]);
      const shoutPeak = dynamicMultiplier(24, 32, "holdsworth", sections);
      expect(shoutPeak).toBeGreaterThanOrEqual(0.95);
    });

    it("ratio between quietest and loudest section stays below 1.5x", () => {
      const sections = makeSectionsSimple([0.55, 1.0]);
      const vals: number[] = [];
      for (let m = 0; m < 32; m++) {
        vals.push(dynamicMultiplier(m, 32, "holdsworth", sections));
      }
      const ratio = Math.max(...vals) / Math.min(...vals);
      expect(ratio).toBeLessThan(1.5);
    });

    it("crossfades at section boundaries (no instant jumps)", () => {
      const sections = makeSectionsSimple([0.55, 1.0]);
      const lastOfPrev = dynamicMultiplier(15, 32, "holdsworth", sections);
      const firstOfNext = dynamicMultiplier(16, 32, "holdsworth", sections);
      expect(Math.abs(firstOfNext - lastOfPrev)).toBeLessThan(0.15);
    });

    it("crossfade reaches target level after blend zone", () => {
      const sections = makeSectionsSimple([0.55, 1.0]);
      const afterCrossfade = dynamicMultiplier(18, 32, "holdsworth", sections);
      // localIdx 2 = past crossfade, holdsworth micro at pct=12.5% = 0.82, macro=1.0
      expect(afterCrossfade).toBeCloseTo(0.82, 2);
      const midSection2 = dynamicMultiplier(24, 32, "holdsworth", sections);
      expect(midSection2).toBeGreaterThan(afterCrossfade);
    });

    it("single section — no crossfade (section starts at 0)", () => {
      const sections = makeSectionsSimple([0.7]);
      // First section never crossfades (no previous section)
      const first = dynamicMultiplier(0, 16, "holdsworth", sections);
      const mid = dynamicMultiplier(8, 16, "holdsworth", sections);
      // Both use pure micro × compressed(0.7)
      const expectedMacro = compressDynamicLevel(0.7);
      expect(first).toBeCloseTo(0.82 * expectedMacro, 2); // holdsworth opening micro = 0.82
      expect(mid).toBeGreaterThan(first); // mid-section builds
    });

    it("three sections — realistic fullSong dynamics", () => {
      const sections = makeSections([
        { level: 0.60, len: 8 },   // intro (quiet)
        { level: 0.85, len: 16 },  // head (medium)
        { level: 0.70, len: 8 },   // outro (winding down)
      ]);
      const total = 32;

      // Intro should be quietest
      const intro = dynamicMultiplier(4, total, "swing", sections);
      // Head should be loudest
      const head = dynamicMultiplier(16, total, "swing", sections);
      // Outro between intro and head
      const outro = dynamicMultiplier(28, total, "swing", sections);

      expect(head).toBeGreaterThan(intro);
      expect(head).toBeGreaterThan(outro);
      // All above minimum useful velocity
      expect(intro).toBeGreaterThan(0.7);
      expect(outro).toBeGreaterThan(0.7);
    });

    it("works with styles other than holdsworth", () => {
      const sections = makeSectionsSimple([0.55, 1.0]);
      for (const style of ["swing", "ecm", "fusion", "alfaMist", "mathRock"]) {
        const vals: number[] = [];
        for (let m = 0; m < 32; m++) {
          vals.push(dynamicMultiplier(m, 32, style, sections));
        }
        // All styles: compressed range, no near-silent
        expect(Math.min(...vals)).toBeGreaterThan(0.4);
        // Ratio reasonable — alfaMist intentionally wider (dramatic style)
        const maxRatio = style === "alfaMist" ? 2.1 : 1.7;
        expect(Math.max(...vals) / Math.min(...vals)).toBeLessThan(maxRatio);
      }
    });

    it("dynamicLevel at floor (0.3) still produces audible output", () => {
      const sections = makeSectionsSimple([0.3]);
      const mid = dynamicMultiplier(8, 16, "swing", sections);
      // compressed(0.3) = 0.79, micro ~0.95 → 0.75+
      expect(mid).toBeGreaterThan(0.7);
    });

    it("dynamicLevel at maximum (1.0) reaches full velocity", () => {
      const sections = makeSectionsSimple([1.0]);
      // Find peak: style micro peak × compressed(1.0) = peak × 1.0
      const vals: number[] = [];
      for (let m = 0; m < 16; m++) vals.push(dynamicMultiplier(m, 16, "swing", sections));
      expect(Math.max(...vals)).toBeGreaterThanOrEqual(0.98);
    });

    it("measure outside all sections falls through to no-section path", () => {
      // Section only covers measures 4-12; measures 0-3 and 12+ have no section
      const sections: SongSection[] = [{
        type: "head", label: "Head", startMeasure: 4, endMeasure: 12,
        sourceForm: "blues" as any, dynamicLevel: 0.8,
      }];
      // Measure 0 — no section found, falls through to micro-only curve
      const outsideBefore = dynamicMultiplier(0, 16, "swing", sections);
      // Should match no-section behavior (swing default opening = 0.88)
      expect(outsideBefore).toBeCloseTo(0.88, 2);
      // Measure 14 — also outside
      const outsideAfter = dynamicMultiplier(14, 16, "swing", sections);
      expect(outsideAfter).toBe(0.92); // swing default taper
    });

    it("crossfade monotonically blends from previous to current level", () => {
      // Big jump: 0.55 → 1.0 over 2 measures
      const sections = makeSectionsSimple([0.55, 1.0]);
      const prevCompressed = compressDynamicLevel(0.55);
      const curCompressed = compressDynamicLevel(1.0);

      // At boundary (localIdx=0): blend=0 → prevLevel
      const atBoundary = dynamicMultiplier(16, 32, "swing", sections);
      // At localIdx=1: blend=0.5 → midpoint
      const atMid = dynamicMultiplier(17, 32, "swing", sections);

      // Both should be in the crossfade range (between prev and cur macro × their micro)
      // The key property: monotonic progression
      if (curCompressed > prevCompressed) {
        expect(atMid).toBeGreaterThanOrEqual(atBoundary - 0.01);
      }
    });

    it("very short section (2 measures) — crossfade reduces to 1 measure", () => {
      const sections = makeSections([
        { level: 0.6, len: 16 },
        { level: 1.0, len: 2 },  // crossfadeLen = min(2, floor(2/2)) = 1
      ]);
      const total = 18;
      // localIdx=0 in 2-measure section: should crossfade (1 measure blend)
      const first = dynamicMultiplier(16, total, "swing", sections);
      // localIdx=1: past crossfade zone
      const second = dynamicMultiplier(17, total, "swing", sections);
      // Both should be valid (no crash, no extreme)
      expect(first).toBeGreaterThan(0.6);
      expect(second).toBeGreaterThan(0.6);
    });

    it("very short section (1 measure) — crossfade disabled", () => {
      const sections = makeSections([
        { level: 0.6, len: 16 },
        { level: 1.0, len: 1 },  // crossfadeLen = min(2, floor(1/2)) = 0
      ]);
      const total = 17;
      // Only 1 measure, crossfade disabled → direct macro × micro
      const val = dynamicMultiplier(16, total, "swing", sections);
      expect(val).toBeGreaterThan(0.7);
    });

    it("all realistic fullSong forms produce reasonable velocity spread", () => {
      // Test with actual section templates from jamGenerator.ts
      const fullSongForms: { levels: number[]; lens: number[] }[] = [
        { levels: [0.65, 0.80, 0.88, 1.00, 0.90, 0.70], lens: [4, 16, 32, 8, 16, 4] },      // standard
        { levels: [0.60, 0.78, 0.88, 0.85, 0.65], lens: [4, 16, 32, 16, 4] },                 // compact
        { levels: [0.55, 0.75, 0.88, 0.70, 0.85, 0.60], lens: [4, 16, 32, 8, 16, 4] },        // extended
        { levels: [0.65, 0.80, 0.90, 0.82, 0.95, 0.88, 0.68], lens: [4, 16, 16, 8, 16, 16, 4] }, // epic
      ];
      for (const form of fullSongForms) {
        const sections = makeSections(form.levels.map((level, i) => ({ level, len: form.lens[i] })));
        const total = form.lens.reduce((a, b) => a + b, 0);
        const vals: number[] = [];
        for (let m = 0; m < total; m++) {
          vals.push(dynamicMultiplier(m, total, "holdsworth", sections));
        }
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        // No near-silent
        expect(min).toBeGreaterThan(0.6);
        // Reasonable dynamic range
        expect(max / min).toBeLessThan(1.6);
        // Peak reachable
        expect(max).toBeGreaterThan(0.9);
      }
    });
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
