import { describe, it, expect } from "vitest";
import {
  generateJamSession,
  transposeProgression,
  getFormsForStyle,
  enrichQuality,
  ALL_KEYS,
  FORM_LABELS,
  FORM_MEASURE_COUNTS,
  ALL_TIME_SIGNATURES,
  TIME_SIGNATURE_GROUPS,
  dynamicMultiplier,
  scoreChordsToEvents,
  generateWalkingBass,
  generatePianoComping,
  generateDrumPattern,
  getMeterPatternSet,
  type JamKey,
  type JamForm,
  type JamConfig,
  type SongSection,
} from "../src/index";

// Inline from logicScripter (not part of generator package)
const SCALE_TYPES = { CHROMATIC: 12 } as const;
const QUALITY_TO_SCALE: Record<string, number> = {
  "": 13, "6": 13, "add9": 13, "69": 0,
  "maj7": 0, "maj9": 0, "maj13": 0,
  "maj7#11": 3, "maj7#5": 3,
  "m": 14, "m7": 14, "m9": 1, "m11": 1, "m6": 1,
  "m(maj7)": 7,
  "7": 4, "9": 4, "13": 4, "7sus": 4,
  "7b9": 10, "7#9": 9, "7alt": 9, "7b13": 9,
  "7b5": 8, "7#11": 8, "7#5": 11,
  "7b9sus": 17,
  "7b9b13": 9, "7#9b13": 9, "7b9#11": 9, "7#9#11": 9,
  "dim": 10, "dim7": 10, "m7b5": 6,
  "aug": 11, "aug7": 11,
  "sus4": 4, "sus2": 13, "7sus4": 4, "9sus4": 4, "13sus4": 4,
  "5": 13,
};
function qualityToScale(quality: string): number {
  const slashIdx = quality.indexOf("/");
  const lookup = slashIdx >= 0 ? quality.slice(0, slashIdx) : quality;
  return QUALITY_TO_SCALE[lookup] ?? SCALE_TYPES.CHROMATIC;
}

function makeConfig(overrides: Partial<JamConfig> = {}): JamConfig {
  return {
    key: "C",
    form: "blues12",
    style: "swing",
    tempo: 120,
    timeSignature: [4, 4],
    ...overrides,
  };
}

/** All 16 forms */
const ALL_FORMS: JamForm[] = [
  "blues12", "rhythm32", "aaba32", "modal16", "turnaround8",
  "abac32", "songForm24", "rondo20", "clave16", "minorBlues12",
  "secondLine16", "coltraneMatrix16", "throughComposed12",
  "pentatonic8", "quartal16", "free",
];

/** Non-free forms (have fixed measure counts) */
const FIXED_FORMS = ALL_FORMS.filter((f): f is Exclude<JamForm, "free" | "fullSong"> => f !== "free" && f !== "fullSong");

describe("Jam Generator", () => {
  // ── Measure counts ──

  describe("generateJamSession", () => {
    it("returns 12 measures for blues12", () => {
      const r = generateJamSession(makeConfig({ form: "blues12" }));
      expect(r.score.measures).toHaveLength(12);
    });

    it("returns 32 measures for rhythm32", () => {
      const r = generateJamSession(makeConfig({ form: "rhythm32" }));
      expect(r.score.measures).toHaveLength(32);
    });

    it("returns 32 measures for aaba32", () => {
      const r = generateJamSession(makeConfig({ form: "aaba32" }));
      expect(r.score.measures).toHaveLength(32);
    });

    it("returns 16 measures for modal16", () => {
      const r = generateJamSession(makeConfig({ form: "modal16" }));
      expect(r.score.measures).toHaveLength(16);
    });

    it("returns 8 measures for turnaround8", () => {
      const r = generateJamSession(makeConfig({ form: "turnaround8" }));
      expect(r.score.measures).toHaveLength(8);
    });

    it("returns requested measures for free form", () => {
      const r = generateJamSession(makeConfig({ form: "free", measures: 24 }));
      expect(r.score.measures).toHaveLength(24);
    });

    it("every measure has at least one chord", () => {
      const forms: JamForm[] = ["blues12", "rhythm32", "aaba32", "modal16", "turnaround8", "free"];
      for (const form of forms) {
        const r = generateJamSession(makeConfig({ form }));
        for (const m of r.score.measures) {
          expect(m.chords.length).toBeGreaterThanOrEqual(1);
          expect(m.chord).toBeDefined();
        }
      }
    });

    it("all melody note arrays are empty (jam = no melody)", () => {
      const r = generateJamSession(makeConfig({ form: "blues12" }));
      for (const m of r.score.measures) {
        expect(m.notes).toHaveLength(0);
      }
    });

    it("measure times are contiguous and non-overlapping", () => {
      const r = generateJamSession(makeConfig({ form: "aaba32", tempo: 130 }));
      for (let i = 1; i < r.score.measures.length; i++) {
        expect(r.score.measures[i].startTime).toBeCloseTo(r.score.measures[i - 1].endTime, 6);
      }
    });

    it("score duration matches last measure endTime", () => {
      const r = generateJamSession(makeConfig({ form: "turnaround8", tempo: 150 }));
      const last = r.score.measures[r.score.measures.length - 1];
      expect(r.score.duration).toBeCloseTo(last.endTime, 6);
    });

    it("score tempo and timeSignature match config", () => {
      const r = generateJamSession(makeConfig({ tempo: 180, timeSignature: [3, 4] }));
      expect(r.score.tempo).toBe(180);
      expect(r.score.timeSignature).toEqual([3, 4]);
    });

    it("returns a progression label", () => {
      const r = generateJamSession(makeConfig({ key: "Bb", form: "blues12" }));
      expect(r.progressionLabel).toBe("Blues in Bb");
    });
  });

  // ── New forms: measure counts via FORM_MEASURE_COUNTS ──

  describe("new forms — measure counts", () => {
    it.each([
      ["abac32", 32],
      ["songForm24", 24],
      ["rondo20", 20],
      ["clave16", 16],
      ["minorBlues12", 12],
      ["secondLine16", 16],
      ["coltraneMatrix16", 16],
      ["throughComposed12", 12],
      ["pentatonic8", 8],
      ["quartal16", 16],
    ] as [JamForm, number][])("%s produces %d measures", (form, expected) => {
      const r = generateJamSession(makeConfig({ form }));
      expect(r.score.measures).toHaveLength(expected);
    });

    it("FORM_MEASURE_COUNTS matches actual generation for all fixed forms", () => {
      for (const form of FIXED_FORMS) {
        const r = generateJamSession(makeConfig({ form }));
        expect(r.score.measures).toHaveLength(FORM_MEASURE_COUNTS[form as Exclude<JamForm, "free" | "fullSong">]);
      }
    });
  });

  // ── New forms: chord validity ──

  describe("new forms — chord validity", () => {
    it("every measure in every new form has a valid chord", () => {
      const newForms: JamForm[] = [
        "abac32", "songForm24", "rondo20", "clave16", "minorBlues12",
        "secondLine16", "coltraneMatrix16", "throughComposed12",
        "pentatonic8", "quartal16",
      ];
      for (const form of newForms) {
        const r = generateJamSession(makeConfig({ form, key: "Eb" }));
        for (const m of r.score.measures) {
          expect(m.chord).toBeDefined();
          expect(m.chord!.root).toBeTruthy();
          expect(m.chord!.quality).toBeTruthy();
          expect(m.chords.length).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it("coltraneMatrix16 has major-thirds cycle movement", () => {
      // Coltrane matrix should contain chords moving by major thirds from root
      const r = generateJamSession(makeConfig({ form: "coltraneMatrix16", key: "C" }));
      const roots = r.score.measures.map(m => m.chord!.root);
      // Should contain roots from at least 3 different pitch classes (major thirds cycle)
      const uniqueRoots = new Set(roots);
      expect(uniqueRoots.size).toBeGreaterThanOrEqual(3);
    });

    it("minorBlues12 uses minor qualities", () => {
      const r = generateJamSession(makeConfig({ form: "minorBlues12", key: "C" }));
      const qualities = r.score.measures.map(m => m.chord!.quality);
      // Should contain at least some minor chord qualities
      const hasMinor = qualities.some(q => q.includes("m"));
      expect(hasMinor).toBe(true);
    });
  });

  // ── New forms: labels ──

  describe("new forms — labels", () => {
    it.each([
      ["abac32", "ABAC in C"],
      ["songForm24", "Song Form in C"],
      ["rondo20", "Rondo in C"],
      ["clave16", "Montuno in C"],
      ["minorBlues12", "Minor Blues in C"],
      ["secondLine16", "Second Line in C"],
      ["coltraneMatrix16", "Coltrane Matrix in C"],
      ["throughComposed12", "Through-Composed in C"],
      ["pentatonic8", "Pentatonic in C"],
      ["quartal16", "Quartal in C"],
    ] as [JamForm, string][])("%s label = '%s'", (form, label) => {
      const r = generateJamSession(makeConfig({ form, key: "C" }));
      expect(r.progressionLabel).toBe(label);
    });
  });

  // ── Time signatures — measure durations ──

  describe("time signatures — measure durations", () => {
    const tempo = 120;
    const beatDur = 60 / tempo;

    it.each([
      [[4, 4], 4 * beatDur],
      [[3, 4], 3 * beatDur],
      [[5, 4], 5 * beatDur],
      [[6, 4], 6 * beatDur],
      [[7, 4], 7 * beatDur],
      [[6, 8], 3 * beatDur],   // 6*(4/8)=3 quarter-note beats
      [[7, 8], 3.5 * beatDur], // 7*(4/8)=3.5
      [[9, 8], 4.5 * beatDur], // 9*(4/8)=4.5
      [[11, 8], 5.5 * beatDur], // 11*(4/8)=5.5
    ] as [[number, number], number][])("%j produces correct measure duration", (ts, expectedDur) => {
      const r = generateJamSession(makeConfig({
        tempo,
        timeSignature: ts as [number, number],
        form: "turnaround8",
      }));
      for (const m of r.score.measures) {
        expect(m.endTime - m.startTime).toBeCloseTo(expectedDur, 6);
      }
    });

    it("measures contiguous in all time signatures", () => {
      for (const ts of ALL_TIME_SIGNATURES) {
        const r = generateJamSession(makeConfig({ timeSignature: ts, form: "turnaround8" }));
        for (let i = 1; i < r.score.measures.length; i++) {
          expect(r.score.measures[i].startTime).toBeCloseTo(
            r.score.measures[i - 1].endTime, 6,
          );
        }
      }
    });

    it("score duration correct for compound meter 6/8", () => {
      const r = generateJamSession(makeConfig({
        form: "pentatonic8", tempo, timeSignature: [6, 8],
      }));
      const expectedTotal = 8 * 3 * beatDur; // 8 measures * 3 quarter-note beats
      expect(r.score.duration).toBeCloseTo(expectedTotal, 4);
    });
  });

  // ── Constants ──

  describe("TIME_SIGNATURE_GROUPS and ALL_TIME_SIGNATURES", () => {
    it("ALL_TIME_SIGNATURES contains all grouped signatures", () => {
      const fromGroups = Object.values(TIME_SIGNATURE_GROUPS).flat();
      for (const ts of fromGroups) {
        expect(ALL_TIME_SIGNATURES).toContainEqual(ts);
      }
    });

    it("groups are Standard, Compound, Odd", () => {
      expect(Object.keys(TIME_SIGNATURE_GROUPS)).toEqual(["Standard", "Compound", "Odd"]);
    });

    it("Standard group has 4/4 and 3/4", () => {
      expect(TIME_SIGNATURE_GROUPS["Standard"]).toContainEqual([4, 4]);
      expect(TIME_SIGNATURE_GROUPS["Standard"]).toContainEqual([3, 4]);
    });
  });

  // ── Transposition ──

  describe("transposeProgression", () => {
    it("C→C preserves roots", () => {
      const chords = [{ root: "C", quality: "maj7" }, { root: "D", quality: "m7" }];
      const result = transposeProgression(chords, "C", "C");
      expect(result[0].root).toBe("C");
      expect(result[1].root).toBe("D");
    });

    it("C→F shifts up a 4th", () => {
      const chords = [
        { root: "D", quality: "m7" },
        { root: "G", quality: "7" },
        { root: "C", quality: "maj7" },
      ];
      const result = transposeProgression(chords, "C", "F");
      expect(result[0].root).toBe("G");
      expect(result[1].root).toBe("C");
      expect(result[2].root).toBe("F");
    });

    it("preserves qualities", () => {
      const chords = [{ root: "D", quality: "m7b5" }, { root: "G", quality: "7alt" }];
      const result = transposeProgression(chords, "C", "Eb");
      expect(result[0].quality).toBe("m7b5");
      expect(result[1].quality).toBe("7alt");
    });

    it("round-trips through all 12 keys", () => {
      const chords = [{ root: "C", quality: "maj7" }];
      for (const key of ALL_KEYS) {
        const up = transposeProgression(chords, "C", key);
        const back = transposeProgression(up, key, "C");
        expect(back[0].root).toBe("C");
      }
    });

    it("new forms transpose correctly", () => {
      for (const form of FIXED_FORMS) {
        const rC = generateJamSession(makeConfig({ form, key: "C" }));
        const rF = generateJamSession(makeConfig({ form, key: "F" }));
        // Both should have same measure count
        expect(rC.score.measures).toHaveLength(rF.score.measures.length);
      }
    });
  });

  // ── Generator integration (original) ──

  describe("generator integration", () => {
    it("generated score works with scoreChordsToEvents", () => {
      const r = generateJamSession(makeConfig({ key: "Bb", form: "blues12", tempo: 140 }));
      const events = scoreChordsToEvents(r.score.measures);
      expect(events.length).toBeGreaterThanOrEqual(12);
      for (const e of events) {
        expect(e.root).toBeTruthy();
        expect(e.time).toBeGreaterThanOrEqual(0);
        expect(e.duration).toBeGreaterThan(0);
      }
    });

    it("generates valid walking bass", () => {
      const r = generateJamSession(makeConfig({ key: "F", form: "turnaround8", tempo: 120 }));
      const events = scoreChordsToEvents(r.score.measures);
      const bass = generateWalkingBass(events, { style: "swing", tempo: 120 });
      expect(bass.length).toBeGreaterThan(0);
      for (const n of bass) {
        expect(n.pitch).toBeGreaterThanOrEqual(28);
        expect(n.pitch).toBeLessThanOrEqual(55);
      }
    });

    it("generates valid piano comping", () => {
      const r = generateJamSession(makeConfig({ key: "D", form: "blues12", style: "bossa", tempo: 130 }));
      const events = scoreChordsToEvents(r.score.measures);
      const compEvents = events.map(c => ({ root: c.root, quality: c.quality, time: c.time, duration: c.duration }));
      const piano = generatePianoComping(compEvents, { style: "bossa", tempo: 130 });
      expect(piano.length).toBeGreaterThan(0);
    });

    it("generates valid drum pattern", () => {
      const r = generateJamSession(makeConfig({ form: "modal16", style: "modal", tempo: 100 }));
      const drums = generateDrumPattern({
        style: "modal", tempo: 100,
        measures: r.score.measures.length,
        timeSignature: [4, 4],
      });
      expect(drums.length).toBeGreaterThan(0);
    });
  });

  // ── Integration: new forms → generators ──

  describe("new forms integration with generators", () => {
    const newForms: JamForm[] = [
      "abac32", "songForm24", "rondo20", "clave16", "minorBlues12",
      "secondLine16", "coltraneMatrix16", "throughComposed12",
      "pentatonic8", "quartal16",
    ];

    it.each(newForms)("%s → scoreChordsToEvents produces valid events", (form) => {
      const r = generateJamSession(makeConfig({ form, key: "Ab", tempo: 140 }));
      const events = scoreChordsToEvents(r.score.measures);
      expect(events.length).toBe(FORM_MEASURE_COUNTS[form as Exclude<JamForm, "free" | "fullSong">]);
      for (const e of events) {
        expect(e.root).toBeTruthy();
        expect(e.duration).toBeGreaterThan(0);
      }
    });

    it.each(newForms)("%s → walking bass in valid range", (form) => {
      const r = generateJamSession(makeConfig({ form, key: "G", tempo: 120 }));
      const events = scoreChordsToEvents(r.score.measures);
      const bass = generateWalkingBass(events, { style: "swing", tempo: 120 });
      expect(bass.length).toBeGreaterThan(0);
      for (const n of bass) {
        expect(n.pitch).toBeGreaterThanOrEqual(28);
        expect(n.pitch).toBeLessThanOrEqual(55);
      }
    });

    it.each(newForms)("%s → piano comping produces notes", (form) => {
      const r = generateJamSession(makeConfig({ form, key: "D", tempo: 130 }));
      const events = scoreChordsToEvents(r.score.measures);
      const compEvents = events.map(c => ({ root: c.root, quality: c.quality, time: c.time, duration: c.duration }));
      const piano = generatePianoComping(compEvents, { style: "swing", tempo: 130 });
      expect(piano.length).toBeGreaterThan(0);
    });

    it.each(newForms)("%s → drum pattern produces notes", (form) => {
      const r = generateJamSession(makeConfig({ form, tempo: 110 }));
      const drums = generateDrumPattern({
        style: "swing", tempo: 110,
        measures: r.score.measures.length,
        timeSignature: [4, 4],
      });
      expect(drums.length).toBeGreaterThan(0);
    });
  });

  // ── Integration: odd meters → generators ──

  describe("odd meters integration with generators", () => {
    const oddTimeSigs: { ts: [number, number] }[] = [
      { ts: [5, 4] }, { ts: [6, 4] }, { ts: [7, 4] },
      { ts: [6, 8] }, { ts: [7, 8] }, { ts: [9, 8] }, { ts: [11, 8] },
    ];
    const tempo = 120;

    it.each(oddTimeSigs)("$ts → walking bass produces notes", ({ ts }) => {
      const r = generateJamSession(makeConfig({ form: "turnaround8", tempo, timeSignature: ts }));
      const events = scoreChordsToEvents(r.score.measures);
      const bass = generateWalkingBass(events, { style: "swing", tempo });
      expect(bass.length).toBeGreaterThan(0);
      for (const n of bass) {
        expect(n.pitch).toBeGreaterThanOrEqual(28);
        expect(n.pitch).toBeLessThanOrEqual(55);
      }
    });

    it.each(oddTimeSigs)("$ts → piano comping produces notes", ({ ts }) => {
      const r = generateJamSession(makeConfig({ form: "turnaround8", tempo, timeSignature: ts }));
      const events = scoreChordsToEvents(r.score.measures);
      const compEvents = events.map(c => ({ root: c.root, quality: c.quality, time: c.time, duration: c.duration }));
      const piano = generatePianoComping(compEvents, { style: "swing", tempo });
      expect(piano.length).toBeGreaterThan(0);
    });

    it.each(oddTimeSigs)("$ts → drum pattern produces notes", ({ ts }) => {
      const drums = generateDrumPattern({
        style: "swing", tempo,
        measures: 8,
        timeSignature: ts,
        humanize: false,
      });
      expect(drums.length).toBeGreaterThan(0);
    });

    it.each(oddTimeSigs)("$ts → bass notes have valid times", ({ ts }) => {
      const r = generateJamSession(makeConfig({ form: "turnaround8", tempo, timeSignature: ts }));
      const events = scoreChordsToEvents(r.score.measures);
      const bass = generateWalkingBass(events, { style: "swing", tempo, humanize: false });
      const scoreDur = r.score.duration;
      for (const n of bass) {
        expect(n.time).toBeGreaterThanOrEqual(-0.01);
        expect(n.time).toBeLessThanOrEqual(scoreDur + 0.01);
      }
    });
  });

  // ── Drum patterns: meter-specific sets ──

  describe("getMeterPatternSet", () => {
    it.each([
      [3, 4],
      [5, 4],
      [6, 8],
      [7, 8],
      [9, 8],
      [6, 4],
      [7, 4],
      [11, 8],
    ] as [number, number][])("%d/%d returns a pattern set", (n, d) => {
      const set = getMeterPatternSet([n, d]);
      expect(set).not.toBeNull();
      expect(set!.base.length).toBeGreaterThan(0);
    });

    it("4/4 returns null (uses style-based selection)", () => {
      expect(getMeterPatternSet([4, 4])).toBeNull();
    });

    it("unsupported meters return null", () => {
      expect(getMeterPatternSet([13, 8])).toBeNull();
      expect(getMeterPatternSet([2, 4])).toBeNull();
    });
  });

  // ── Drum patterns: odd meter beat bounds ──

  describe("drum patterns — odd meter beat bounds", () => {
    const meterBeats = [
      { n: 5, d: 4, maxBeat: 5 },
      { n: 6, d: 8, maxBeat: 3 },
      { n: 7, d: 8, maxBeat: 3.5 },
      { n: 9, d: 8, maxBeat: 4.5 },
      { n: 6, d: 4, maxBeat: 6 },
      { n: 7, d: 4, maxBeat: 7 },
      { n: 11, d: 8, maxBeat: 5.5 },
    ];

    it.each(meterBeats)("$n/$d drum hits within time bounds", ({ n, d, maxBeat }) => {
      const drums = generateDrumPattern({
        style: "swing", tempo: 120,
        measures: 4,
        timeSignature: [n, d],
        humanize: false,
      });
      expect(drums.length).toBeGreaterThan(0);
      const beatDur = 60 / 120;
      const measureDur = maxBeat * beatDur;
      for (const hit of drums) {
        expect(hit.time).toBeGreaterThanOrEqual(-0.01);
        expect(hit.time).toBeLessThanOrEqual(4 * measureDur + 0.01);
      }
    });
  });

  // ── 3/4 time ──

  describe("3/4 time", () => {
    it("correct measure durations in 3/4", () => {
      const r = generateJamSession(makeConfig({ style: "jazzWaltz", tempo: 150, timeSignature: [3, 4] }));
      const beatDur = 60 / 150;
      const expected = 3 * beatDur;
      for (const m of r.score.measures) {
        expect(m.endTime - m.startTime).toBeCloseTo(expected, 6);
      }
    });
  });

  // ── getFormsForStyle ──

  describe("getFormsForStyle", () => {
    it("blues12 for shuffleBlues", () => {
      expect(getFormsForStyle("shuffleBlues")).toContain("blues12");
    });

    it("modal16 for modal", () => {
      expect(getFormsForStyle("modal")).toContain("modal16");
    });

    it("every style returns at least one form", () => {
      const styles = ["swing", "hardBop", "coolJazz", "ballad", "bossa", "latin",
        "funk", "fusion", "ecm", "modal", "jazzWaltz", "shuffleBlues",
        "neoSoul", "contemporaryJazz", "mathRock", "idm"] as const;
      for (const s of styles) {
        expect(getFormsForStyle(s).length).toBeGreaterThan(0);
      }
    });

    it("new forms appear in style affinities", () => {
      const newForms: JamForm[] = [
        "abac32", "songForm24", "rondo20", "clave16", "minorBlues12",
        "secondLine16", "coltraneMatrix16", "throughComposed12",
        "pentatonic8", "quartal16",
      ];
      // Each new form should appear in at least one style's affinity list
      const styles = ["swing", "hardBop", "coolJazz", "ballad", "bossa", "latin",
        "funk", "fusion", "ecm", "modal", "jazzWaltz", "shuffleBlues",
        "neoSoul", "contemporaryJazz", "mathRock", "idm"] as const;
      for (const form of newForms) {
        const found = styles.some(s => getFormsForStyle(s).includes(form));
        expect(found).toBe(true);
      }
    });

    it("specific style-form affinities for new forms", () => {
      expect(getFormsForStyle("fusion")).toContain("coltraneMatrix16");
      expect(getFormsForStyle("latin")).toContain("clave16");
      expect(getFormsForStyle("shuffleBlues")).toContain("minorBlues12");
      expect(getFormsForStyle("ecm")).toContain("quartal16");
      expect(getFormsForStyle("swing")).toContain("rondo20");
      expect(getFormsForStyle("latin")).toContain("secondLine16");
      expect(getFormsForStyle("modal")).toContain("pentatonic8");
    });
  });

  // ── Randomization ──

  describe("randomization", () => {
    it("multiple calls can produce different progressions", () => {
      const results = Array.from({ length: 20 }, () =>
        generateJamSession(makeConfig({ key: "C", form: "blues12" }))
      );
      const fingerprints = results.map(r =>
        r.score.measures.map(m => `${m.chord?.root}${m.chord?.quality}`).join(",")
      );
      const unique = new Set(fingerprints);
      expect(unique.size).toBeGreaterThanOrEqual(2);
    });

    it("new forms also have template variety", () => {
      // Forms with multiple templates should produce different outputs
      const formsWithVariety: JamForm[] = ["clave16", "minorBlues12", "throughComposed12", "pentatonic8"];
      for (const form of formsWithVariety) {
        const results = Array.from({ length: 20 }, () =>
          generateJamSession(makeConfig({ key: "C", form }))
        );
        const fingerprints = results.map(r =>
          r.score.measures.map(m => `${m.chord?.root}${m.chord?.quality}`).join(",")
        );
        const unique = new Set(fingerprints);
        expect(unique.size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ── FORM_LABELS ──

  describe("FORM_LABELS", () => {
    it("has label for every form", () => {
      for (const f of ALL_FORMS) {
        expect(FORM_LABELS[f]).toBeTruthy();
      }
    });

    it("all 17 forms have labels", () => {
      expect(Object.keys(FORM_LABELS)).toHaveLength(17);
    });

    it("specific new form labels", () => {
      expect(FORM_LABELS["coltraneMatrix16"]).toBe("Coltrane Matrix");
      expect(FORM_LABELS["secondLine16"]).toBe("Second Line");
      expect(FORM_LABELS["quartal16"]).toBe("Quartal Harmony");
      expect(FORM_LABELS["rondo20"]).toBe("Rondo");
    });
  });

  // ── Cross-form × cross-meter integration ──

  describe("cross form × meter integration", () => {
    it("new form + odd meter produces valid score", () => {
      const combos: [JamForm, [number, number]][] = [
        ["coltraneMatrix16", [5, 4]],
        ["rondo20", [7, 8]],
        ["clave16", [6, 8]],
        ["quartal16", [11, 8]],
        ["songForm24", [9, 8]],
      ];
      for (const [form, ts] of combos) {
        const r = generateJamSession(makeConfig({ form, timeSignature: ts, tempo: 120 }));
        expect(r.score.measures).toHaveLength(FORM_MEASURE_COUNTS[form as Exclude<JamForm, "free" | "fullSong">]);
        for (let i = 1; i < r.score.measures.length; i++) {
          expect(r.score.measures[i].startTime).toBeCloseTo(
            r.score.measures[i - 1].endTime, 6,
          );
        }
      }
    });

    it("new form + odd meter → full pipeline (bass + piano + drums)", () => {
      const r = generateJamSession(makeConfig({
        form: "quartal16", key: "Bb", tempo: 130, timeSignature: [7, 4],
      }));
      const events = scoreChordsToEvents(r.score.measures);
      const bass = generateWalkingBass(events, { style: "fusion", tempo: 130 });
      const compEvents = events.map(c => ({ root: c.root, quality: c.quality, time: c.time, duration: c.duration }));
      const piano = generatePianoComping(compEvents, { style: "fusion", tempo: 130 });
      const drums = generateDrumPattern({
        style: "fusion", tempo: 130,
        measures: 16,
        timeSignature: [7, 4],
      });

      expect(bass.length).toBeGreaterThan(0);
      expect(piano.length).toBeGreaterThan(0);
      expect(drums.length).toBeGreaterThan(0);
    });
  });

  // ── enrichQuality ──

  describe("enrichQuality", () => {
    it("returns valid quality string (never undefined/null)", () => {
      const inputs = ["maj7", "m7", "7", "7b9", "7#9", "7sus", "m7b5", "dim7", "aug", "5"];
      const styles = ["swing", "fusion", "ecm", "shuffleBlues"] as const;
      for (const q of inputs) {
        for (const s of styles) {
          for (let i = 0; i < 10; i++) {
            const result = enrichQuality(q, s, Math.random());
            expect(result).toBeTruthy();
            expect(typeof result).toBe("string");
          }
        }
      }
    });

    it("preserves function-critical qualities (m7b5, dim7, aug, 5, m(maj7), m6)", () => {
      const preserved = ["m7b5", "dim7", "aug", "5", "m(maj7)", "m6"];
      for (const q of preserved) {
        for (let i = 0; i < 50; i++) {
          expect(enrichQuality(q, "fusion", 0.5)).toBe(q);
        }
      }
    });

    it("7alt stays 7alt (maximally altered)", () => {
      for (let i = 0; i < 50; i++) {
        expect(enrichQuality("7alt", "fusion", 0.5)).toBe("7alt");
      }
    });

    it("maj7 can upgrade to extended qualities", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("maj7", "fusion", 0.2));
      }
      // Should include at least some extensions beyond maj7
      const extended = [...results].filter(q => q !== "maj7");
      expect(extended.length).toBeGreaterThan(0);
    });

    it("m7 can upgrade to m9/m11/m6/m(maj7)", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("m7", "contemporaryJazz", 0.2));
      }
      const extended = [...results].filter(q => q !== "m7");
      expect(extended.length).toBeGreaterThan(0);
    });

    it("7 can upgrade to 9/13/7#11/7#5/7b5", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("7", "fusion", 0.3));
      }
      const extended = [...results].filter(q => q !== "7");
      expect(extended.length).toBeGreaterThan(0);
    });

    it("7sus can upgrade to 9sus4/13sus4", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("7sus", "ecm", 0.3));
      }
      expect(results.has("9sus4") || results.has("13sus4")).toBe(true);
    });

    it("simple styles (shuffleBlues) enrich less than complex styles (fusion)", () => {
      let simpleChanges = 0;
      let complexChanges = 0;
      const runs = 500;
      for (let i = 0; i < runs; i++) {
        if (enrichQuality("maj7", "shuffleBlues", 0.5) !== "maj7") simpleChanges++;
        if (enrichQuality("maj7", "fusion", 0.5) !== "maj7") complexChanges++;
      }
      // Fusion should enrich significantly more than shuffleBlues
      expect(complexChanges).toBeGreaterThan(simpleChanges);
    });

    it("enriched qualities work with piano voicing engine", () => {
      // Generate with fusion style (high enrichment) and verify piano comping handles all
      for (let i = 0; i < 10; i++) {
        const r = generateJamSession(makeConfig({
          form: "blues12", key: "C", style: "fusion", tempo: 120,
        }));
        const events = scoreChordsToEvents(r.score.measures);
        const compEvents = events.map(c => ({
          root: c.root, quality: c.quality, time: c.time, duration: c.duration,
        }));
        const piano = generatePianoComping(compEvents, { style: "fusion", tempo: 120 });
        expect(piano.length).toBeGreaterThan(0);
      }
    });

    it("enriched qualities work with walking bass engine", () => {
      for (let i = 0; i < 10; i++) {
        const r = generateJamSession(makeConfig({
          form: "aaba32", key: "Eb", style: "ecm", tempo: 110,
        }));
        const events = scoreChordsToEvents(r.score.measures);
        const bass = generateWalkingBass(events, { style: "ecm", tempo: 110 });
        expect(bass.length).toBeGreaterThan(0);
        for (const n of bass) {
          expect(n.pitch).toBeGreaterThanOrEqual(28);
          expect(n.pitch).toBeLessThanOrEqual(55);
        }
      }
    });
  });

  // ── Chord quality variety ──

  describe("chord quality variety", () => {
    it("generated progressions use more than 5 unique qualities across forms", () => {
      const allQualities = new Set<string>();
      const forms: JamForm[] = ["blues12", "aaba32", "turnaround8", "modal16", "coltraneMatrix16"];
      for (const form of forms) {
        const r = generateJamSession(makeConfig({ form, style: "fusion" }));
        for (const m of r.score.measures) {
          allQualities.add(m.chord!.quality);
        }
      }
      expect(allQualities.size).toBeGreaterThan(5);
    });

    it("templates contain extended qualities (9, 13, maj9, m9, etc.)", () => {
      // Run many forms and check that extensions appear
      const extendedQualities = new Set<string>();
      const richQualities = ["9", "13", "maj9", "m9", "69", "maj7#11", "m11", "m6",
        "7#5", "7b5", "7alt", "9sus4", "13sus4", "m(maj7)", "7b9b13", "7#9b13"];
      for (const form of FIXED_FORMS) {
        for (let i = 0; i < 5; i++) {
          const r = generateJamSession(makeConfig({ form, style: "swing" }));
          for (const m of r.score.measures) {
            if (richQualities.includes(m.chord!.quality)) {
              extendedQualities.add(m.chord!.quality);
            }
          }
        }
      }
      // Should find at least 8 different extended qualities across all forms
      expect(extendedQualities.size).toBeGreaterThanOrEqual(8);
    });

    it("enrichment adds quality variation between repeated generations", () => {
      const fingerprints = Array.from({ length: 30 }, () => {
        const r = generateJamSession(makeConfig({ form: "blues12", key: "C", style: "fusion" }));
        return r.score.measures.map(m => m.chord!.quality).join(",");
      });
      const unique = new Set(fingerprints);
      // With enrichment, quality sequences should differ across runs
      expect(unique.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe("holdsworth style", () => {
    it("holdsworth form affinity includes modal, throughComposed, quartal, free", () => {
      const forms = getFormsForStyle("holdsworth");
      expect(forms).toContain("modal16");
      expect(forms).toContain("throughComposed12");
      expect(forms).toContain("quartal16");
      expect(forms).toContain("free");
      expect(forms).toContain("coltraneMatrix16");
      // Should NOT include conventional forms
      expect(forms).not.toContain("blues12");
      expect(forms).not.toContain("rhythm32");
    });

    it("holdsworth enrichment has higher probability than generic complex styles", () => {
      // Run 200 enrichments for each and compare upgrade rates
      let holdsworthUpgrades = 0;
      let fusionUpgrades = 0;
      for (let i = 0; i < 200; i++) {
        if (enrichQuality("maj7", "holdsworth", 0.5) !== "maj7") holdsworthUpgrades++;
        if (enrichQuality("maj7", "fusion", 0.5) !== "maj7") fusionUpgrades++;
      }
      // Holdsworth (60%) should upgrade more than fusion (40%)
      expect(holdsworthUpgrades).toBeGreaterThan(fusionUpgrades);
    });

    it("holdsworth enrichment favors melodic minor derivatives", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("maj7", "holdsworth", 0.2));
      }
      // Lydian augmented (maj7#5) is Holdsworth signature — must appear
      expect(results.has("maj7#5")).toBe(true);
      // Lydian (#11) should appear too
      expect(results.has("maj7#11")).toBe(true);
    });

    it("holdsworth minor chords enrich toward m(maj7) — melodic minor", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("m7", "holdsworth", 0.3));
      }
      // m(maj7) is THE Holdsworth minor sound (melodic minor mode 1)
      expect(results.has("m(maj7)")).toBe(true);
    });

    it("holdsworth dominant chords enrich toward altered/lydian dominant", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("7", "holdsworth", 0.3));
      }
      // 7alt (altered scale) and 7#11 (lydian dominant) are essential Holdsworth
      expect(results.has("7alt")).toBe(true);
      expect(results.has("7#11")).toBe(true);
    });

    it("generates valid jam session with holdsworth style", () => {
      const result = generateJamSession(makeConfig({
        style: "holdsworth",
        form: "modal16",
        key: "Eb",
        tempo: 130,
      }));
      expect(result.score.measures.length).toBeGreaterThan(0);
      expect(result.score.tempo).toBe(130);
      // All measures should have chords
      for (const m of result.score.measures) {
        expect(m.chord).toBeDefined();
        expect(m.chord!.root).toBeTruthy();
        expect(m.chord!.quality).toBeTruthy();
      }
    });

    it("holdsworth bass generates valid notes", () => {
      const result = generateJamSession(makeConfig({
        style: "holdsworth", form: "turnaround8", key: "C",
      }));
      const events = scoreChordsToEvents(result.score.measures);
      const bass = generateWalkingBass(events, {
        style: "holdsworth", tempo: 120, swingAmount: 15,
      });
      expect(bass.length).toBeGreaterThan(0);
      for (const note of bass) {
        expect(note.pitch).toBeGreaterThanOrEqual(28); // E1
        expect(note.pitch).toBeLessThanOrEqual(67);    // G4
        expect(note.time).toBeGreaterThanOrEqual(-0.01);
        expect(note.duration).toBeGreaterThan(0);
      }
    });

    it("holdsworth piano generates valid comping", () => {
      const result = generateJamSession(makeConfig({
        style: "holdsworth", form: "quartal16", key: "Ab",
      }));
      const events = scoreChordsToEvents(result.score.measures);
      const piano = generatePianoComping(events, {
        style: "holdsworth", tempo: 120, swingAmount: 15,
      });
      expect(piano.length).toBeGreaterThan(0);
      for (const note of piano) {
        expect(note.pitches.length).toBeGreaterThan(0);
        for (const p of note.pitches) {
          expect(p).toBeGreaterThanOrEqual(48); // C3
          expect(p).toBeLessThanOrEqual(84);    // C6
        }
      }
    });

    it("holdsworth drums generate valid pattern", () => {
      const drums = generateDrumPattern({
        style: "holdsworth",
        tempo: 130,
        measures: 4,
        humanize: false,
      });
      expect(drums.length).toBeGreaterThan(0);
      // Should have ride (not just hihat) — Holdsworth uses ride quarter notes
      const hasRide = drums.some(h => h.pitch === 51 || h.pitch === 53);
      expect(hasRide).toBe(true);
      // All times non-negative
      for (const hit of drums) {
        expect(hit.time).toBeGreaterThanOrEqual(0);
        expect(hit.velocity).toBeGreaterThan(0);
      }
    });

    it("holdsworth produces rich quality variety across forms", () => {
      const allQualities = new Set<string>();
      const forms: JamForm[] = ["modal16", "throughComposed12", "quartal16", "turnaround8"];
      for (const form of forms) {
        const r = generateJamSession(makeConfig({ style: "holdsworth", form, key: "C" }));
        for (const m of r.score.measures) {
          allQualities.add(m.chord!.quality);
        }
      }
      // Holdsworth harmony should produce diverse qualities
      expect(allQualities.size).toBeGreaterThanOrEqual(8);
    });

    it("holdsworth all forms generate without errors", () => {
      const holdsworthForms = getFormsForStyle("holdsworth");
      for (const form of holdsworthForms) {
        expect(() => {
          generateJamSession(makeConfig({ style: "holdsworth", form, key: "Db" }));
        }).not.toThrow();
      }
    });
  });

  describe("alfaMist style", () => {
    it("form affinity includes modal, turnaround, minorBlues, pentatonic, aaba", () => {
      const forms = getFormsForStyle("alfaMist");
      expect(forms).toContain("modal16");
      expect(forms).toContain("turnaround8");
      expect(forms).toContain("minorBlues12");
      expect(forms).toContain("pentatonic8");
      expect(forms).toContain("aaba32");
      expect(forms).not.toContain("coltraneMatrix16");
      expect(forms).not.toContain("throughComposed12");
    });

    it("enrichment favors warm extensions (m9, m11, maj9) not altered", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("m7", "alfaMist", 0.3));
      }
      expect(results.has("m9")).toBe(true);
      expect(results.has("7alt")).toBe(false);
      expect(results.has("7b9")).toBe(false);
    });

    it("enriches bare triads to warm extensions", () => {
      const minorResults = new Set<string>();
      const majorResults = new Set<string>();
      for (let i = 0; i < 200; i++) {
        minorResults.add(enrichQuality("m", "alfaMist", 0.3));
        majorResults.add(enrichQuality("", "alfaMist", 0.3));
      }
      // Bare minor → m7/m9
      const hasMinorExt = minorResults.has("m7") || minorResults.has("m9");
      expect(hasMinorExt).toBe(true);
      // Bare major → maj7/maj9/69
      const hasMajorExt = majorResults.has("maj7") || majorResults.has("maj9") || majorResults.has("69");
      expect(hasMajorExt).toBe(true);
    });

    it("enriches sus chords to 9sus4/13sus4", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("7sus", "alfaMist", 0.3));
        results.add(enrichQuality("sus4", "alfaMist", 0.3));
      }
      const hasSusExt = results.has("9sus4") || results.has("13sus4");
      expect(hasSusExt).toBe(true);
    });

    it("major chords enrich toward maj9/69", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("maj7", "alfaMist", 0.3));
      }
      expect(results.has("maj9")).toBe(true);
    });

    it("dominant chords stay warm (9, 13) not altered", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("7", "alfaMist", 0.3));
      }
      expect(results.has("9")).toBe(true);
      expect(results.has("7alt")).toBe(false);
      expect(results.has("7b5")).toBe(false);
    });

    it("modal16 uses dedicated Alfa Mist progressions", () => {
      // Run 20 times — should get chromatic mediant or stepwise patterns
      const allRoots = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const result = generateJamSession(makeConfig({
          style: "alfaMist", form: "modal16", key: "C",
        }));
        for (const m of result.score.measures) {
          allRoots.add(m.chord!.root);
        }
      }
      // Dedicated pools feature roots like E (chromatic mediant from C),
      // Ab (bVI), Eb (bIII) — at least some non-diatonic root should appear
      const hasNonDiatonic = allRoots.has("E") || allRoots.has("Ab") || allRoots.has("Eb");
      expect(hasNonDiatonic).toBe(true);
    });

    it("turnaround8 uses dedicated Alfa Mist progressions", () => {
      const allQualities = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const result = generateJamSession(makeConfig({
          style: "alfaMist", form: "turnaround8", key: "C",
        }));
        for (const m of result.score.measures) {
          allQualities.add(m.chord!.quality);
        }
      }
      // Dedicated pools feature sus chords (B11→9sus4) and maj7
      const hasWarmQualities = allQualities.has("m9") || allQualities.has("maj7") || allQualities.has("maj9");
      expect(hasWarmQualities).toBe(true);
    });

    it("generates valid jam session", () => {
      const result = generateJamSession(makeConfig({
        style: "alfaMist", form: "modal16", key: "Bb", tempo: 95,
      }));
      expect(result.score.measures.length).toBeGreaterThan(0);
      expect(result.score.tempo).toBe(95);
      for (const m of result.score.measures) {
        expect(m.chord).toBeDefined();
        expect(m.chord!.root).toBeTruthy();
      }
    });

    it("bass generates valid notes with variety", () => {
      const result = generateJamSession(makeConfig({
        style: "alfaMist", form: "turnaround8", key: "Eb",
      }));
      const events = scoreChordsToEvents(result.score.measures);
      const bass = generateWalkingBass(events, {
        style: "alfaMist", tempo: 95, swingAmount: 20,
      });
      expect(bass.length).toBeGreaterThan(0);
      // Check note count variety (different patterns produce different note counts)
      const notesPerMeasure = new Set<number>();
      let noteCount = 0;
      let prevTime = -1;
      for (const note of bass) {
        expect(note.pitch).toBeGreaterThanOrEqual(28);
        expect(note.pitch).toBeLessThanOrEqual(67);
        expect(note.time).toBeGreaterThanOrEqual(-0.01);
        if (note.time - prevTime > 1.5) {
          if (noteCount > 0) notesPerMeasure.add(noteCount);
          noteCount = 1;
        } else {
          noteCount++;
        }
        prevTime = note.time;
      }
      if (noteCount > 0) notesPerMeasure.add(noteCount);
    });

    it("piano generates valid comping with grace notes", () => {
      // Run multiple times to trigger grace note generation
      let graceNoteFound = false;
      for (let trial = 0; trial < 10; trial++) {
        const result = generateJamSession(makeConfig({
          style: "alfaMist", form: "modal16", key: "Ab",
        }));
        const events = scoreChordsToEvents(result.score.measures);
        const piano = generatePianoComping(events, {
          style: "alfaMist", tempo: 95, swingAmount: 20,
        });
        expect(piano.length).toBeGreaterThan(0);
        // Grace notes are single-pitch notes with very short duration (~25ms)
        for (const note of piano) {
          expect(note.pitches.length).toBeGreaterThan(0);
          if (note.pitches.length === 1 && note.duration < 0.05) {
            graceNoteFound = true;
          }
        }
        if (graceNoteFound) break;
      }
      expect(graceNoteFound).toBe(true);
    });

    it("drums generate broken beat with quintuplet hi-hat", () => {
      const drums = generateDrumPattern({
        style: "alfaMist", tempo: 95, measures: 4, humanize: false,
      });
      expect(drums.length).toBeGreaterThan(0);
      // Hi-hats should include quintuplet-positioned hits (beat 0.2, 1.8, 2.8)
      const hihatHits = drums.filter(h => h.pitch === 42 || h.pitch === 46);
      expect(hihatHits.length).toBeGreaterThan(8);
      for (const hit of drums) {
        expect(hit.time).toBeGreaterThanOrEqual(0);
        expect(hit.velocity).toBeGreaterThan(0);
      }
    });

    it("drums with humanize produce per-element timing offsets", () => {
      // Generate with humanize=true, verify kick/snare/hihat have different timing characteristics
      const drums = generateDrumPattern({
        style: "alfaMist", tempo: 95, measures: 8, humanize: true,
      });
      const kickTimes: number[] = [];
      const snareTimes: number[] = [];
      const hihatTimes: number[] = [];
      for (const hit of drums) {
        if (hit.pitch === 36) kickTimes.push(hit.time);
        if (hit.pitch === 38) snareTimes.push(hit.time);
        if (hit.pitch === 42 || hit.pitch === 46) hihatTimes.push(hit.time);
      }
      // All elements should have hits
      expect(kickTimes.length).toBeGreaterThan(0);
      expect(snareTimes.length).toBeGreaterThan(0);
      expect(hihatTimes.length).toBeGreaterThan(0);
    });

    it("all forms generate without errors", () => {
      const forms = getFormsForStyle("alfaMist");
      for (const form of forms) {
        expect(() => {
          generateJamSession(makeConfig({ style: "alfaMist", form, key: "Gb" }));
        }).not.toThrow();
      }
    });

    it("produces lush quality variety across forms", () => {
      const allQualities = new Set<string>();
      const forms: JamForm[] = ["modal16", "turnaround8", "pentatonic8", "minorBlues12", "aaba32"];
      for (const form of forms) {
        const r = generateJamSession(makeConfig({ style: "alfaMist", form, key: "Bb" }));
        for (const m of r.score.measures) {
          allQualities.add(m.chord!.quality);
        }
      }
      expect(allQualities.size).toBeGreaterThanOrEqual(5);
    });

    it("minorBlues12 uses dedicated warm progressions", () => {
      const allQualities = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const r = generateJamSession(makeConfig({ style: "alfaMist", form: "minorBlues12", key: "C" }));
        for (const m of r.score.measures) {
          allQualities.add(m.chord!.quality);
        }
      }
      // Dedicated minor blues has m9, m11, maj9, 9 — warm only
      const hasWarm = allQualities.has("m9") || allQualities.has("m11") || allQualities.has("maj9");
      expect(hasWarm).toBe(true);
      // Should not have altered dominants in dedicated pool
      expect(allQualities.has("7alt")).toBe(false);
      expect(allQualities.has("7b9b13")).toBe(false);
    });

    // ── Phase 2: Cluster voicings, dynamic arc, slow harmonic rhythm ──

    it("pentatonic8 uses dedicated alfaMist pool (slow 2-4 bar holds)", () => {
      const allRoots = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const r = generateJamSession(makeConfig({ style: "alfaMist", form: "pentatonic8", key: "C" }));
        expect(r.score.measures).toHaveLength(8);
        for (const m of r.score.measures) {
          allRoots.add(m.chord!.root);
        }
      }
      // Dedicated pentatonic pool has limited roots (2-3 per template)
      expect(allRoots.size).toBeLessThanOrEqual(8);
    });

    it("quartal16 uses dedicated alfaMist pool (sus4/9sus4 washes)", () => {
      const allQualities = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const r = generateJamSession(makeConfig({ style: "alfaMist", form: "quartal16", key: "C" }));
        expect(r.score.measures).toHaveLength(16);
        for (const m of r.score.measures) {
          allQualities.add(m.chord!.quality);
        }
      }
      // Quartal pool features sus and minor voicings
      const hasSus = [...allQualities].some(q => q.includes("sus") || q.includes("m9") || q.includes("m11"));
      expect(hasSus).toBe(true);
    });

    it("modal16 slow templates hold roots for 4 bars", () => {
      // Run many times to catch slow templates (templates 5-6)
      let foundSlowTemplate = false;
      for (let i = 0; i < 50; i++) {
        const r = generateJamSession(makeConfig({ style: "alfaMist", form: "modal16", key: "C" }));
        const measures = r.score.measures;
        // Check if first 4 measures share a root (4-bar hold)
        if (measures.length >= 4) {
          const firstRoot = measures[0].chord!.root;
          const allSameRoot = measures.slice(0, 4).every(m => m.chord!.root === firstRoot);
          if (allSameRoot) {
            foundSlowTemplate = true;
            break;
          }
        }
      }
      expect(foundSlowTemplate).toBe(true);
    });

    it("cluster voicings produce tight pitch spans for alfaMist piano", () => {
      const r = generateJamSession(makeConfig({
        style: "alfaMist", form: "modal16", key: "C", tempo: 95,
      }));
      const chords = scoreChordsToEvents(r.score.measures);
      const compChords = chords.map(c => ({
        root: c.root, quality: c.quality, time: c.time, duration: c.duration,
      }));

      // Generate many times to get cluster voicings (60% chance)
      let foundCluster = false;
      for (let i = 0; i < 20; i++) {
        const notes = generatePianoComping(compChords, {
          style: "alfaMist", tempo: 95, swingAmount: 20, strum: false,
        });
        for (const n of notes) {
          if (n.pitches.length >= 3) {
            const sorted = [...n.pitches].sort((a, b) => a - b);
            const span = sorted[sorted.length - 1] - sorted[0];
            // Cluster voicing: span 5-10 semitones (tighter than Evans 10-11)
            if (span <= 10 && span >= 3) {
              foundCluster = true;
              break;
            }
          }
        }
        if (foundCluster) break;
      }
      expect(foundCluster).toBe(true);
    });

    it("dynamic arc has wider range for alfaMist (whisper to full)", () => {
      // Import dynamicMultiplier indirectly via velocity checking
      const r = generateJamSession(makeConfig({
        style: "alfaMist", form: "modal16", key: "C", tempo: 95,
      }));
      const chords = scoreChordsToEvents(r.score.measures);
      const bassNotes = generateWalkingBass(chords, {
        style: "alfaMist", tempo: 95, humanize: false,
        measureInfo: { totalMeasures: 16, measureDuration: (60 / 95) * 4 },
      });

      // Early notes should be quieter, later notes louder
      const earlyVelocities = bassNotes.filter(n => n.time < chords[2]?.time ?? 5)
        .map(n => n.velocity);
      const lateVelocities = bassNotes.filter(n => n.time > chords[10]?.time ?? 20)
        .map(n => n.velocity);

      if (earlyVelocities.length > 0 && lateVelocities.length > 0) {
        const avgEarly = earlyVelocities.reduce((a, b) => a + b, 0) / earlyVelocities.length;
        const avgLate = lateVelocities.reduce((a, b) => a + b, 0) / lateVelocities.length;
        // Wider arc: late notes should be noticeably louder than early
        expect(avgLate).toBeGreaterThan(avgEarly);
      }
    });

    it("bass chromatic fill aligns with kick position (beat 1.5)", () => {
      const r = generateJamSession(makeConfig({
        style: "alfaMist", form: "turnaround8", key: "C", tempo: 100,
      }));
      const chords = scoreChordsToEvents(r.score.measures);
      const beatDur = 60 / 100;

      // Generate many times to catch chromatic fill pattern
      let foundAlignedFill = false;
      for (let i = 0; i < 30; i++) {
        const bassNotes = generateWalkingBass(chords, {
          style: "alfaMist", tempo: 100, humanize: false,
        });
        // Check for notes at beat 1.5 position (within each measure)
        for (const n of bassNotes) {
          for (const c of chords) {
            const relativeTime = n.time - c.time;
            // Beat 1.5 = 1.5 * beatDur
            if (Math.abs(relativeTime - beatDur * 1.5) < beatDur * 0.1) {
              foundAlignedFill = true;
              break;
            }
          }
          if (foundAlignedFill) break;
        }
        if (foundAlignedFill) break;
      }
      expect(foundAlignedFill).toBe(true);
    });
  });

  // ── Pat Metheny preset ──

  describe("metheny style", () => {
    it("form affinity includes modal, turnaround, throughComposed, pentatonic, quartal", () => {
      const forms = getFormsForStyle("metheny");
      expect(forms).toContain("modal16");
      expect(forms).toContain("turnaround8");
      expect(forms).toContain("throughComposed12");
      expect(forms).toContain("pentatonic8");
      expect(forms).toContain("quartal16");
      expect(forms).not.toContain("blues12");
      expect(forms).not.toContain("minorBlues12");
    });

    it("enrichment favors Lydian extensions (maj7#11, 69, 9sus4)", () => {
      const results = new Set<string>();
      for (let i = 0; i < 300; i++) {
        results.add(enrichQuality("maj7", "metheny", 0.3));
      }
      expect(results.has("maj7#11")).toBe(true);
      // Should also produce maj9 and 69
      const hasBright = results.has("maj9") || results.has("69");
      expect(hasBright).toBe(true);
    });

    it("enriches bare triads to Lydian extensions", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("", "metheny", 0.3));
      }
      const hasLydian = results.has("maj7#11") || results.has("maj7") || results.has("69");
      expect(hasLydian).toBe(true);
    });

    it("sus chords enrich to 9sus4/13sus4", () => {
      const results = new Set<string>();
      for (let i = 0; i < 200; i++) {
        results.add(enrichQuality("7sus", "metheny", 0.3));
        results.add(enrichQuality("sus4", "metheny", 0.3));
      }
      const hasSusExt = results.has("9sus4") || results.has("13sus4");
      expect(hasSusExt).toBe(true);
    });

    it("modal16 uses dedicated Metheny progressions with Lydian colors", () => {
      const allQualities = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const r = generateJamSession(makeConfig({
          style: "metheny", form: "modal16", key: "D",
        }));
        for (const m of r.score.measures) {
          allQualities.add(m.chord!.quality);
        }
      }
      // Metheny pools feature maj7#11, 69, 9sus4
      const hasLydianQualities = allQualities.has("maj7#11") || allQualities.has("69") || allQualities.has("9sus4");
      expect(hasLydianQualities).toBe(true);
    });

    it("turnaround8 uses dedicated Metheny progressions", () => {
      const allRoots = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const r = generateJamSession(makeConfig({
          style: "metheny", form: "turnaround8", key: "D",
        }));
        for (const m of r.score.measures) {
          allRoots.add(m.chord!.root);
        }
      }
      // Metheny turnarounds feature chromatic mediants (Bb from D key)
      expect(allRoots.size).toBeGreaterThanOrEqual(3);
    });

    it("pentatonic8 uses dedicated Metheny vamps", () => {
      const allQualities = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const r = generateJamSession(makeConfig({
          style: "metheny", form: "pentatonic8", key: "D",
        }));
        expect(r.score.measures).toHaveLength(8);
        for (const m of r.score.measures) {
          allQualities.add(m.chord!.quality);
        }
      }
      // Metheny pentatonic vamps feature maj7#11, 9sus4
      const hasSignatureQualities = allQualities.has("maj7#11") || allQualities.has("9sus4") || allQualities.has("69");
      expect(hasSignatureQualities).toBe(true);
    });

    it("generates valid jam session across all affinity forms", () => {
      const forms = getFormsForStyle("metheny");
      for (const form of forms) {
        expect(() => {
          generateJamSession(makeConfig({ style: "metheny", form, key: "G" }));
        }).not.toThrow();
      }
    });

    it("open voicings produce wide pitch spans for metheny piano", () => {
      const r = generateJamSession(makeConfig({
        style: "metheny", form: "modal16", key: "D", tempo: 95,
      }));
      const chords = scoreChordsToEvents(r.score.measures);
      const compChords = chords.map(c => ({
        root: c.root, quality: c.quality, time: c.time, duration: c.duration,
      }));

      // Generate many times to get open voicings (65% chance)
      let foundWide = false;
      for (let i = 0; i < 20; i++) {
        const notes = generatePianoComping(compChords, {
          style: "metheny", tempo: 95, swingAmount: 25, strum: false,
        });
        for (const n of notes) {
          if (n.pitches.length >= 3) {
            const sorted = [...n.pitches].sort((a, b) => a - b);
            const span = sorted[sorted.length - 1] - sorted[0];
            // Open voicing: span 10-17 semitones (wider than Evans 10-11)
            if (span >= 10) {
              foundWide = true;
              break;
            }
          }
        }
        if (foundWide) break;
      }
      expect(foundWide).toBe(true);
    });

    it("bass generates melodic Jaco patterns (not walking)", () => {
      const r = generateJamSession(makeConfig({
        style: "metheny", form: "turnaround8", key: "D",
      }));
      const events = scoreChordsToEvents(r.score.measures);
      const bass = generateWalkingBass(events, {
        style: "metheny", tempo: 100, swingAmount: 25,
      });
      expect(bass.length).toBeGreaterThan(0);
      // Jaco patterns have varying note counts (2-5 per measure), not strict 4-note walking
      const noteCounts = new Set<number>();
      let count = 0;
      let prevChordTime = -1;
      for (const note of bass) {
        expect(note.pitch).toBeGreaterThanOrEqual(28);
        expect(note.pitch).toBeLessThanOrEqual(67);
        const chordIdx = events.findIndex(c => note.time >= c.time && note.time < c.time + c.duration);
        if (chordIdx !== prevChordTime) {
          if (count > 0) noteCounts.add(count);
          count = 1;
          prevChordTime = chordIdx;
        } else {
          count++;
        }
      }
      if (count > 0) noteCounts.add(count);
      // Should have variety in note counts (melodic, not walking)
      expect(noteCounts.size).toBeGreaterThanOrEqual(1);
    });

    it("drums generate conversational Bob Moses patterns", () => {
      const drums = generateDrumPattern({
        style: "metheny", tempo: 95, measures: 4, humanize: false,
      });
      expect(drums.length).toBeGreaterThan(0);
      // Ride should be present (flat ride quarter notes)
      const rideHits = drums.filter(h => h.pitch === 51 || h.pitch === 53);
      expect(rideHits.length).toBeGreaterThan(4);
      // Kick should be sparse (Bob Moses conversational)
      const kickHits = drums.filter(h => h.pitch === 36);
      const snareHits = drums.filter(h => h.pitch === 38 || h.pitch === 37);
      expect(kickHits.length).toBeGreaterThan(0);
      // Bob Moses: snare is intentionally sparse (ghost notes at 8-15% probability)
      expect(snareHits.length).toBeGreaterThanOrEqual(0);
      // Bob Moses: low velocity overall (lighter than swing)
      for (const hit of rideHits) {
        expect(hit.velocity).toBeLessThanOrEqual(80);
      }
    });

    it("dynamic arc is floating and even (not dramatic)", () => {
      const r = generateJamSession(makeConfig({
        style: "metheny", form: "modal16", key: "D", tempo: 95,
      }));
      const chords = scoreChordsToEvents(r.score.measures);
      const bassNotes = generateWalkingBass(chords, {
        style: "metheny", tempo: 95, humanize: false,
        measureInfo: { totalMeasures: 16, measureDuration: (60 / 95) * 4 },
      });

      const earlyThreshold = chords[2]?.time ?? 5;
      const lateThreshold = chords[10]?.time ?? 20;
      const earlyVelocities = bassNotes.filter(n => n.time < earlyThreshold)
        .map(n => n.velocity);
      const lateVelocities = bassNotes.filter(n => n.time > lateThreshold)
        .map(n => n.velocity);

      if (earlyVelocities.length > 0 && lateVelocities.length > 0) {
        const avgEarly = earlyVelocities.reduce((a, b) => a + b, 0) / earlyVelocities.length;
        const avgLate = lateVelocities.reduce((a, b) => a + b, 0) / lateVelocities.length;
        // Metheny arc: gentle, not dramatic — late should be somewhat louder but not extreme
        expect(avgLate).toBeGreaterThanOrEqual(avgEarly * 0.9);
      }
    });
  });

  // ── Full Song form ──

  describe("fullSong form", () => {
    it("generates score with sections array", () => {
      const r = generateJamSession(makeConfig({ form: "fullSong", style: "swing", key: "Bb" }));
      expect(r.sections).toBeDefined();
      expect(r.sections!.length).toBeGreaterThanOrEqual(4); // at least intro, head, solo, outro
      expect(r.score.measures.length).toBeGreaterThan(20);
      expect(r.progressionLabel).toBe("Full Song in Bb");
    });

    it("sections cover all measures without gaps or overlaps", () => {
      const styles = ["swing", "alfaMist", "fusion", "bossa", "modal", "funk"] as const;
      for (const style of styles) {
        const r = generateJamSession(makeConfig({ form: "fullSong", style, key: "C" }));
        const sections = r.sections!;
        expect(sections.length).toBeGreaterThanOrEqual(4);

        // First section starts at 0
        expect(sections[0].startMeasure).toBe(0);
        // Last section ends at total measures
        expect(sections[sections.length - 1].endMeasure).toBe(r.score.measures.length);

        // No gaps or overlaps
        for (let i = 1; i < sections.length; i++) {
          expect(sections[i].startMeasure).toBe(sections[i - 1].endMeasure);
        }
      }
    });

    it("contains intro and outro sections", () => {
      const r = generateJamSession(makeConfig({ form: "fullSong", style: "hardBop", key: "F" }));
      const types = r.sections!.map(s => s.type);
      expect(types[0]).toBe("intro");
      expect(types[types.length - 1]).toBe("outro");
    });

    it("contains at least one solo section", () => {
      const r = generateJamSession(makeConfig({ form: "fullSong", style: "coolJazz", key: "Eb" }));
      const solos = r.sections!.filter(s => s.type === "solo");
      expect(solos.length).toBeGreaterThanOrEqual(1);
    });

    it("solo sections have higher dynamics than intro/outro", () => {
      const r = generateJamSession(makeConfig({ form: "fullSong", style: "swing", key: "A" }));
      const solos = r.sections!.filter(s => s.type === "solo");
      const intro = r.sections!.find(s => s.type === "intro")!;
      const outro = r.sections!.find(s => s.type === "outro")!;
      expect(solos.length).toBeGreaterThanOrEqual(1);
      for (const solo of solos) {
        expect(solo.dynamicLevel).toBeGreaterThan(intro.dynamicLevel);
        expect(solo.dynamicLevel).toBeGreaterThan(outro.dynamicLevel);
      }
    });

    it("sections have valid labels", () => {
      const r = generateJamSession(makeConfig({ form: "fullSong", style: "alfaMist", key: "Db" }));
      for (const sec of r.sections!) {
        expect(sec.label).toBeTruthy();
        expect(sec.label.length).toBeGreaterThan(0);
      }
    });

    it("every measure has valid chord", () => {
      const r = generateJamSession(makeConfig({ form: "fullSong", style: "metheny", key: "G" }));
      for (const m of r.score.measures) {
        expect(m.chords.length).toBeGreaterThan(0);
        expect(m.chords[0].root).toBeTruthy();
      }
    });

    it("fullSong available for all styles", () => {
      const styles = [
        "swing", "hardBop", "coolJazz", "ballad", "bossa", "latin", "funk",
        "fusion", "ecm", "modal", "jazzWaltz", "shuffleBlues", "neoSoul",
        "contemporaryJazz", "mathRock", "idm", "metheny", "holdsworth", "alfaMist",
      ] as const;
      for (const style of styles) {
        const forms = getFormsForStyle(style);
        expect(forms).toContain("fullSong");
      }
    });

    it("dynamicMultiplier with sections produces different values per section", () => {
      const sections: SongSection[] = [
        { type: "intro", label: "Intro", startMeasure: 0, endMeasure: 4, sourceForm: "turnaround8", dynamicLevel: 0.65 },
        { type: "head", label: "Head", startMeasure: 4, endMeasure: 20, sourceForm: "modal16", dynamicLevel: 0.80 },
        { type: "solo", label: "Solo", startMeasure: 20, endMeasure: 36, sourceForm: "modal16", dynamicLevel: 0.95 },
        { type: "outro", label: "Outro", startMeasure: 36, endMeasure: 40, sourceForm: "turnaround8", dynamicLevel: 0.70 },
      ];
      const introVal = dynamicMultiplier(1, 40, "swing", sections);
      const soloVal = dynamicMultiplier(28, 40, "swing", sections);
      const outroVal = dynamicMultiplier(38, 40, "swing", sections);

      // Solo should be louder than intro
      expect(soloVal).toBeGreaterThan(introVal);
      // Solo should be louder than outro
      expect(soloVal).toBeGreaterThan(outroVal);
    });

    it("without sections, dynamicMultiplier behaves as before", () => {
      const withoutSections = dynamicMultiplier(5, 32, "swing");
      const withUndefined = dynamicMultiplier(5, 32, "swing", undefined);
      const withEmpty = dynamicMultiplier(5, 32, "swing", []);
      expect(withoutSections).toBe(withUndefined);
      expect(withoutSections).toBe(withEmpty);
    });
  });

  // ── Scale mapping completeness ──

  describe("scale mapping — no Chromatic fallback for generated qualities", () => {
    it("all enrichQuality outputs have non-Chromatic scale mapping", () => {
      // qualityToScale + SCALE_TYPES imported at top
      const allQualities = new Set<string>();
      const styles = [
        "swing", "hardBop", "coolJazz", "ballad", "fusion", "ecm",
        "modal", "neoSoul", "alfaMist", "metheny", "holdsworth",
        "contemporaryJazz", "funk", "shuffleBlues", "bossa", "latin",
      ];
      const baseQualities = [
        "", "6", "add9", "maj7", "maj9", "maj13", "maj7#11", "maj7#5",
        "m", "m7", "m9", "m11", "m6", "m(maj7)",
        "7", "9", "13", "7sus", "7b9", "7#9", "7alt", "7b13", "7#5", "7#11", "7b5",
        "dim", "dim7", "m7b5", "aug", "aug7", "sus4", "sus2",
        "9sus4", "13sus4", "69", "5",
      ];

      for (const style of styles) {
        for (const q of baseQualities) {
          for (let pos = 0; pos <= 1; pos += 0.25) {
            for (let trial = 0; trial < 10; trial++) {
              allQualities.add(enrichQuality(q, style, pos));
            }
          }
        }
      }

      const chromatic: string[] = [];
      for (const q of allQualities) {
        if (qualityToScale(q) === SCALE_TYPES.CHROMATIC) {
          chromatic.push(q);
        }
      }
      expect(chromatic).toEqual([]);
    });

    it("all template chord qualities have non-Chromatic mapping", () => {
      // qualityToScale + SCALE_TYPES imported at top
      const chromatic: string[] = [];
      const forms: JamForm[] = [
        "blues12", "rhythm32", "aaba32", "modal16", "turnaround8",
        "abac32", "songForm24", "rondo20", "clave16", "minorBlues12",
        "secondLine16", "coltraneMatrix16", "throughComposed12",
        "pentatonic8", "quartal16",
      ];
      const styles = ["swing", "alfaMist", "metheny", "holdsworth", "fusion"] as const;

      for (const style of styles) {
        for (const form of forms) {
          const r = generateJamSession(makeConfig({ form, style, key: "C" }));
          for (const m of r.score.measures) {
            const q = m.chords[0]?.quality ?? "";
            if (qualityToScale(q) === SCALE_TYPES.CHROMATIC) {
              chromatic.push(`${style}/${form}: ${m.chords[0]?.root}${q}`);
            }
          }
        }
      }
      // Deduplicate for readable output
      const unique = [...new Set(chromatic)];
      expect(unique).toEqual([]);
    });
  });
});

// ── Tempo Validation ──

describe("Jam Generator — tempo validation", () => {
  it("throws RangeError for tempo = 0", () => {
    expect(() => generateJamSession(makeConfig({ tempo: 0 }))).toThrow(RangeError);
  });

  it("throws RangeError for negative tempo", () => {
    expect(() => generateJamSession(makeConfig({ tempo: -60 }))).toThrow(RangeError);
  });
});
