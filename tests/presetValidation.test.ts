import { describe, it, expect } from "vitest";
import {
  STYLE_PRESETS,
  STYLE_CATEGORIES,
  STYLE_LABELS,
  FORM_LABELS,
  ALL_KEYS,
  generateJamSession,
  generateWalkingBass,
  generatePianoComping,
  generateDrumPattern,
  scoreChordsToEvents,
  type JamForm,
  type PracticeStyle,
  type StylePreset,
} from "../src/index";

// ── Preset Schema Validation ──

describe("preset schema validation", () => {
  it("all presets have required fields", () => {
    for (const p of STYLE_PRESETS) {
      expect(p.id, `${p.name} missing id`).toBeTruthy();
      expect(p.name, `${p.id} missing name`).toBeTruthy();
      expect(p.description, `${p.id} missing description`).toBeTruthy();
      expect(p.style, `${p.id} missing style`).toBeTruthy();
      expect(p.parameters, `${p.id} missing parameters`).toBeDefined();
      expect(p.tempoRange, `${p.id} missing tempoRange`).toBeDefined();
    }
  });

  it("all preset IDs are kebab-case", () => {
    for (const p of STYLE_PRESETS) {
      expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("all preset IDs are unique", () => {
    const ids = STYLE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("swingAmount is 0-100", () => {
    for (const p of STYLE_PRESETS) {
      expect(p.parameters.swingAmount, `${p.id} swingAmount`).toBeGreaterThanOrEqual(0);
      expect(p.parameters.swingAmount, `${p.id} swingAmount`).toBeLessThanOrEqual(100);
    }
  });

  it("density is 0-100", () => {
    for (const p of STYLE_PRESETS) {
      expect(p.parameters.density, `${p.id} density`).toBeGreaterThanOrEqual(0);
      expect(p.parameters.density, `${p.id} density`).toBeLessThanOrEqual(100);
    }
  });

  it("tempoRange[0] < tempoRange[1]", () => {
    for (const p of STYLE_PRESETS) {
      expect(p.tempoRange[0], `${p.id} tempo min`).toBeLessThan(p.tempoRange[1]);
    }
  });

  it("tempoRange values are realistic BPM (30-300)", () => {
    for (const p of STYLE_PRESETS) {
      expect(p.tempoRange[0], `${p.id} min too low`).toBeGreaterThanOrEqual(30);
      expect(p.tempoRange[1], `${p.id} max too high`).toBeLessThanOrEqual(300);
    }
  });

  it("all preset styles exist in STYLE_LABELS", () => {
    for (const p of STYLE_PRESETS) {
      expect(STYLE_LABELS[p.style], `${p.id} style '${p.style}' not in STYLE_LABELS`).toBeTruthy();
    }
  });

  it("all instrument override styles are valid", () => {
    const validStyles = new Set(Object.keys(STYLE_LABELS));
    for (const p of STYLE_PRESETS) {
      if (p.instrumentStyles) {
        if (p.instrumentStyles.bass) expect(validStyles.has(p.instrumentStyles.bass), `${p.id} bass style`).toBe(true);
        if (p.instrumentStyles.piano) expect(validStyles.has(p.instrumentStyles.piano), `${p.id} piano style`).toBe(true);
        if (p.instrumentStyles.drums) expect(validStyles.has(p.instrumentStyles.drums), `${p.id} drums style`).toBe(true);
      }
    }
  });

  it("all categories reference valid styles", () => {
    const validStyles = new Set(Object.keys(STYLE_LABELS));
    for (const [cat, styles] of Object.entries(STYLE_CATEGORIES)) {
      for (const style of styles) {
        expect(validStyles.has(style), `category '${cat}' has invalid style '${style}'`).toBe(true);
      }
    }
  });

  it("all styles appear in at least one category", () => {
    const categorized = new Set(Object.values(STYLE_CATEGORIES).flat());
    for (const style of Object.keys(STYLE_LABELS)) {
      expect(categorized.has(style as PracticeStyle), `style '${style}' not in any category`).toBe(true);
    }
  });
});

// ── Generation Smoke Tests: every preset × representative forms ──

const FORMS_TO_TEST: JamForm[] = ["blues12", "rhythm32", "aaba32", "modal16", "turnaround8", "fullSong"];

describe("preset × form generation smoke tests", () => {
  // Test pure style presets (no instrument overrides) against all forms
  const purePresets = STYLE_PRESETS.filter((p) => !p.instrumentStyles);

  for (const preset of purePresets) {
    describe(`preset: ${preset.name} (${preset.style})`, () => {
      const tempo = Math.round((preset.tempoRange[0] + preset.tempoRange[1]) / 2);

      for (const form of FORMS_TO_TEST) {
        it(`generates ${form} without errors`, () => {
          const result = generateJamSession({
            key: "C",
            form,
            style: preset.style,
            tempo,
            timeSignature: [4, 4],
          });

          expect(result.score.measures.length).toBeGreaterThan(0);
          expect(result.progressionLabel).toBeTruthy();

          // Verify chords exist
          const chordCount = result.score.measures.reduce((n, m) => n + m.chords.length, 0);
          expect(chordCount, "should have chords").toBeGreaterThan(0);
        });
      }

      it("generates walking bass from blues12", () => {
        const result = generateJamSession({ key: "Bb", form: "blues12", style: preset.style, tempo, timeSignature: [4, 4] });
        const chords = scoreChordsToEvents(result.score.measures);
        const bass = generateWalkingBass(chords, { style: preset.style, tempo });
        expect(bass.length, `${preset.id} bass`).toBeGreaterThan(0);
      });

      it("generates piano comping from blues12", () => {
        const result = generateJamSession({ key: "Bb", form: "blues12", style: preset.style, tempo, timeSignature: [4, 4] });
        const chords = scoreChordsToEvents(result.score.measures);
        const piano = generatePianoComping(chords, { style: preset.style, tempo });
        expect(piano.length, `${preset.id} piano`).toBeGreaterThan(0);
      });

      it("generates drum pattern", () => {
        const drums = generateDrumPattern({ style: preset.style, tempo, measures: 4, timeSignature: [4, 4] });
        expect(drums.length, `${preset.id} drums`).toBeGreaterThan(0);
      });
    });
  }
});

// ── Full Pipeline Smoke: all 12 keys ──

describe("all keys produce valid output", () => {
  for (const key of ALL_KEYS) {
    it(`key ${key} — blues12 generates valid session`, () => {
      const result = generateJamSession({ key, form: "blues12", style: "swing", tempo: 140, timeSignature: [4, 4] });
      expect(result.score.measures).toHaveLength(12);
      const chords = scoreChordsToEvents(result.score.measures);
      expect(chords.length).toBeGreaterThan(0);
      const bass = generateWalkingBass(chords, { style: "swing", tempo: 140 });
      expect(bass.length).toBeGreaterThan(0);
    });
  }
});
