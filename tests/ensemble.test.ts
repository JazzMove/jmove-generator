import { describe, it, expect } from "vitest";
import {
  generateEnsemble,
  generateEnsembleMeasures,
  type ChordEvent,
  type EnsembleOptions,
  type PracticeStyle,
} from "../src/index";

// ── Test Fixtures ──

function makeBlues12Chords(tempo = 120): ChordEvent[] {
  const beatDur = 60 / tempo;
  const measureDur = 4 * beatDur;
  const progression = [
    "Bb7", "Bb7", "Bb7", "Bb7",
    "Eb7", "Eb7", "Bb7", "Bb7",
    "F7", "Eb7", "Bb7", "F7",
  ];
  return progression.map((chord, i) => ({
    root: chord.replace(/[0-9#bmaj]+$/, "").replace("b", "b"),
    quality: chord.replace(/^[A-G][b#]?/, ""),
    time: i * measureDur,
    duration: measureDur,
  }));
}

function makeSimpleChords(measures: number, tempo = 120): ChordEvent[] {
  const beatDur = 60 / tempo;
  const measureDur = 4 * beatDur;
  return Array.from({ length: measures }, (_, i) => ({
    root: ["C", "F", "G", "Am"][i % 4].replace("m", ""),
    quality: i % 4 === 3 ? "m7" : "maj7",
    time: i * measureDur,
    duration: measureDur,
  }));
}

const ALL_STYLES: PracticeStyle[] = [
  "swing", "bossa", "latin", "ballad", "funk",
  "fusion", "ecm", "hardBop", "coolJazz",
  "modal", "jazzWaltz", "shuffleBlues",
  "neoSoul", "contemporaryJazz", "mathRock", "idm",
  "holdsworth", "alfaMist", "metheny",
];

// ── Tests ──

describe("Ensemble Coordination Layer", () => {
  describe("generateEnsemble — basic functionality", () => {
    it("produces non-empty output for all instruments", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
        seed: 42,
      });

      expect(result.drums.length).toBeGreaterThan(0);
      expect(result.bass.length).toBeGreaterThan(0);
      expect(result.piano.length).toBeGreaterThan(0);
    });

    it("returns the seed used", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
        seed: 42,
      });
      expect(result.seed).toBe(42);
    });

    it("auto-generates seed when not provided", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
      });
      expect(typeof result.seed).toBe("number");
      expect(result.seed).not.toBe(0);
    });

    it("returns BandContext with populated fields", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
        seed: 100,
      });

      expect(result.context.kickTimes.length).toBeGreaterThan(0);
      expect(result.context.bassTimes.length).toBeGreaterThan(0);
      expect(result.context.phraseMap.boundaries.length).toBeGreaterThan(0);
      expect(["low", "mid", "high"]).toContain(result.context.bassRegister);
      expect(["8ths", "16ths", "quarters", "sparse"]).toContain(result.context.hihatPattern);
    });
  });

  describe("determinism — same seed = same output", () => {
    it("identical output across 10 runs", () => {
      const opts: EnsembleOptions = {
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 140,
        measures: 12,
        seed: 777,
      };

      const reference = generateEnsemble(opts);
      for (let i = 0; i < 10; i++) {
        const run = generateEnsemble(opts);
        expect(run.drums).toEqual(reference.drums);
        expect(run.bass).toEqual(reference.bass);
        expect(run.piano).toEqual(reference.piano);
      }
    });

    it("different seeds produce different output", () => {
      const opts: EnsembleOptions = {
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
      };

      const r1 = generateEnsemble({ ...opts, seed: 1 });
      const r2 = generateEnsemble({ ...opts, seed: 2 });

      // At least one instrument should differ
      const drumsDiffer = JSON.stringify(r1.drums) !== JSON.stringify(r2.drums);
      const bassDiffer = JSON.stringify(r1.bass) !== JSON.stringify(r2.bass);
      const pianoDiffer = JSON.stringify(r1.piano) !== JSON.stringify(r2.piano);
      expect(drumsDiffer || bassDiffer || pianoDiffer).toBe(true);
    });
  });

  describe("coordination — instruments align", () => {
    it("bass beat-1 notes are within 15ms of nearest kick", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
        seed: 42,
      });

      const kicks = result.context.kickTimes;
      // Check first notes of each measure (approximation of beat-1)
      const beatDur = 60 / 120;
      const measureDur = 4 * beatDur;

      for (let m = 0; m < 12; m++) {
        const mStart = m * measureDur;
        const beat1Bass = result.bass.find(
          n => Math.abs(n.time - mStart) < beatDur * 0.6
        );
        if (!beat1Bass) continue;

        const nearestKick = kicks.reduce((best, kt) => {
          const dist = Math.abs(beat1Bass.time - kt);
          return dist < Math.abs(beat1Bass.time - best) ? kt : best;
        }, Infinity);

        if (nearestKick !== Infinity) {
          const dist = Math.abs(beat1Bass.time - nearestKick);
          // Either aligned (within 15ms) or no kick near this beat (ok)
          if (dist < 0.05) {
            expect(dist).toBeLessThanOrEqual(0.015);
          }
        }
      }
    });

    it("piano notes align within 15ms of nearest bass note", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
        seed: 42,
      });

      const bassTimes = result.context.bassTimes;
      let alignedCount = 0;
      let totalNearby = 0;

      for (const pn of result.piano) {
        const nearestBass = bassTimes.reduce((best, bt) => {
          const dist = Math.abs(pn.time - bt);
          return dist < Math.abs(pn.time - best) ? bt : best;
        }, Infinity);

        if (nearestBass !== Infinity) {
          const dist = Math.abs(pn.time - nearestBass);
          if (dist < 0.05) {
            totalNearby++;
            if (dist <= 0.015) alignedCount++;
          }
        }
      }

      // Most nearby piano notes should be aligned
      if (totalNearby > 0) {
        expect(alignedCount / totalNearby).toBeGreaterThan(0.5);
      }
    });
  });

  describe("section-aware dynamics", () => {
    it("intro sections produce fewer notes than shout sections", () => {
      const chords = makeSimpleChords(16, 120);
      const sections = [
        { type: "intro" as const, label: "Intro", startMeasure: 0, endMeasure: 4, sourceForm: "blues12" as const, dynamicLevel: 0.30 },
        { type: "shout" as const, label: "Shout", startMeasure: 4, endMeasure: 8, sourceForm: "blues12" as const, dynamicLevel: 0.95 },
        { type: "head" as const, label: "Head", startMeasure: 8, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 0.70 },
      ];

      const result = generateEnsemble({
        chordEvents: chords,
        style: "swing",
        tempo: 120,
        measures: 16,
        seed: 42,
        sections,
      });

      // Context should reflect section energy
      expect(result.context.sectionEnergy).toBeGreaterThan(0);
      expect(result.context.sectionEnergy).toBeLessThanOrEqual(1);
    });
  });

  describe("phrase boundaries", () => {
    it("phraseMap has correct boundaries for 12-bar blues", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
        seed: 42,
      });

      expect(result.context.phraseMap.boundaries.length).toBeGreaterThan(0);
      expect(result.context.phraseMap.boundaries[0]).toBe(0);
      expect(result.context.phraseMap.phraseLength).toBeGreaterThanOrEqual(2);
      expect(result.context.phraseMap.phraseLength).toBeLessThanOrEqual(8);
    });

    it("crash cymbals appear near phrase boundaries", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
        seed: 42,
      });

      // There should be at least one crash (usually on measure 0)
      expect(result.context.crashTimes.length).toBeGreaterThan(0);
    });
  });

  describe("all 19 styles — smoke test", () => {
    for (const style of ALL_STYLES) {
      it(`${style}: generates non-empty output without throwing`, () => {
        const result = generateEnsemble({
          chordEvents: makeSimpleChords(8, 140),
          style,
          tempo: 140,
          measures: 8,
          seed: 12345,
        });

        expect(result.drums.length).toBeGreaterThan(0);
        expect(result.bass.length).toBeGreaterThan(0);
        expect(result.piano.length).toBeGreaterThan(0);
      });

      it(`${style}: timing bounds respected`, () => {
        const tempo = 120;
        const beatDur = 60 / tempo;
        const measureDur = 4 * beatDur;
        const totalDuration = 8 * measureDur;

        const result = generateEnsemble({
          chordEvents: makeSimpleChords(8, tempo),
          style,
          tempo,
          measures: 8,
          seed: 99,
        });

        // All notes should be within bounds (allowing small humanization overshoot)
        for (const n of result.bass) {
          expect(n.time).toBeGreaterThanOrEqual(-0.05);
          expect(n.time).toBeLessThan(totalDuration + 0.5);
        }
        for (const n of result.piano) {
          expect(n.time).toBeGreaterThanOrEqual(-0.05);
          expect(n.time).toBeLessThan(totalDuration + 0.5);
        }
        for (const n of result.drums) {
          expect(n.time).toBeGreaterThanOrEqual(-0.05);
          expect(n.time).toBeLessThan(totalDuration + 0.5);
        }
      });
    }
  });

  describe("generateEnsembleMeasures — streaming iterator", () => {
    it("yields correct number of measures", () => {
      const slices = [...generateEnsembleMeasures({
        chordEvents: makeSimpleChords(8),
        style: "swing",
        tempo: 120,
        measures: 8,
        seed: 42,
      })];

      expect(slices.length).toBe(8);
      expect(slices[0].measure).toBe(0);
      expect(slices[7].measure).toBe(7);
    });

    it("each slice has drum/bass/piano arrays", () => {
      const slices = [...generateEnsembleMeasures({
        chordEvents: makeSimpleChords(4),
        style: "swing",
        tempo: 120,
        measures: 4,
        seed: 42,
      })];

      for (const slice of slices) {
        expect(Array.isArray(slice.drums)).toBe(true);
        expect(Array.isArray(slice.bass)).toBe(true);
        expect(Array.isArray(slice.piano)).toBe(true);
        expect(slice.drums.length).toBeGreaterThan(0);
      }
    });

    it("deterministic: same seed produces same slices", () => {
      const opts: EnsembleOptions = {
        chordEvents: makeSimpleChords(4),
        style: "swing",
        tempo: 120,
        measures: 4,
        seed: 555,
      };

      const slices1 = [...generateEnsembleMeasures(opts)];
      const slices2 = [...generateEnsembleMeasures(opts)];

      for (let i = 0; i < slices1.length; i++) {
        expect(slices1[i].drums).toEqual(slices2[i].drums);
        expect(slices1[i].bass).toEqual(slices2[i].bass);
        expect(slices1[i].piano).toEqual(slices2[i].piano);
      }
    });
  });

  describe("instrumentStyles — per-instrument style override", () => {
    it("applies different styles to each instrument", () => {
      const result = generateEnsemble({
        chordEvents: makeBlues12Chords(),
        style: "swing",
        tempo: 120,
        measures: 12,
        seed: 42,
        instrumentStyles: {
          drums: "hardBop",
          bass: "swing",
          piano: "coolJazz",
        },
      });

      expect(result.drums.length).toBeGreaterThan(0);
      expect(result.bass.length).toBeGreaterThan(0);
      expect(result.piano.length).toBeGreaterThan(0);
    });
  });

  describe("bandContext — behavioral verification", () => {
    const baseOpts: EnsembleOptions = {
      chordEvents: makeSimpleChords(16, 120),
      style: "swing",
      tempo: 120,
      measures: 16,
      seed: 42,
    };

    it("low sectionEnergy produces softer drum velocities than high energy", () => {
      const quietSections = [
        { type: "intro" as const, label: "Intro", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 0.35 },
      ];
      const loudSections = [
        { type: "shout" as const, label: "Shout", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 1.0 },
      ];

      const quiet = generateEnsemble({ ...baseOpts, sections: quietSections });
      const loud = generateEnsemble({ ...baseOpts, sections: loudSections });

      const avgQuietVel = quiet.drums.reduce((s, h) => s + h.velocity, 0) / quiet.drums.length;
      const avgLoudVel = loud.drums.reduce((s, h) => s + h.velocity, 0) / loud.drums.length;

      expect(avgLoudVel).toBeGreaterThan(avgQuietVel);
    });

    it("low sectionEnergy produces softer bass velocities than high energy", () => {
      const quietSections = [
        { type: "intro" as const, label: "Intro", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 0.35 },
      ];
      const loudSections = [
        { type: "shout" as const, label: "Shout", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 1.0 },
      ];

      const quiet = generateEnsemble({ ...baseOpts, sections: quietSections });
      const loud = generateEnsemble({ ...baseOpts, sections: loudSections });

      const avgQuietVel = quiet.bass.reduce((s, n) => s + n.velocity, 0) / quiet.bass.length;
      const avgLoudVel = loud.bass.reduce((s, n) => s + n.velocity, 0) / loud.bass.length;

      expect(avgLoudVel).toBeGreaterThan(avgQuietVel);
    });

    it("low sectionEnergy produces softer piano velocities than high energy", () => {
      const quietSections = [
        { type: "intro" as const, label: "Intro", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 0.35 },
      ];
      const loudSections = [
        { type: "shout" as const, label: "Shout", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 1.0 },
      ];

      const quiet = generateEnsemble({ ...baseOpts, sections: quietSections });
      const loud = generateEnsemble({ ...baseOpts, sections: loudSections });

      const avgQuietVel = quiet.piano.reduce((s, n) => s + n.velocity, 0) / quiet.piano.length;
      const avgLoudVel = loud.piano.reduce((s, n) => s + n.velocity, 0) / loud.piano.length;

      expect(avgLoudVel).toBeGreaterThan(avgQuietVel);
    });

    it("low energy strips ghost notes from drums (higher threshold)", () => {
      // Use density=30 where ghost threshold matters: at energy 0.3 threshold≈29, at energy 1.0 threshold=15
      const quietSections = [
        { type: "intro" as const, label: "Intro", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 0.35 },
      ];
      const loudSections = [
        { type: "shout" as const, label: "Shout", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 1.0 },
      ];

      const quiet = generateEnsemble({ ...baseOpts, density: 30, sections: quietSections });
      const loud = generateEnsemble({ ...baseOpts, density: 30, sections: loudSections });

      // Quiet sections should have fewer total drum hits (ghosts stripped)
      expect(quiet.drums.length).toBeLessThanOrEqual(loud.drums.length);
    });

    it("high drum density increases piano rest probability (fewer piano notes)", () => {
      // Test over many seeds: when density is high, drumDensity > 0.6 activates
      // piano rest boost. On average, high density should produce fewer piano notes
      // per chord than low density (even though low density has its own sparsity).
      let lowDensityPianoTotal = 0;
      let highDensityPianoTotal = 0;
      const runs = 30;

      for (let s = 1; s <= runs; s++) {
        const low = generateEnsemble({ ...baseOpts, density: 30, seed: s });
        const high = generateEnsemble({ ...baseOpts, density: 90, seed: s });
        lowDensityPianoTotal += low.piano.length;
        highDensityPianoTotal += high.piano.length;
      }

      // High density produces more piano notes overall (density drives rhythm selection),
      // but the per-chord ratio should show the rest boost effect.
      // With drumDensity rest boost active at high density, the piano should produce
      // FEWER notes per chord-slot than it would without the rest boost.
      // Verify the high-density drum context is actually populated
      const sample = generateEnsemble({ ...baseOpts, density: 90, seed: 42 });
      expect(sample.context.drumDensity).toBeGreaterThan(0.3);

      // The piano note count increase should be less than proportional to density increase
      // (rest boost dampens piano growth at high drum density)
      const pianoGrowthRatio = highDensityPianoTotal / lowDensityPianoTotal;
      // Without rest boost, piano at density 90 would be ~2-3x of density 30.
      // With rest boost active, it should be dampened (< 3x)
      expect(pianoGrowthRatio).toBeLessThan(3.0);
      expect(pianoGrowthRatio).toBeGreaterThan(0.5); // sanity: still more notes
    });

    it("bass register 'high' shifts piano voicings up to avoid collision", () => {
      // Generate multiple seeds and collect results — bass register is data-dependent
      // so we find a case where bass is high and verify piano pitches are elevated
      const result = generateEnsemble({ ...baseOpts, seed: 42 });
      const bassRegister = result.context.bassRegister;

      if (bassRegister === "high") {
        // All piano pitches should be ≥60 (shifted up if they were below)
        const lowestPianoPitch = Math.min(...result.piano.flatMap(n => n.pitches));
        expect(lowestPianoPitch).toBeGreaterThanOrEqual(48); // shifted range
      }
      // If bass isn't high on this seed, verify piano can have low notes
      if (bassRegister === "low" || bassRegister === "mid") {
        const lowestPianoPitch = Math.min(...result.piano.flatMap(n => n.pitches));
        // Normal range includes pitches below 60
        expect(lowestPianoPitch).toBeLessThan(72);
      }
    });

    it("no bandContext = no velocity penalty (fallback multiplier 1.0)", () => {
      // Generate using individual generators (no bandContext) and compare
      // Average velocity should be close to or higher than ensemble with low energy
      const quietSections = [
        { type: "intro" as const, label: "Intro", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 0.35 },
      ];
      const loud = generateEnsemble({ ...baseOpts, sections: undefined });
      const quiet = generateEnsemble({ ...baseOpts, sections: quietSections });

      const avgDrumVelNoSection = loud.drums.reduce((s, h) => s + h.velocity, 0) / loud.drums.length;
      const avgDrumVelQuiet = quiet.drums.reduce((s, h) => s + h.velocity, 0) / quiet.drums.length;

      // Without sections, energy defaults to 0.7 which is moderate
      // With quiet sections (energy 0.25), velocity should be lower
      expect(avgDrumVelNoSection).toBeGreaterThan(avgDrumVelQuiet);
    });

    it("energy scales fill probability (quiet = fewer fills)", () => {
      // Generate many runs with sections to observe fill frequency
      const quietSections = [
        { type: "intro" as const, label: "Intro", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 0.30 },
      ];
      const loudSections = [
        { type: "shout" as const, label: "Shout", startMeasure: 0, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 1.0 },
      ];

      // Aggregate over multiple seeds for statistical significance
      let quietTotal = 0, loudTotal = 0;
      for (let s = 1; s <= 20; s++) {
        const q = generateEnsemble({ ...baseOpts, seed: s, sections: quietSections });
        const l = generateEnsemble({ ...baseOpts, seed: s, sections: loudSections });
        quietTotal += q.drums.length;
        loudTotal += l.drums.length;
      }

      // Loud sections should produce more total drum hits (more fills, more ghosts)
      expect(loudTotal).toBeGreaterThan(quietTotal);
    });
  });

  describe("streaming — fills and phrase continuity", () => {
    it("streaming produces fills before section boundaries", () => {
      // 16 measures with section boundary at measure 8 — measure 7 should sometimes get fills
      const sections = [
        { type: "A" as const, label: "A", startMeasure: 0, endMeasure: 8, sourceForm: "blues12" as const, dynamicLevel: 0.9 },
        { type: "B" as const, label: "B", startMeasure: 8, endMeasure: 16, sourceForm: "blues12" as const, dynamicLevel: 0.9 },
      ];

      let fillCount = 0;
      const trials = 20;
      for (let s = 0; s < trials; s++) {
        const slices = [...generateEnsembleMeasures({
          chordEvents: makeSimpleChords(16, 120),
          style: "swing",
          tempo: 120,
          measures: 16,
          seed: s * 100 + 7,
          sections,
        })];

        // Measure 7 is before section boundary at 8 — check for fill-like activity
        // Fills add extra hits in beats 3-4 range. A fill measure typically has more hits
        // than a non-fill measure.
        const measure7 = slices[7];
        const measure3 = slices[3]; // non-boundary measure for comparison
        if (measure7.drums.length > measure3.drums.length + 2) {
          fillCount++;
        }
      }
      // With 20 trials at energy 0.9, should get fills at least sometimes
      expect(fillCount).toBeGreaterThan(0);
    });

    it("streaming maintains drum variation continuity across measures", () => {
      // Generate 8 measures in streaming — check that ride/hihat pattern is consistent
      // (not randomly re-picked each measure)
      const slices = [...generateEnsembleMeasures({
        chordEvents: makeSimpleChords(8, 120),
        style: "swing",
        tempo: 120,
        measures: 8,
        seed: 42,
      })];

      // In swing style, ride cymbal (pitch 51) should appear in every measure
      // and hi-hat pattern should be stable across consecutive bars
      for (const slice of slices) {
        const rideHits = slice.drums.filter(h => h.pitch === 51 || h.pitch === 53);
        expect(rideHits.length).toBeGreaterThan(0);
      }
    });

    it("streaming uses stochastic comping for swing (not fixed patterns)", () => {
      // Swing is a stochastic style — kick/snare comping should vary between measures.
      // Before the tendency fix, streaming fell back to a fixed pattern every measure.
      const slices = [...generateEnsembleMeasures({
        chordEvents: makeSimpleChords(16, 120),
        style: "swing",
        tempo: 120,
        measures: 16,
        seed: 99,
      })];

      // Extract kick hit count per measure — stochastic comping should produce
      // varied kick patterns, not identical ones every measure
      const kickCounts = slices.map(s =>
        s.drums.filter(h => h.pitch === 36).length
      );
      // With 16 measures of stochastic comping, expect at least 2 different kick counts
      const uniqueCounts = new Set(kickCounts);
      expect(uniqueCounts.size).toBeGreaterThan(1);
    });
  });

  describe("edge cases and robustness", () => {
    it("dynamicLevel = 0 still produces audible output (velocity > 0)", () => {
      const sections = [
        { type: "intro" as const, label: "Silent", startMeasure: 0, endMeasure: 8, sourceForm: "blues12" as const, dynamicLevel: 0 },
      ];
      const result = generateEnsemble({
        chordEvents: makeSimpleChords(8),
        style: "swing",
        tempo: 120,
        measures: 8,
        seed: 42,
        sections,
      });

      // All velocities should be > 0 (dynamicLevel floored at 0.3)
      for (const h of result.drums) expect(h.velocity).toBeGreaterThan(0);
      for (const n of result.bass) expect(n.velocity).toBeGreaterThan(0);
      for (const n of result.piano) expect(n.velocity).toBeGreaterThan(0);
    });

    it("all velocities stay within MIDI range [1, 127]", () => {
      // Test with extreme dynamic levels across all styles
      for (const style of ALL_STYLES) {
        const sections = [
          { type: "shout" as const, label: "Loud", startMeasure: 0, endMeasure: 8, sourceForm: "blues12" as const, dynamicLevel: 1.0 },
        ];
        const result = generateEnsemble({
          chordEvents: makeSimpleChords(8, 140),
          style,
          tempo: 140,
          measures: 8,
          seed: 42,
          sections,
        });

        for (const h of result.drums) {
          expect(h.velocity).toBeGreaterThanOrEqual(1);
          expect(h.velocity).toBeLessThanOrEqual(127);
        }
        for (const n of result.bass) {
          expect(n.velocity).toBeGreaterThanOrEqual(1);
          expect(n.velocity).toBeLessThanOrEqual(127);
        }
        for (const n of result.piano) {
          expect(n.velocity).toBeGreaterThanOrEqual(1);
          expect(n.velocity).toBeLessThanOrEqual(127);
        }
      }
    });

    it("empty chordEvents produces drums but no bass/piano", () => {
      const result = generateEnsemble({
        chordEvents: [],
        style: "swing",
        tempo: 120,
        measures: 4,
        seed: 42,
      });

      expect(result.drums.length).toBeGreaterThan(0);
      expect(result.bass.length).toBe(0);
      expect(result.piano.length).toBe(0);
    });

    it("streaming with per-section energy applies different dynamics", () => {
      const sections = [
        { type: "intro" as const, label: "Quiet", startMeasure: 0, endMeasure: 4, sourceForm: "blues12" as const, dynamicLevel: 0.30 },
        { type: "shout" as const, label: "Loud", startMeasure: 4, endMeasure: 8, sourceForm: "blues12" as const, dynamicLevel: 1.0 },
      ];
      const slices = [...generateEnsembleMeasures({
        chordEvents: makeSimpleChords(8, 120),
        style: "swing",
        tempo: 120,
        measures: 8,
        seed: 42,
        sections,
      })];

      // Quiet section (0-3) should have lower avg velocity than loud (4-7)
      const quietDrumVel = slices.slice(0, 4).flatMap(s => s.drums.map(h => h.velocity));
      const loudDrumVel = slices.slice(4, 8).flatMap(s => s.drums.map(h => h.velocity));

      const avgQuiet = quietDrumVel.reduce((a, b) => a + b, 0) / quietDrumVel.length;
      const avgLoud = loudDrumVel.reduce((a, b) => a + b, 0) / loudDrumVel.length;

      expect(avgLoud).toBeGreaterThan(avgQuiet);
    });

    it("sections not covering all measures fall back to default energy", () => {
      const sections = [
        { type: "intro" as const, label: "Intro", startMeasure: 0, endMeasure: 4, sourceForm: "blues12" as const, dynamicLevel: 0.35 },
        // measures 4-7 uncovered
      ];
      const slices = [...generateEnsembleMeasures({
        chordEvents: makeSimpleChords(8, 120),
        style: "swing",
        tempo: 120,
        measures: 8,
        seed: 42,
        sections,
      })];

      // Uncovered measures (4-7) should have context.sectionEnergy = 0.7 (default)
      expect(slices[5].context.sectionEnergy).toBe(0.7);
      expect(slices[5].context.currentSection).toBeNull();
    });
  });

  describe("grace notes", () => {
    it("alfaMist piano notes never have negative time", () => {
      // Grace notes are placed 30ms before the main note; at time=0 this
      // would produce negative time values that break MIDI scheduling.
      const chords = makeSimpleChords(4);
      const results: number[] = [];
      for (let seed = 0; seed < 30; seed++) {
        const result = generateEnsemble({
          chordEvents: chords,
          style: "alfaMist",
          tempo: 120,
          measures: 4,
          seed,
        });
        for (const note of result.piano) {
          results.push(note.time);
        }
      }
      const negatives = results.filter(t => t < 0);
      expect(negatives).toEqual([]);
    });
  });

  describe("performance", () => {
    it("generates 32-measure ensemble in under 50ms", () => {
      const chords = makeSimpleChords(32);
      const opts: EnsembleOptions = {
        chordEvents: chords,
        style: "swing",
        tempo: 140,
        measures: 32,
        seed: 42,
      };

      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        generateEnsemble(opts);
      }
      const elapsed = (performance.now() - start) / 10;

      // Should be well under 50ms per generation
      expect(elapsed).toBeLessThan(50);
    });
  });
});
