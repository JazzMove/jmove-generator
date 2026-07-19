import { describe, it, expect } from "vitest";
import {
  blendPresets,
  blendPresets3,
  blendGrooveTemplates,
  STYLE_PRESETS,
  getGrooveTemplate,
  generateEnsemble,
  scoreChordsToEvents,
  type StylePreset,
  type StyleParameters,
  type DrumGranular,
  type PianoGranular,
  type BassGranular,
  type GrooveTemplate,
} from "../src/index";

// Two presets with very different parameters for clear testing
const PRESET_A = STYLE_PRESETS.find(p => p.id === "hard-bop")!;
const PRESET_B = STYLE_PRESETS.find(p => p.id === "ecm")!;
const PRESET_FUNK = STYLE_PRESETS.find(p => p.id === "funk")!;
const PRESET_HYBRID = STYLE_PRESETS.find(p => p.instrumentStyles != null)!;

describe("Preset Blending (G30)", () => {
  describe("blendPresets - endpoints", () => {
    it("ratio=0 returns pure A parameters", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 0);
      expect(result.parameters.swingAmount).toBe(PRESET_A.parameters.swingAmount);
      expect(result.parameters.density).toBe(PRESET_A.parameters.density);
      expect(result.parameters.creativity).toBe(PRESET_A.parameters.creativity);
      expect(result.parameters.conversation).toBe(PRESET_A.parameters.conversation);
      expect(result.parameters.airGaps).toBe(PRESET_A.parameters.airGaps);
      expect(result.parameters.harmonicFreedom).toBe(PRESET_A.parameters.harmonicFreedom);
      expect(result.parameters.strumMs).toBe(PRESET_A.parameters.strumMs);
      expect(result.style).toBe(PRESET_A.style);
      expect(result.tempoRange).toEqual(PRESET_A.tempoRange);
    });

    it("ratio=1 returns pure B parameters", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 1);
      expect(result.parameters.swingAmount).toBe(PRESET_B.parameters.swingAmount);
      expect(result.parameters.density).toBe(PRESET_B.parameters.density);
      expect(result.parameters.creativity).toBe(PRESET_B.parameters.creativity);
      expect(result.parameters.airGaps).toBe(PRESET_B.parameters.airGaps);
      expect(result.parameters.harmonicFreedom).toBe(PRESET_B.parameters.harmonicFreedom);
      expect(result.parameters.strumMs).toBe(PRESET_B.parameters.strumMs);
      expect(result.style).toBe(PRESET_B.style);
      expect(result.tempoRange).toEqual(PRESET_B.tempoRange);
    });

    it("same preset blended with itself returns identical params", () => {
      const result = blendPresets(PRESET_A, PRESET_A, 0.73);
      expect(result.parameters.swingAmount).toBe(PRESET_A.parameters.swingAmount);
      expect(result.parameters.density).toBe(PRESET_A.parameters.density);
      expect(result.parameters.creativity).toBe(PRESET_A.parameters.creativity);
      expect(result.style).toBe(PRESET_A.style);
      expect(result.tempoRange).toEqual(PRESET_A.tempoRange);
    });
  });

  describe("blendPresets - interpolation", () => {
    it("ratio=0.5 gives midpoint parameters", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 0.5);
      // hardBop swing=80, ecm swing=10 -> midpoint=45
      expect(result.parameters.swingAmount).toBe(45);
      // hardBop density=70, ecm density=15 -> midpoint=42.5 -> 43
      expect(result.parameters.density).toBe(43);
      // hardBop strum=20, ecm strum=0 -> midpoint=10
      expect(result.parameters.strumMs).toBe(10);
    });

    it("all blended values are integers", () => {
      for (const ratio of [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9]) {
        const result = blendPresets(PRESET_A, PRESET_B, ratio);
        const p = result.parameters;
        expect(Number.isInteger(p.swingAmount)).toBe(true);
        expect(Number.isInteger(p.density)).toBe(true);
        expect(Number.isInteger(p.strumMs!)).toBe(true);
        expect(Number.isInteger(p.creativity!)).toBe(true);
        expect(Number.isInteger(p.conversation!)).toBe(true);
        expect(Number.isInteger(p.airGaps!)).toBe(true);
        expect(Number.isInteger(p.harmonicFreedom!)).toBe(true);
        expect(Number.isInteger(result.tempoRange[0])).toBe(true);
        expect(Number.isInteger(result.tempoRange[1])).toBe(true);
      }
    });

    it("monotonicity - params move toward B as ratio increases", () => {
      // hardBop swing=80, ecm swing=10 -> decreasing as ratio grows
      const ratios = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      const swings = ratios.map(r => blendPresets(PRESET_A, PRESET_B, r).parameters.swingAmount);
      for (let i = 1; i < swings.length; i++) {
        expect(swings[i]).toBeLessThanOrEqual(swings[i - 1]);
      }
      // hardBop airGaps=10, ecm airGaps=45 -> increasing
      const gaps = ratios.map(r => blendPresets(PRESET_A, PRESET_B, r).parameters.airGaps!);
      for (let i = 1; i < gaps.length; i++) {
        expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]);
      }
    });

    it("symmetry - blend(A, B, t) matches blend(B, A, 1-t) for params", () => {
      const ab = blendPresets(PRESET_A, PRESET_B, 0.3);
      const ba = blendPresets(PRESET_B, PRESET_A, 0.7);
      expect(ab.parameters.swingAmount).toBe(ba.parameters.swingAmount);
      expect(ab.parameters.density).toBe(ba.parameters.density);
      expect(ab.parameters.creativity).toBe(ba.parameters.creativity);
      expect(ab.parameters.airGaps).toBe(ba.parameters.airGaps);
      expect(ab.tempoRange[0]).toBe(ba.tempoRange[0]);
      expect(ab.tempoRange[1]).toBe(ba.tempoRange[1]);
    });
  });

  describe("blendPresets - style crossover", () => {
    it("ratio <= 0.5 uses A style", () => {
      expect(blendPresets(PRESET_A, PRESET_B, 0).style).toBe("hardBop");
      expect(blendPresets(PRESET_A, PRESET_B, 0.25).style).toBe("hardBop");
      expect(blendPresets(PRESET_A, PRESET_B, 0.5).style).toBe("hardBop");
    });

    it("ratio > 0.5 uses B style", () => {
      expect(blendPresets(PRESET_A, PRESET_B, 0.51).style).toBe("ecm");
      expect(blendPresets(PRESET_A, PRESET_B, 0.75).style).toBe("ecm");
      expect(blendPresets(PRESET_A, PRESET_B, 1.0).style).toBe("ecm");
    });
  });

  describe("blendPresets - clamping", () => {
    it("ratio < 0 clamped to 0 (pure A)", () => {
      const result = blendPresets(PRESET_A, PRESET_B, -0.5);
      expect(result.parameters.swingAmount).toBe(PRESET_A.parameters.swingAmount);
      expect(result.style).toBe(PRESET_A.style);
    });

    it("ratio > 1 clamped to 1 (pure B)", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 1.5);
      expect(result.parameters.swingAmount).toBe(PRESET_B.parameters.swingAmount);
      expect(result.style).toBe(PRESET_B.style);
    });

    it("strumMs stays within [0, 30]", () => {
      // Test all pairs at multiple ratios
      for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
        for (const preset of STYLE_PRESETS) {
          const result = blendPresets(PRESET_A, preset, ratio);
          expect(result.parameters.strumMs!).toBeGreaterThanOrEqual(0);
          expect(result.parameters.strumMs!).toBeLessThanOrEqual(30);
        }
      }
    });

    it("all params stay within [0, 100]", () => {
      for (const ratio of [0, 0.33, 0.5, 0.67, 1]) {
        const result = blendPresets(PRESET_A, PRESET_FUNK, ratio);
        const p = result.parameters;
        for (const val of [p.swingAmount, p.density, p.creativity!, p.conversation!, p.airGaps!, p.harmonicFreedom!]) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe("blendPresets - tempoRange", () => {
    it("interpolates both bounds", () => {
      // hardBop [140, 200], ecm [50, 90]
      const result = blendPresets(PRESET_A, PRESET_B, 0.5);
      expect(result.tempoRange[0]).toBe(95);
      expect(result.tempoRange[1]).toBe(145);
    });

    it("tempoRange[0] <= tempoRange[1] for all blends", () => {
      for (let i = 0; i < STYLE_PRESETS.length; i++) {
        for (let j = i + 1; j < STYLE_PRESETS.length; j++) {
          for (const ratio of [0.25, 0.5, 0.75]) {
            const result = blendPresets(STYLE_PRESETS[i], STYLE_PRESETS[j], ratio);
            expect(result.tempoRange[0]).toBeLessThanOrEqual(result.tempoRange[1]);
          }
        }
      }
    });
  });

  describe("blendPresets - instrumentStyles", () => {
    it("both undefined returns undefined", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 0.5);
      expect(result.instrumentStyles).toBeUndefined();
    });

    it("merge without conflict - both preserved", () => {
      const withPiano: StylePreset = { ...PRESET_A, instrumentStyles: { piano: "ecm" } };
      const withDrums: StylePreset = { ...PRESET_B, instrumentStyles: { drums: "funk" } };
      const result = blendPresets(withPiano, withDrums, 0.3);
      expect(result.instrumentStyles?.piano).toBe("ecm");
      expect(result.instrumentStyles?.drums).toBe("funk");
    });

    it("conflict resolved by dominant", () => {
      const withPianoA: StylePreset = { ...PRESET_A, instrumentStyles: { piano: "ecm" } };
      const withPianoB: StylePreset = { ...PRESET_B, instrumentStyles: { piano: "fusion" } };

      expect(blendPresets(withPianoA, withPianoB, 0.3).instrumentStyles?.piano).toBe("ecm");
      expect(blendPresets(withPianoA, withPianoB, 0.5).instrumentStyles?.piano).toBe("ecm");
      expect(blendPresets(withPianoA, withPianoB, 0.7).instrumentStyles?.piano).toBe("fusion");
    });

    it("one-sided instrumentStyles preserved", () => {
      const withStyles: StylePreset = { ...PRESET_A, instrumentStyles: { bass: "latin", piano: "ecm" } };
      const result = blendPresets(withStyles, PRESET_B, 0.8);
      expect(result.instrumentStyles?.bass).toBe("latin");
      expect(result.instrumentStyles?.piano).toBe("ecm");
    });

    it("hybrid preset blending works", () => {
      // PRESET_HYBRID has instrumentStyles defined
      const result = blendPresets(PRESET_HYBRID, PRESET_A, 0.3);
      // At t=0.3, A dominates (wait - PRESET_HYBRID is first arg = A)
      // t=0.3 <= 0.5, so A's instrumentStyles keys win on conflict
      expect(result.instrumentStyles).toBeDefined();
    });
  });

  describe("blendPresets - granular controls", () => {
    const drumA: DrumGranular = { tomFrequency: 0, fillIntensity: 100, rideWash: 50, ghostDensity: 20, cymbalColor: 80 };
    const drumB: DrumGranular = { tomFrequency: 100, fillIntensity: 0, rideWash: 50, ghostDensity: 80, cymbalColor: 20 };
    const pianoG: PianoGranular = { voicingDensity: 70, rhythmicActivity: 60, registerRange: 50, anticipation: 40, pianoRegister: 50 };
    const bassG: BassGranular = { chromaticApproach: 80, registerWidth: 60, syncopation: 40, beatVariety: 70, bassRegister: 30 };

    it("drum granular interpolated when both present", () => {
      const a: StylePreset = { ...PRESET_A, parameters: { ...PRESET_A.parameters, drumGranular: drumA } };
      const b: StylePreset = { ...PRESET_B, parameters: { ...PRESET_B.parameters, drumGranular: drumB } };
      const result = blendPresets(a, b, 0.5);
      expect(result.parameters.drumGranular?.tomFrequency).toBe(50);
      expect(result.parameters.drumGranular?.fillIntensity).toBe(50);
      expect(result.parameters.drumGranular?.rideWash).toBe(50);
      expect(result.parameters.drumGranular?.ghostDensity).toBe(50);
      expect(result.parameters.drumGranular?.cymbalColor).toBe(50);
    });

    it("piano granular interpolated when both present", () => {
      const pianoB: PianoGranular = { voicingDensity: 30, rhythmicActivity: 40, registerRange: 50, anticipation: 60, pianoRegister: 50 };
      const a: StylePreset = { ...PRESET_A, parameters: { ...PRESET_A.parameters, pianoGranular: pianoG } };
      const b: StylePreset = { ...PRESET_B, parameters: { ...PRESET_B.parameters, pianoGranular: pianoB } };
      const result = blendPresets(a, b, 0.5);
      expect(result.parameters.pianoGranular?.voicingDensity).toBe(50);
      expect(result.parameters.pianoGranular?.rhythmicActivity).toBe(50);
      expect(result.parameters.pianoGranular?.registerRange).toBe(50);
      expect(result.parameters.pianoGranular?.anticipation).toBe(50);
      expect(result.parameters.pianoGranular?.pianoRegister).toBe(50);
    });

    it("bass granular interpolated when both present", () => {
      const bassB: BassGranular = { chromaticApproach: 20, registerWidth: 40, syncopation: 60, beatVariety: 30, bassRegister: 70 };
      const a: StylePreset = { ...PRESET_A, parameters: { ...PRESET_A.parameters, bassGranular: bassG } };
      const b: StylePreset = { ...PRESET_B, parameters: { ...PRESET_B.parameters, bassGranular: bassB } };
      const result = blendPresets(a, b, 0.5);
      expect(result.parameters.bassGranular?.chromaticApproach).toBe(50);
      expect(result.parameters.bassGranular?.registerWidth).toBe(50);
      expect(result.parameters.bassGranular?.syncopation).toBe(50);
      expect(result.parameters.bassGranular?.beatVariety).toBe(50);
      expect(result.parameters.bassGranular?.bassRegister).toBe(50);
    });

    it("granular one-sided A - uses A regardless of ratio", () => {
      const a: StylePreset = { ...PRESET_A, parameters: { ...PRESET_A.parameters, pianoGranular: pianoG } };
      const b: StylePreset = { ...PRESET_B, parameters: { ...PRESET_B.parameters } };
      const result = blendPresets(a, b, 0.9);
      expect(result.parameters.pianoGranular).toEqual(pianoG);
    });

    it("granular one-sided B - uses B regardless of ratio", () => {
      const a: StylePreset = { ...PRESET_A, parameters: { ...PRESET_A.parameters } };
      const b: StylePreset = { ...PRESET_B, parameters: { ...PRESET_B.parameters, bassGranular: bassG } };
      const result = blendPresets(a, b, 0.1);
      expect(result.parameters.bassGranular).toEqual(bassG);
    });

    it("neither has granular - omitted from result", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 0.5);
      expect(result.parameters.drumGranular).toBeUndefined();
      expect(result.parameters.pianoGranular).toBeUndefined();
      expect(result.parameters.bassGranular).toBeUndefined();
    });

    it("granular values clamped to [0, 100]", () => {
      const extreme: DrumGranular = { tomFrequency: 100, fillIntensity: 100, rideWash: 100, ghostDensity: 100, cymbalColor: 100 };
      const a: StylePreset = { ...PRESET_A, parameters: { ...PRESET_A.parameters, drumGranular: extreme } };
      const b: StylePreset = { ...PRESET_B, parameters: { ...PRESET_B.parameters, drumGranular: extreme } };
      const result = blendPresets(a, b, 0.5);
      for (const key of ["tomFrequency", "fillIntensity", "rideWash", "ghostDensity", "cymbalColor"] as const) {
        expect(result.parameters.drumGranular![key]).toBeLessThanOrEqual(100);
        expect(result.parameters.drumGranular![key]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("blendPresets - metadata", () => {
    it("id format uses tilde separator", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 0.5);
      expect(result.id).toBe("hard-bop~ecm");
    });

    it("name format uses x separator", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 0.5);
      expect(result.name).toBe("Hard Bop Drive x ECM Space");
    });

    it("description at ratio=0 says 100% A, 0% B", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 0);
      expect(result.description).toBe("100% Hard Bop Drive, 0% ECM Space");
    });

    it("description at ratio=1 says 0% A, 100% B", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 1);
      expect(result.description).toBe("0% Hard Bop Drive, 100% ECM Space");
    });

    it("description at ratio=0.3 shows correct percentages", () => {
      const result = blendPresets(PRESET_A, PRESET_B, 0.3);
      expect(result.description).toBe("70% Hard Bop Drive, 30% ECM Space");
    });
  });

  describe("blendPresets - pairwise sanity", () => {
    it("all 27 presets blend pairwise without NaN or out-of-range", () => {
      for (let i = 0; i < STYLE_PRESETS.length; i++) {
        for (let j = i + 1; j < STYLE_PRESETS.length; j++) {
          for (const ratio of [0.25, 0.5, 0.75]) {
            const result = blendPresets(STYLE_PRESETS[i], STYLE_PRESETS[j], ratio);
            const p = result.parameters;
            // No NaN
            expect(Number.isNaN(p.swingAmount)).toBe(false);
            expect(Number.isNaN(p.density)).toBe(false);
            expect(Number.isNaN(p.creativity!)).toBe(false);
            expect(Number.isNaN(p.strumMs!)).toBe(false);
            // Range
            expect(p.swingAmount).toBeGreaterThanOrEqual(0);
            expect(p.swingAmount).toBeLessThanOrEqual(100);
            expect(p.density).toBeGreaterThanOrEqual(0);
            expect(p.density).toBeLessThanOrEqual(100);
            expect(p.strumMs!).toBeGreaterThanOrEqual(0);
            expect(p.strumMs!).toBeLessThanOrEqual(30);
            // Valid style
            expect(result.style).toBeTruthy();
            // Valid tempoRange
            expect(result.tempoRange[0]).toBeLessThanOrEqual(result.tempoRange[1]);
          }
        }
      }
    });
  });

  describe("blendPresets - integration with generateEnsemble", () => {
    it("blended preset produces valid ensemble output", () => {
      const blended = blendPresets(PRESET_A, PRESET_B, 0.4);
      const chords = [
        { root: "C", quality: "maj7", time: 0, duration: 2 },
        { root: "A", quality: "m7", time: 2, duration: 2 },
        { root: "D", quality: "m7", time: 4, duration: 2 },
        { root: "G", quality: "7", time: 6, duration: 2 },
      ];
      const result = generateEnsemble({
        chordEvents: chords,
        style: blended.style,
        tempo: 140,
        measures: 4,
        density: blended.parameters.density,
        swingAmount: blended.parameters.swingAmount,
        creativity: blended.parameters.creativity,
        conversation: blended.parameters.conversation,
        airGaps: blended.parameters.airGaps,
        harmonicFreedom: blended.parameters.harmonicFreedom,
      });
      expect(result.drums.length).toBeGreaterThan(0);
      expect(result.bass.length).toBeGreaterThan(0);
      expect(result.piano.length).toBeGreaterThan(0);
    });

    it("blend at crossover point (0.5) produces valid output", () => {
      const blended = blendPresets(PRESET_FUNK, PRESET_B, 0.5);
      const chords = [
        { root: "Eb", quality: "7", time: 0, duration: 4 },
        { root: "Ab", quality: "7", time: 4, duration: 4 },
      ];
      const result = generateEnsemble({
        chordEvents: chords,
        style: blended.style,
        tempo: Math.round((blended.tempoRange[0] + blended.tempoRange[1]) / 2),
        measures: 2,
        density: blended.parameters.density,
        swingAmount: blended.parameters.swingAmount,
      });
      expect(result.drums.length).toBeGreaterThan(0);
      expect(result.bass.length).toBeGreaterThan(0);
    });
  });

  describe("blendGrooveTemplates", () => {
    it("ratio=0 returns pure A template", () => {
      const a = getGrooveTemplate("hardBop");
      const result = blendGrooveTemplates("hardBop", "ecm", 0);
      expect(result.kick.bias).toBeCloseTo(a.kick.bias);
      expect(result.kick.jitter).toBeCloseTo(a.kick.jitter);
      expect(result.snare.bias).toBeCloseTo(a.snare.bias);
      expect(result.hihat.bias).toBeCloseTo(a.hihat.bias);
      expect(result.ride.bias).toBeCloseTo(a.ride.bias);
      expect(result.crash.bias).toBeCloseTo(a.crash.bias);
      expect(result.bass.bias).toBeCloseTo(a.bass.bias);
      expect(result.bassOffbeat.bias).toBeCloseTo(a.bassOffbeat.bias);
      expect(result.piano.bias).toBeCloseTo(a.piano.bias);
      expect(result.pianoAnticipation.bias).toBeCloseTo(a.pianoAnticipation.bias);
    });

    it("ratio=1 returns pure B template", () => {
      const b = getGrooveTemplate("ecm");
      const result = blendGrooveTemplates("hardBop", "ecm", 1);
      expect(result.kick.bias).toBeCloseTo(b.kick.bias);
      expect(result.kick.jitter).toBeCloseTo(b.kick.jitter);
      expect(result.piano.bias).toBeCloseTo(b.piano.bias);
      expect(result.pianoAnticipation.bias).toBeCloseTo(b.pianoAnticipation.bias);
    });

    it("midpoint interpolates all bias and jitter", () => {
      const a = getGrooveTemplate("hardBop");
      const b = getGrooveTemplate("ecm");
      const result = blendGrooveTemplates("hardBop", "ecm", 0.5);

      for (const key of ["kick", "snare", "hihat", "ride", "crash", "bass", "bassOffbeat", "piano", "pianoAnticipation"] as const) {
        expect(result[key].bias).toBeCloseTo((a[key].bias + b[key].bias) / 2);
        expect(result[key].jitter).toBeCloseTo((a[key].jitter + b[key].jitter) / 2);
      }
    });

    it("unknown style falls back to swing", () => {
      const swing = getGrooveTemplate("swing");
      const result = blendGrooveTemplates("nonexistent", "ecm", 0);
      expect(result.kick.bias).toBeCloseTo(swing.kick.bias);
      expect(result.piano.bias).toBeCloseTo(swing.piano.bias);
    });

    it("clamping - out-of-range ratio treated as endpoint", () => {
      const a = getGrooveTemplate("hardBop");
      const b = getGrooveTemplate("ecm");
      const low = blendGrooveTemplates("hardBop", "ecm", -1);
      const high = blendGrooveTemplates("hardBop", "ecm", 2);
      expect(low.kick.bias).toBeCloseTo(a.kick.bias);
      expect(high.kick.bias).toBeCloseTo(b.kick.bias);
    });

    it("symmetry - blend(A, B, 0.3) == blend(B, A, 0.7) for all elements", () => {
      const ab = blendGrooveTemplates("hardBop", "ecm", 0.3);
      const ba = blendGrooveTemplates("ecm", "hardBop", 0.7);
      for (const key of ["kick", "snare", "hihat", "ride", "crash", "bass", "bassOffbeat", "piano", "pianoAnticipation"] as const) {
        expect(ab[key].bias).toBeCloseTo(ba[key].bias);
        expect(ab[key].jitter).toBeCloseTo(ba[key].jitter);
      }
    });

    it("result has all 9 required GrooveTemplate fields", () => {
      const result = blendGrooveTemplates("swing", "funk", 0.5);
      const keys: (keyof GrooveTemplate)[] = ["kick", "snare", "hihat", "ride", "crash", "bass", "bassOffbeat", "piano", "pianoAnticipation"];
      for (const key of keys) {
        expect(result[key]).toBeDefined();
        expect(typeof result[key].bias).toBe("number");
        expect(typeof result[key].jitter).toBe("number");
        expect(Number.isNaN(result[key].bias)).toBe(false);
        expect(Number.isNaN(result[key].jitter)).toBe(false);
      }
    });
  });

  describe("blendPresets3 - 3-way triangle blending", () => {
    const PRESET_C = STYLE_PRESETS.find(p => p.id === "funk")!;

    it("weight=[1,0,0] returns pure A parameters", () => {
      const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [1, 0, 0]);
      expect(result.parameters.swingAmount).toBe(PRESET_A.parameters.swingAmount);
      expect(result.parameters.density).toBe(PRESET_A.parameters.density);
      expect(result.style).toBe(PRESET_A.style);
      expect(result.tempoRange).toEqual(PRESET_A.tempoRange);
    });

    it("weight=[0,1,0] returns pure B parameters", () => {
      const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0, 1, 0]);
      expect(result.parameters.swingAmount).toBe(PRESET_B.parameters.swingAmount);
      expect(result.parameters.density).toBe(PRESET_B.parameters.density);
      expect(result.style).toBe(PRESET_B.style);
      expect(result.tempoRange).toEqual(PRESET_B.tempoRange);
    });

    it("weight=[0,0,1] returns pure C parameters", () => {
      const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0, 0, 1]);
      expect(result.parameters.swingAmount).toBe(PRESET_C.parameters.swingAmount);
      expect(result.parameters.density).toBe(PRESET_C.parameters.density);
      expect(result.style).toBe(PRESET_C.style);
      expect(result.tempoRange).toEqual(PRESET_C.tempoRange);
    });

    it("equal weights give weighted average at center", () => {
      const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [1, 1, 1]);
      // hardBop swing=80, ecm swing=10, funk swing=5 -> avg ~32
      const expected = Math.round((PRESET_A.parameters.swingAmount + PRESET_B.parameters.swingAmount + PRESET_C.parameters.swingAmount) / 3);
      expect(result.parameters.swingAmount).toBe(expected);
    });

    it("dominant style = highest weight", () => {
      expect(blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0.5, 0.3, 0.2]).style).toBe(PRESET_A.style);
      expect(blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0.2, 0.5, 0.3]).style).toBe(PRESET_B.style);
      expect(blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0.2, 0.3, 0.5]).style).toBe(PRESET_C.style);
    });

    it("weights auto-normalize to sum=1", () => {
      const result1 = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [2, 2, 2]);
      const result2 = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [1, 1, 1]);
      expect(result1.parameters.swingAmount).toBe(result2.parameters.swingAmount);
      expect(result1.parameters.density).toBe(result2.parameters.density);
    });

    it("negative weights clamped to 0", () => {
      const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [-1, 1, 0]);
      // -1 clamped to 0, so effectively [0,1,0] = pure B
      expect(result.parameters.swingAmount).toBe(PRESET_B.parameters.swingAmount);
      expect(result.style).toBe(PRESET_B.style);
    });

    it("all zero weights default to equal thirds", () => {
      const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0, 0, 0]);
      const expected = Math.round((PRESET_A.parameters.swingAmount + PRESET_B.parameters.swingAmount + PRESET_C.parameters.swingAmount) / 3);
      expect(result.parameters.swingAmount).toBe(expected);
    });

    it("all values are integers within [0, 100]", () => {
      for (const w of [[0.5, 0.3, 0.2], [0.1, 0.8, 0.1], [0.33, 0.33, 0.34]] as [number, number, number][]) {
        const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, w);
        const p = result.parameters;
        for (const val of [p.swingAmount, p.density, p.creativity!, p.conversation!, p.airGaps!, p.harmonicFreedom!]) {
          expect(Number.isInteger(val)).toBe(true);
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(100);
        }
        expect(p.strumMs!).toBeGreaterThanOrEqual(0);
        expect(p.strumMs!).toBeLessThanOrEqual(30);
      }
    });

    it("tempoRange bounds ordered correctly", () => {
      for (let i = 0; i < STYLE_PRESETS.length - 2; i++) {
        const result = blendPresets3(STYLE_PRESETS[i], STYLE_PRESETS[i + 1], STYLE_PRESETS[i + 2], [0.4, 0.3, 0.3]);
        expect(result.tempoRange[0]).toBeLessThanOrEqual(result.tempoRange[1]);
      }
    });

    it("id uses double tilde separator for 3-way", () => {
      const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0.5, 0.3, 0.2]);
      expect(result.id).toBe("hard-bop~ecm~funk");
    });

    it("description shows 3 percentages", () => {
      const result = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0.5, 0.3, 0.2]);
      expect(result.description).toMatch(/^50% .+, 30% .+, 20% .+$/);
    });

    it("2-way blend matches 3-way with third weight=0", () => {
      const twoWay = blendPresets(PRESET_A, PRESET_B, 0.4);
      const threeWay = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0.6, 0.4, 0]);
      expect(threeWay.parameters.swingAmount).toBe(twoWay.parameters.swingAmount);
      expect(threeWay.parameters.density).toBe(twoWay.parameters.density);
      expect(threeWay.parameters.creativity).toBe(twoWay.parameters.creativity);
    });

    it("integration - generates valid ensemble from 3-way blend", () => {
      const blended = blendPresets3(PRESET_A, PRESET_B, PRESET_C, [0.4, 0.35, 0.25]);
      const chords = [
        { root: "C", quality: "maj7", time: 0, duration: 2 },
        { root: "A", quality: "m7", time: 2, duration: 2 },
        { root: "D", quality: "m7", time: 4, duration: 2 },
        { root: "G", quality: "7", time: 6, duration: 2 },
      ];
      const result = generateEnsemble({
        chordEvents: chords,
        style: blended.style,
        tempo: Math.round((blended.tempoRange[0] + blended.tempoRange[1]) / 2),
        measures: 4,
        density: blended.parameters.density,
        swingAmount: blended.parameters.swingAmount,
        creativity: blended.parameters.creativity,
      });
      expect(result.drums.length).toBeGreaterThan(0);
      expect(result.bass.length).toBeGreaterThan(0);
      expect(result.piano.length).toBeGreaterThan(0);
    });

    it("instrumentStyles - dominant per-instrument from highest weight", () => {
      const withPianoA: StylePreset = { ...PRESET_A, instrumentStyles: { piano: "ecm" } };
      const withPianoB: StylePreset = { ...PRESET_B, instrumentStyles: { piano: "fusion" } };
      const withPianoC: StylePreset = { ...PRESET_C, instrumentStyles: { piano: "funk" } };

      // B has highest weight -> B's piano style wins
      const result = blendPresets3(withPianoA, withPianoB, withPianoC, [0.2, 0.5, 0.3]);
      expect(result.instrumentStyles?.piano).toBe("fusion");
    });

    it("pairwise sanity - 10 random triples no NaN", () => {
      const n = STYLE_PRESETS.length;
      for (let trial = 0; trial < 10; trial++) {
        const i = trial % n;
        const j = (trial * 3 + 1) % n;
        const k = (trial * 7 + 2) % n;
        const result = blendPresets3(STYLE_PRESETS[i], STYLE_PRESETS[j], STYLE_PRESETS[k], [0.4, 0.35, 0.25]);
        expect(Number.isNaN(result.parameters.swingAmount)).toBe(false);
        expect(Number.isNaN(result.parameters.density)).toBe(false);
        expect(result.style).toBeTruthy();
      }
    });
  });
});
