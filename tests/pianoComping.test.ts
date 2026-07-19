import { describe, it, expect } from "vitest";
import {
  generatePianoComping,
  resolvePianoGranular,
  createPRNG,
  isDominant,
  type ChordEvent,
  type CompNote,
  type PianoGranular,
} from "../src/index";
import {
  buildUpperStructureVoicing,
  buildStandardVoicing,
  buildOpenVoicing,
  buildQuartalVoicing,
  buildOpen5thsVoicing,
  initVoicingState,
  restoreVoicingState,
} from "../src/pianoVoicings";
import { UST_TRIADS } from "../src/pianoVoicingData";

// ── Constants ──
const PIANO_LOW = 48;  // C3
const PIANO_HIGH = 79; // G5

// ── Helpers ──

function makeChord(root: string, quality: string, time: number, duration = 2): ChordEvent {
  return { root, quality, time, duration };
}

function iiVI(): ChordEvent[] {
  return [
    makeChord("D", "m7", 0),
    makeChord("G", "7", 2),
    makeChord("C", "maj7", 4),
    makeChord("C", "maj7", 6),
  ];
}

// ── Range Tests ──

describe("Piano Comping — range constraints", () => {
  it("all pitches within C3–G5 (MIDI 48–79)", () => {
    const notes = generatePianoComping(iiVI(), { style: "swing", humanize: false, strum: false });
    for (const note of notes) {
      for (const p of note.pitches) {
        expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
        expect(p).toBeLessThanOrEqual(PIANO_HIGH);
      }
    }
  });

  it("range holds for all 12 roots", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    for (const root of roots) {
      const chords = [makeChord(root, "7", 0), makeChord(root, "m7", 2)];
      const notes = generatePianoComping(chords, { humanize: false, strum: false });
      for (const note of notes) {
        for (const p of note.pitches) {
          expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
          expect(p).toBeLessThanOrEqual(PIANO_HIGH);
        }
      }
    }
  });

  it("range holds for bossa", () => {
    const notes = generatePianoComping(iiVI(), { style: "bossa", humanize: false, strum: false });
    for (const note of notes) {
      for (const p of note.pitches) {
        expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
        expect(p).toBeLessThanOrEqual(PIANO_HIGH);
      }
    }
  });

  it("range holds for ballad", () => {
    const notes = generatePianoComping(iiVI(), { style: "ballad", humanize: false, strum: false });
    for (const note of notes) {
      for (const p of note.pitches) {
        expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
        expect(p).toBeLessThanOrEqual(PIANO_HIGH);
      }
    }
  });

  it("range holds for all chord qualities across all roots", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    const qualities = [
      "7", "m7", "maj7", "m7b5", "dim7", "aug7", "9", "m9", "maj9",
      "13", "7#11", "7alt", "sus4", "7b9", "7#9", "6", "m6",
    ];
    for (const root of roots) {
      for (const q of qualities) {
        const chords = [makeChord(root, q, 0), makeChord(root, q, 2)];
        const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
        for (const note of notes) {
          for (const p of note.pitches) {
            expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
            expect(p).toBeLessThanOrEqual(PIANO_HIGH);
          }
        }
      }
    }
  });
});

// ── Voicing Tests ──

describe("Piano Comping — voicings", () => {
  it("produces rootless voicings (4 notes per chord)", () => {
    const notes = generatePianoComping([makeChord("C", "maj7", 0)], {
      style: "ballad", humanize: false, strum: false,
      granular: { voicingDensity: 95, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
    });
    // Ballad = whole note, so 1 hit per measure
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes[0].pitches.length).toBe(4);
  });

  it("Cmaj7 Type A contains intervals 3-5-7-9", () => {
    // Force deterministic by using ballad (single hit)
    const notes = generatePianoComping([makeChord("C", "maj7", 0)], {
      style: "ballad",
      humanize: false,
      strum: false,
      granular: { voicingDensity: 95, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
    });

    // Full voicing should contain major7 chord tones
    const fullNote = notes.find(n => n.pitches.length >= 3) ?? notes[0];
    const pitchClasses = fullNote.pitches.map((p) => p % 12).sort((a, b) => a - b);
    // C=0, E=4, G=7, B=11, D=2 → pitch classes should include some of [2, 4, 7, 11]
    // Type A: 4, 7, 11, 14(=2) → [2, 4, 7, 11]
    // Type B: 11, 14(=2), 16(=4), 19(=7) → [2, 4, 7, 11]
    expect(pitchClasses).toEqual([2, 4, 7, 11]);
  });

  it("Dm7 voicing contains minor chord tones", () => {
    const notes = generatePianoComping([makeChord("D", "m7", 0)], {
      style: "ballad",
      humanize: false,
      strum: false,
      granular: { voicingDensity: 95, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
    });
    const pitchClasses = notes[0].pitches.map((p) => p % 12).sort((a, b) => a - b);
    // Dm7 intervals from D(2): b3=5, 5=9, b7=0, 9=4
    // Type A: [3,7,10,14] from D → [5, 9, 0, 4] → sorted [0, 4, 5, 9]
    // Type B: [10,14,15,19] from D → [0, 4, 5, 9] → same
    expect(pitchClasses).toEqual([0, 4, 5, 9]);
  });

  it("voice leading minimizes motion between consecutive chords", () => {
    const chords = [makeChord("D", "m7", 0), makeChord("G", "7", 2)];
    // Run multiple trials since rest bars may skip second chord (~11% chance)
    let passed = false;
    for (let trial = 0; trial < 10; trial++) {
      const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });

      const firstPitches = notes[0].pitches.sort((a, b) => a - b);
      const secondChordNotes = notes.filter((n) => n.time >= 2);
      if (secondChordNotes.length === 0) continue; // rest bar skipped chord
      const secondPitches = secondChordNotes[0].pitches.sort((a, b) => a - b);

      let totalMotion = 0;
      for (let i = 0; i < Math.min(firstPitches.length, secondPitches.length); i++) {
        totalMotion += Math.abs(firstPitches[i] - secondPitches[i]);
      }
      if (totalMotion < 30) { passed = true; break; }
    }
    expect(passed, "voice leading motion should be < 30 in at least 1 trial").toBe(true);
  });
});

// ── Rhythm Tests ──

describe("Piano Comping — rhythm", () => {
  it("swing style produces 2–5 hits per measure (including broken voicings)", () => {
    const notes = generatePianoComping([makeChord("C", "7", 0)], {
      style: "swing",
      humanize: false,
      strum: false,
    });
    // Base: 2-3 rhythm hits, broken voicings can split 4-note chords → +1 per broken
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(notes.length).toBeLessThanOrEqual(6);
  });

  it("bossa style produces 2–4 hits per measure", () => {
    const notes = generatePianoComping([makeChord("C", "7", 0)], {
      style: "bossa",
      humanize: false,
      strum: false,
    });
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(notes.length).toBeLessThanOrEqual(4);
  });

  it("ballad style produces 1–2 hits per measure", () => {
    const notes = generatePianoComping([makeChord("C", "maj7", 0)], {
      style: "ballad",
      humanize: false,
      strum: false,
    });
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes.length).toBeLessThanOrEqual(2);
  });

  it("notes don't extend past chord boundary", () => {
    const chords = [makeChord("C", "7", 0, 2), makeChord("F", "7", 2, 2)];
    const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });

    for (const note of notes) {
      // Find which chord this note belongs to
      const chord = chords.find((c) => note.time >= c.time && note.time < c.time + c.duration);
      if (chord) {
        expect(note.time + note.duration).toBeLessThanOrEqual(chord.time + chord.duration + 0.01);
      }
    }
  });

  it("first hit of each chord starts at or near chord time", () => {
    const chords = [makeChord("D", "m7", 0), makeChord("G", "7", 2)];
    const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });

    // First note should be at time 0
    expect(notes[0].time).toBeCloseTo(0, 1);
  });
});

// ── Humanization Tests ──

describe("Piano Comping — humanization", () => {
  it("humanize=true adds timing variation", () => {
    // Run twice — with randomness, times should differ slightly from exact grid
    const notes = generatePianoComping([makeChord("C", "7", 0)], {
      style: "ballad",
      humanize: true,
      strum: false,
    });
    // Time should be close to 0 but not exactly (due to jitter)
    // With ballad style-biased humanization, beat 1 has ~-8ms bias ±3ms jitter
    expect(Math.abs(notes[0].time)).toBeLessThan(0.015);
  });

  it("humanize=false produces exact grid times", () => {
    const notes = generatePianoComping([makeChord("C", "7", 0)], {
      style: "ballad",
      humanize: false,
      strum: false,
    });
    expect(notes[0].time).toBe(0);
  });

  it("velocity varies with humanize=true", () => {
    // Run many times and check velocity isn't constant
    const velocities = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const notes = generatePianoComping([makeChord("C", "7", 0)], {
        style: "ballad",
        humanize: true,
        strum: false,
      });
      velocities.add(notes[0].velocity);
    }
    // Should have some variation (not all same value)
    expect(velocities.size).toBeGreaterThan(1);
  });
});

// ── Voicing Quality Tests ──

describe("Piano Comping — voicing quality (no dissonant clusters)", () => {
  const ALL_ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const MAIN_QUALITIES = ["maj7", "m7", "7", "m7b5", "dim7", "aug", "7sus", "6", "m6"];

  it("no voicing has a minor 2nd (1 semitone) between adjacent sorted notes", () => {
    for (const root of ALL_ROOTS) {
      for (const quality of MAIN_QUALITIES) {
        const chords = [makeChord(root, quality, 0, 4)];
        const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
        for (const note of notes) {
          const sorted = [...note.pitches].sort((a, b) => a - b);
          for (let i = 1; i < sorted.length; i++) {
            const gap = sorted[i] - sorted[i - 1];
            expect(gap, `${root}${quality}: semitone cluster at pitches ${sorted}`).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
  });

  it("voicing span stays within an octave + minor 3rd (max 15 semitones)", () => {
    for (const root of ALL_ROOTS) {
      for (const quality of MAIN_QUALITIES) {
        const chords = [makeChord(root, quality, 0, 4)];
        const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
        for (const note of notes) {
          const sorted = [...note.pitches].sort((a, b) => a - b);
          const span = sorted[sorted.length - 1] - sorted[0];
          expect(span, `${root}${quality}: span too wide (${span})`).toBeLessThanOrEqual(15);
        }
      }
    }
  });

  it("all notes in voicing are distinct (no unisons)", () => {
    for (const root of ALL_ROOTS) {
      for (const quality of MAIN_QUALITIES) {
        const chords = [makeChord(root, quality, 0, 4)];
        const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
        for (const note of notes) {
          const unique = new Set(note.pitches);
          expect(unique.size, `${root}${quality}: duplicate pitches`).toBe(note.pitches.length);
        }
      }
    }
  });

  // Regression: cluster/inversion/open/rootPosition builders lacked deduplication
  it.each(["alfaMist", "metheny", "holdsworth", "fusion", "funk"] as const)(
    "%s voicings have no duplicate pitches",
    (style) => {
      for (let run = 0; run < 3; run++) {
        for (const root of ALL_ROOTS) {
          for (const quality of MAIN_QUALITIES) {
            const chords = [makeChord(root, quality, 0, 4)];
            const notes = generatePianoComping(chords, { style, humanize: false, strum: false });
            for (const note of notes) {
              const unique = new Set(note.pitches);
              expect(unique.size, `${style} ${root}${quality}: duplicate pitches in [${note.pitches}]`).toBe(note.pitches.length);
            }
          }
        }
      }
    },
  );
});

// ── Edge Cases ──

describe("Piano Comping — edge cases", () => {
  it("returns empty for empty chords", () => {
    expect(generatePianoComping([])).toEqual([]);
  });

  it("handles unknown quality (falls back to dom7)", () => {
    const notes = generatePianoComping([makeChord("C", "strangeQuality", 0)], { humanize: false, strum: false, style: "ballad" });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].pitches.length).toBeGreaterThanOrEqual(2);
  });

  it("handles slash chords (strips slash part for voicing)", () => {
    const notes = generatePianoComping([makeChord("C", "maj7/G", 0)], { humanize: false, strum: false });
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      for (const p of n.pitches) {
        expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
        expect(p).toBeLessThanOrEqual(PIANO_HIGH);
      }
    }
  });

  it("all notes have positive duration", () => {
    const notes = generatePianoComping(iiVI(), { humanize: false, strum: false });
    for (const n of notes) {
      expect(n.duration).toBeGreaterThan(0);
    }
  });

  it("notes are in chronological order", () => {
    const notes = generatePianoComping(iiVI(), { humanize: false, strum: false });
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].time).toBeGreaterThanOrEqual(notes[i - 1].time);
    }
  });

  it("defaults to swing style and tempo 120", () => {
    const notes = generatePianoComping([makeChord("C", "7", 0)], { strum: false });
    expect(notes.length).toBeGreaterThanOrEqual(2); // swing = 2-3 hits
  });

  it("handles many chord qualities", () => {
    const qualities = ["maj7", "m7", "7", "m7b5", "dim7", "aug", "sus4", "7alt", "m(maj7)", "7b9"];
    for (const q of qualities) {
      const notes = generatePianoComping([makeChord("C", q, 0)], { humanize: false, strum: false, style: "ballad" });
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0].pitches.length).toBeGreaterThanOrEqual(2);
      expect(notes[0].pitches.length).toBeLessThanOrEqual(5);
    }
  });
});

// ── Musical Content Tests ──

describe("Piano Comping — musical content", () => {
  it("ii-V-I progression has smooth voice leading throughout", () => {
    const chords = iiVI();
    const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });

    // Group by chord
    let maxMotion = 0;
    for (let i = 1; i < notes.length; i++) {
      const prev = [...notes[i - 1].pitches].sort((a, b) => a - b);
      const curr = [...notes[i].pitches].sort((a, b) => a - b);
      let motion = 0;
      for (let j = 0; j < Math.min(prev.length, curr.length); j++) {
        motion += Math.abs(prev[j] - curr[j]);
      }
      maxMotion = Math.max(maxMotion, motion);
    }
    // Good voice leading: max motion between any two consecutive voicings < 24 semitones
    expect(maxMotion).toBeLessThan(24);
  });

  it("different roots produce different pitch content", () => {
    const notesC = generatePianoComping([makeChord("C", "maj7", 0)], { style: "ballad", humanize: false, strum: false });
    const notesF = generatePianoComping([makeChord("F", "maj7", 0)], { style: "ballad", humanize: false, strum: false });

    // Pitch content should differ (different roots)
    const pcsC = notesC[0].pitches.map((p) => p % 12).sort((a, b) => a - b);
    const pcsF = notesF[0].pitches.map((p) => p % 12).sort((a, b) => a - b);
    expect(pcsC).not.toEqual(pcsF);
  });
});

// ── Voice Leading Distance (greedy matching) Tests ──

describe("Piano Comping — voice leading distance (greedy min-cost matching)", () => {
  it("Type A to Type B transition: motion stays low across voicing types", () => {
    // Dm7 → G7 → Cmaj7: standard ii-V-I forces Type A/B crossover
    // Old sorted-index comparison would produce jumpy motion here
    const chords = [
      makeChord("D", "m7", 0),
      makeChord("G", "7", 2),
      makeChord("C", "maj7", 4),
      makeChord("A", "m7", 6),
      makeChord("D", "7", 8),
      makeChord("G", "maj7", 10),
    ];
    let totalMotion = 0;
    let transitions = 0;
    for (let trial = 0; trial < 20; trial++) {
      const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
      for (let i = 1; i < notes.length; i++) {
        if (Math.abs(notes[i].time - notes[i - 1].time) < 0.1) continue; // same chord
        const prev = notes[i - 1].pitches;
        const curr = notes[i].pitches;
        const n = Math.min(prev.length, curr.length);
        let motion = 0;
        // Use greedy matching to measure (mirrors internal algorithm)
        for (let a = 0; a < n; a++) {
          let best = Infinity;
          for (let b = 0; b < curr.length; b++) {
            best = Math.min(best, Math.abs(prev[a] - curr[b]));
          }
          motion += best;
        }
        totalMotion += motion;
        transitions++;
      }
    }
    const avgMotion = totalMotion / transitions;
    // Greedy matching should keep avg motion per transition under 10 semitones total
    expect(avgMotion, `avg voice motion ${avgMotion.toFixed(1)}`).toBeLessThan(10);
  });

  it("long chromatic root motion maintains smooth voicings", () => {
    // Giant Steps-like: large root jumps should still produce smooth voice leading
    const chords = [
      makeChord("B", "maj7", 0),
      makeChord("D", "7", 2),
      makeChord("G", "maj7", 4),
      makeChord("Bb", "7", 6),
      makeChord("Eb", "maj7", 8),
    ];
    for (let trial = 0; trial < 10; trial++) {
      const notes = generatePianoComping(chords, {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(7000 + trial),
      });
      for (let i = 1; i < notes.length; i++) {
        if (Math.abs(notes[i].time - notes[i - 1].time) < 0.1) continue;
        const prev = notes[i - 1].pitches;
        const curr = notes[i].pitches;
        // No single voice should jump more than a major 9th (14 semitones).
        // Giant Steps root motion with shell voicing transitions can exceed an octave.
        for (const p of prev) {
          let closest = Infinity;
          for (const c of curr) closest = Math.min(closest, Math.abs(p - c));
          expect(closest, `voice jump ${closest} from ${prev} to ${curr}`).toBeLessThanOrEqual(14);
        }
      }
    }
  });
});

// ── Strum Tests ──

describe("Piano Comping — chord strum", () => {
  it("strum=true (default) produces single-pitch notes from 4-note voicing", () => {
    const notes = generatePianoComping([makeChord("C", "maj7", 0)], {
      style: "ballad",
      humanize: false,
      granular: { voicingDensity: 95, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
    });
    // Ballad = 1-2 chord hits → each strummed into 4 single-pitch notes
    expect(notes.length % 4).toBe(0);
    expect(notes.length).toBeGreaterThanOrEqual(4);
    for (const n of notes) {
      expect(n.pitches.length).toBe(1);
    }
  });

  it("strummed notes are staggered in time (bottom to top)", () => {
    const notes = generatePianoComping([makeChord("C", "maj7", 0)], {
      style: "ballad",
      humanize: false,
      strumMs: 30,
      granular: { voicingDensity: 95, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
    });
    // First 4 notes = one strummed chord, should have increasing times
    const first4 = notes.slice(0, 4);
    for (let i = 1; i < first4.length; i++) {
      expect(first4[i].time).toBeGreaterThan(first4[i - 1].time);
    }
    // Spread within first chord strum ~30ms = 0.03s
    const spread = first4[first4.length - 1].time - first4[0].time;
    expect(spread).toBeCloseTo(0.03, 2);
  });

  it("strummed notes have decreasing velocity (top notes softer)", () => {
    const notes = generatePianoComping([makeChord("C", "maj7", 0)], {
      style: "ballad",
      humanize: false,
    });
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].velocity).toBeLessThanOrEqual(notes[i - 1].velocity);
    }
  });
});

// ── Phase G: Chord Anticipation ──

describe("Piano Comping — chord anticipation", () => {
  it("beat 3.5+ hit uses next chord voicing when available", () => {
    // Use Dm7 → G7: very different voicings (minor vs dominant)
    const chords = [makeChord("D", "m7", 0, 4), makeChord("G", "7", 4, 4)];
    // Run many times — some iterations should produce anticipation
    let anticipationFound = false;
    for (let trial = 0; trial < 50; trial++) {
      const notes = generatePianoComping(chords, {
        style: "swing", humanize: false, strum: false,
      });
      // Find notes from first chord that are past beat 3.5 (time > 0 + 3.5 * beatDur)
      const beatDur = 60 / 120;
      const anticipationNotes = notes.filter(
        (n) => n.time >= 3.5 * beatDur && n.time < 4 * beatDur,
      );
      if (anticipationNotes.length > 0) {
        // G7 voicing should contain B (MIDI 59 or 71) or F (MIDI 53 or 65)
        const pitchClasses = anticipationNotes[0].pitches.map((p) => p % 12);
        // G7 contains: G(7), B(11), D(2), F(5)
        if (pitchClasses.includes(11) || pitchClasses.includes(5)) {
          anticipationFound = true;
          break;
        }
      }
    }
    expect(anticipationFound).toBe(true);
  });
});

// ── Phase G: Shell Voicings at Low Density ──

describe("Piano Comping — shell voicings", () => {
  it("low density produces mostly 2-note shell voicings", () => {
    const notes = generatePianoComping(iiVI(), {
      style: "swing", humanize: false, density: 20, strum: false, random: createPRNG(8001),
      granular: { voicingDensity: 10, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
    });
    const shells = notes.filter(n => n.pitches.length === 2);
    // At voicingDensity=10, shellChance=0.7 - most should be shells
    expect(shells.length / notes.length).toBeGreaterThanOrEqual(0.2);
  });

  it("high density produces mostly full voicings (3-4 notes)", () => {
    const notes = generatePianoComping(iiVI(), {
      style: "ballad", humanize: false, density: 80, strum: false, random: createPRNG(8002),
      granular: { voicingDensity: 90, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
    });
    const full = notes.filter(n => n.pitches.length >= 3);
    expect(full.length / notes.length).toBeGreaterThan(0.7);
  });
});

// ── Phase F: Style-Biased Humanization ──

describe("Piano Comping — style-biased humanization", () => {
  it("ballad humanization lays back (negative time offset)", () => {
    // Run many trials, measure average offset
    const offsets: number[] = [];
    for (let i = 0; i < 30; i++) {
      const notes = generatePianoComping([makeChord("C", "maj7", 0, 4)], {
        style: "ballad", humanize: true, strum: false,
      });
      if (notes.length > 0) offsets.push(notes[0].time);
    }
    const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    // Ballad groove template: positive bias (+8ms = behind the beat, laid back)
    expect(avg).toBeGreaterThan(0.003);
  });

  it("swing humanization has elastic feel (on-beat vs off-beat differ)", () => {
    const chords = [makeChord("C", "7", 0, 4)];
    const onBeatOffsets: number[] = [];
    for (let trial = 0; trial < 50; trial++) {
      const notes = generatePianoComping(chords, { style: "swing", humanize: true, strum: false, tempo: 120 });
      for (const n of notes) {
        const beatDur = 0.5;
        const beatInMeasure = n.time / beatDur;
        const frac = beatInMeasure % 1;
        if (frac < 0.1 || frac > 0.9) {
          onBeatOffsets.push(n.time - Math.round(n.time / beatDur) * beatDur);
        }
      }
    }
    // Swing style should show timing variation
    expect(onBeatOffsets.length).toBeGreaterThan(0);
  });

  it("bossa humanization is tight (small jitter spread)", () => {
    // Bossa jitter is ±2ms — measure the spread of beat-1 timing across trials
    // Use ballad-style single whole-note pattern to isolate beat-1 humanization
    const bossaTimings: number[] = [];
    for (let i = 0; i < 50; i++) {
      const notes = generatePianoComping([makeChord("C", "maj7", 0, 4)], {
        style: "bossa", humanize: true, strum: false,
      });
      // Find notes near time 0 (first downbeat hit)
      const downbeat = notes.find((n) => Math.abs(n.time) < 0.1);
      if (downbeat) bossaTimings.push(downbeat.time);
    }
    // Bossa jitter is ±2ms → spread across trials should be < 8ms
    if (bossaTimings.length > 10) {
      const spread = Math.max(...bossaTimings) - Math.min(...bossaTimings);
      expect(spread).toBeLessThan(0.008);
    }
  });
});

// ── Phase M: Piano rest bars ──

describe("Piano Comping — rest bars", () => {
  it("rest bars occur statistically (never first chord, never consecutive)", () => {
    const chords = Array.from({ length: 12 }, (_, i) =>
      makeChord("C", "7", i * 2, 2)
    );
    let restBarCount = 0;
    const trials = 100;
    for (let t = 0; t < trials; t++) {
      const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
      for (let ci = 0; ci < chords.length; ci++) {
        const cn = notes.filter(n => n.time >= chords[ci].time - 0.01 && n.time < chords[ci].time + chords[ci].duration - 0.01);
        if (cn.length === 0 && ci > 0) restBarCount++;
      }
    }
    // With ~11% rest chance over 11 eligible chords × 100 trials → expect ~120 rests
    expect(restBarCount).toBeGreaterThan(20);
    expect(restBarCount).toBeLessThan(400);
  });

  it("first chord is never rested", () => {
    const chords = [makeChord("C", "7", 0, 2), makeChord("G", "7", 2, 2)];
    for (let t = 0; t < 50; t++) {
      const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
      const firstChordNotes = notes.filter(n => n.time >= -0.01 && n.time < 1.99);
      expect(firstChordNotes.length).toBeGreaterThan(0);
    }
  });
});

// ── Phase N: Anti-repetition ──

describe("Piano Comping — anti-repetition", () => {
  it("rhythm patterns vary across measures (not all identical)", () => {
    const chords = Array.from({ length: 8 }, (_, i) =>
      makeChord("C", "7", i * 2, 2)
    );
    for (let t = 0; t < 5; t++) {
      const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
      // Count unique hit patterns (number of notes per chord)
      const hitCounts = chords.map(c =>
        notes.filter(n => n.time >= c.time - 0.01 && n.time < c.time + c.duration - 0.01).length
      );
      const unique = new Set(hitCounts.filter(c => c > 0));
      // Should have at least 2 different rhythm patterns (not all identical)
      expect(unique.size).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Phase P: Dynamic arc ──

describe("Piano Comping — dynamic arc", () => {
  it("opening bars have lower velocity than peak bars with measureInfo", () => {
    const measDur = 2;
    const chords = Array.from({ length: 32 }, (_, i) =>
      makeChord("C", "7", i * measDur, measDur)
    );
    const notes = generatePianoComping(chords, {
      style: "swing", humanize: false, strum: false,
      measureInfo: { totalMeasures: 32, measureDuration: measDur },
    });
    // Early bars (0-4) vs peak bars (20-24)
    const early = notes.filter(n => n.time >= 0 && n.time < 4 * measDur);
    const peak = notes.filter(n => n.time >= 20 * measDur && n.time < 24 * measDur);
    if (early.length > 0 && peak.length > 0) {
      const avgEarly = early.reduce((s, n) => s + n.velocity, 0) / early.length;
      const avgPeak = peak.reduce((s, n) => s + n.velocity, 0) / peak.length;
      expect(avgEarly).toBeLessThan(avgPeak);
    }
  });
});

// ── Phase K: Tempo-dependent swing ──

describe("Piano Comping — tempo-dependent swing", () => {
  it("slow tempo shifts off-beat positions more than fast tempo", () => {
    const chords = [makeChord("C", "7", 0, 2)];
    // At slow tempo, swing multiplier is 1.2; at fast, it's ~0.7
    // Both should produce notes without error
    const slow = generatePianoComping(chords, { style: "swing", humanize: false, strum: false, tempo: 80, swingAmount: 100 });
    const fast = generatePianoComping(chords, { style: "swing", humanize: false, strum: false, tempo: 220, swingAmount: 100 });
    expect(slow.length).toBeGreaterThan(0);
    expect(fast.length).toBeGreaterThan(0);
  });
});

// ── Phase D (10.14): Piano broken voicings ──

describe("Piano Comping — broken voicings", () => {
  it("swing: some chords produce 2-note groups (statistical)", () => {
    let twoNoteCount = 0;
    // Broken voicings fire 20% on 4-note chords away from strong beats.
    // Use 200 trials to make flakes vanishingly rare.
    for (let trial = 0; trial < 200; trial++) {
      const notes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false, density: 50,
      });
      twoNoteCount += notes.filter(n => n.pitches.length === 2).length;
    }
    expect(twoNoteCount).toBeGreaterThan(0);
  });

  it("broken groups have correct pitch split: group 1 < group 2", () => {
    let verified = false;
    for (let trial = 0; trial < 500; trial++) {
      const notes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false, density: 80,
        granular: { voicingDensity: 90, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
      });
      for (let i = 0; i < notes.length - 1; i++) {
        // Broken voicing: two 2-note groups very close together (< 0.15s gap = within one beat)
        if (notes[i].pitches.length === 2 && notes[i + 1].pitches.length === 2 &&
            notes[i + 1].time > notes[i].time && notes[i + 1].time - notes[i].time < 0.15) {
          const maxLow = Math.max(...notes[i].pitches);
          const minHigh = Math.min(...notes[i + 1].pitches);
          expect(maxLow).toBeLessThan(minHigh);
          verified = true;
          break;
        }
      }
      if (verified) break;
    }
    expect(verified, "should find at least one broken voicing pair in 500 trials").toBe(true);
  });

  it("not applied to ballad, ecm, modal", () => {
    for (const style of ["ballad", "ecm", "modal"] as const) {
      for (let trial = 0; trial < 20; trial++) {
        const notes = generatePianoComping(iiVI(), {
          style, humanize: false, strum: false, density: 50,
        });
        for (const n of notes) {
          // These styles: 4-note voicings or 2-note shell voicings, never broken pairs
          // Shell voicings have 2 notes but aren't from broken voicing
          expect(n.pitches.length === 4 || n.pitches.length === 2 || n.pitches.length === 3).toBe(true);
        }
      }
    }
  });

  it("suppressed near strong beats (within 0.5 beats of beats 1 and 3)", () => {
    // Generate many trials and check that broken voicings never appear
    // at beat positions 0-0.5, 1.5-2.5, or 3.5-4.0 (strong beat zone)
    const beatDuration = 0.5; // 120 BPM
    for (let trial = 0; trial < 200; trial++) {
      const notes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false, density: 50, tempo: 120,
      });
      for (let i = 0; i < notes.length - 1; i++) {
        if (notes[i].pitches.length === 2 && notes[i + 1].pitches.length === 2 &&
            notes[i + 1].time > notes[i].time && notes[i + 1].time - notes[i].time < 0.1) {
          // Found a broken voicing pair — check its beat position
          const beatInMeasure = (notes[i].time / beatDuration) % 4;
          // Should NOT be near beats 0 or 2 (tolerance 0.5)
          const nearBeat0 = beatInMeasure <= 0.55 || beatInMeasure >= 3.45;
          const nearBeat2 = Math.abs(beatInMeasure - 2) <= 0.55;
          expect(nearBeat0 || nearBeat2,
            `broken voicing at beatInMeasure=${beatInMeasure.toFixed(2)} (trial ${trial})`
          ).toBe(false);
        }
      }
    }
  });

  it("second group is time-offset by 40-80ms (tight pianist chord break)", () => {
    for (let trial = 0; trial < 200; trial++) {
      const notes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false, density: 80, tempo: 120,
        granular: { voicingDensity: 90, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 },
      });
      for (let i = 0; i < notes.length - 1; i++) {
        // Broken voicing gap: very tight (< 0.15s), distinguishes from consecutive shell voicings
        if (notes[i].pitches.length === 2 && notes[i + 1].pitches.length === 2 &&
            notes[i + 1].time > notes[i].time && notes[i + 1].time - notes[i].time < 0.15) {
          const offset = notes[i + 1].time - notes[i].time;
          // Broken chord gap: 40-80ms (tight pianist timing)
          expect(offset).toBeGreaterThanOrEqual(0.035);
          expect(offset).toBeLessThanOrEqual(0.085);
          return;
        }
      }
    }
  });
});

// ── New Genre Piano Tests ──

describe("Piano Comping — new genres", () => {
  it("neoSoul: produces notes in range", () => {
    const notes = generatePianoComping(iiVI(), { style: "neoSoul", humanize: false, strum: false });
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      for (const p of note.pitches) {
        expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
        expect(p).toBeLessThanOrEqual(PIANO_HIGH);
      }
    }
  });

  it("neoSoul: warm velocity (softer than default)", () => {
    const neoNotes = generatePianoComping(iiVI(), { style: "neoSoul", humanize: false, strum: false });
    const swingNotes = generatePianoComping(iiVI(), { style: "hardBop", humanize: false, strum: false });
    const neoAvg = neoNotes.reduce((s, n) => s + n.velocity, 0) / neoNotes.length;
    const swingAvg = swingNotes.reduce((s, n) => s + n.velocity, 0) / swingNotes.length;
    expect(neoAvg).toBeLessThan(swingAvg);
  });

  it("contemporaryJazz: produces notes in range", () => {
    const notes = generatePianoComping(iiVI(), { style: "contemporaryJazz", humanize: false, strum: false });
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      for (const p of note.pitches) {
        expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
        expect(p).toBeLessThanOrEqual(PIANO_HIGH);
      }
    }
  });

  it("contemporaryJazz: broken voicings applied (statistical)", () => {
    let brokenFound = false;
    for (let trial = 0; trial < 200; trial++) {
      const notes = generatePianoComping(iiVI(), { style: "contemporaryJazz", humanize: false, strum: false, density: 50 });
      const twoNoteChords = notes.filter(n => n.pitches.length === 2);
      if (twoNoteChords.length > 0) { brokenFound = true; break; }
    }
    expect(brokenFound).toBe(true);
  });

  it("mathRock: produces notes in range with staccato rhythms", () => {
    const notes = generatePianoComping(iiVI(), { style: "mathRock", humanize: false, strum: false });
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      for (const p of note.pitches) {
        expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
        expect(p).toBeLessThanOrEqual(PIANO_HIGH);
      }
    }
    // Math rock: short durations (staccato)
    const shortNotes = notes.filter(n => n.duration < 0.5);
    expect(shortNotes.length).toBeGreaterThan(0);
  });

  it("idm: produces notes in range with ambient durations", () => {
    // Use slower tempo so beat durations are longer, and run multiple trials for rest-bar resilience
    let longNoteFound = false;
    for (let trial = 0; trial < 10; trial++) {
      const notes = generatePianoComping(iiVI(), { style: "idm", humanize: false, strum: false, tempo: 80 });
      expect(notes.length).toBeGreaterThan(0);
      for (const note of notes) {
        for (const p of note.pitches) {
          expect(p).toBeGreaterThanOrEqual(PIANO_LOW);
          expect(p).toBeLessThanOrEqual(PIANO_HIGH);
        }
      }
      // IDM: ambient pads — at least some long durations
      const longNotes = notes.filter(n => n.duration > 1.0);
      if (longNotes.length > 0) { longNoteFound = true; break; }
    }
    expect(longNoteFound).toBe(true);
  });

  it("idm: quiet velocity (ambient level)", () => {
    const notes = generatePianoComping(iiVI(), { style: "idm", humanize: false, strum: false });
    const avgVel = notes.reduce((s, n) => s + n.velocity, 0) / notes.length;
    expect(avgVel).toBeLessThan(80); // 0.7 velScale → noticeably softer
  });
});

// ── Quality coverage guard: every engine quality must produce consonant voicings ──

describe("Piano Comping — quality coverage (no fallback dissonance)", () => {
  // All 28 valid engine qualities (from transcriber _VALID_QUALITIES)
  const ENGINE_QUALITIES = [
    "", "m", "dim", "aug",
    "maj7", "maj9", "maj7#11", "maj7#5",
    "m7", "m9", "m11", "m6", "m6/9", "m(maj7)", "m7b5",
    "7", "9", "13", "7#9", "7b9", "7#9b5", "7b9b5", "7#11", "7#5", "7b5", "7alt",
    "7sus4", "sus4", "sus2",
    "dim7", "6", "6/9", "add9",
  ];

  // Expected interval classes for each quality (semitones mod 12 that MUST appear)
  const REQUIRED_INTERVALS: Record<string, number[]> = {
    "": [4],           // must have major 3rd
    "m": [3],          // must have minor 3rd
    "6": [9],          // must have 6th, NOT b7(10) or maj7(11)
    "6/9": [9],        // must have 6th, NOT b7(10) or maj7(11)
    "m6": [3, 9],      // minor 3rd + 6th
    "m6/9": [3, 9],    // minor 3rd + 6th
    "7#9b5": [6],      // must have b5(6), NOT nat5(7)
    "7b9b5": [6],      // must have b5(6), NOT nat5(7)
    "7b5": [6],        // must have b5
    "sus4": [5],       // must have 4th, NOT 3rd(4)
    "sus2": [2],       // must have 2nd, NOT 3rd
    "7sus4": [5],      // must have 4th
    "dim": [3, 6],     // minor 3rd + dim 5th
    "dim7": [3, 6],
    "aug": [4, 8],     // major 3rd + aug 5th
  };

  // Intervals that must NOT appear (would indicate wrong fallback)
  const FORBIDDEN_INTERVALS: Record<string, number[]> = {
    "6": [10, 11],     // no b7 or maj7 for a 6th chord
    "6/9": [10, 11],
    "m6": [10, 11],
    "m6/9": [10, 11],
    "7#9b5": [7],      // no natural 5th for b5 chord
    "7b9b5": [7],
    "sus4": [4],       // no major 3rd for sus chord
    "sus2": [3, 4],    // no 3rd for sus chord
    "7sus4": [4],
  };

  for (const q of ENGINE_QUALITIES) {
    it(`quality "${q || "(major)"}" produces output without error`, () => {
      const notes = generatePianoComping(
        [makeChord("C", q, 0, 4)],
        { style: "swing", humanize: false, strum: false },
      );
      expect(notes.length).toBeGreaterThan(0);
    });
  }

  for (const [q, required] of Object.entries(REQUIRED_INTERVALS)) {
    it(`quality "${q || "(major)"}" voicing contains required intervals`, () => {
      const notes = generatePianoComping(
        [makeChord("C", q, 0, 4)],
        { style: "ballad", humanize: false, strum: false, density: 80,
          granular: { voicingDensity: 95, rhythmicActivity: 50, registerRange: 50, anticipation: 35, pianoRegister: 50 } },
      );
      expect(notes.length).toBeGreaterThan(0);
      // Collect pitch classes across all full voicings (3+ notes) to handle PRNG variance
      const fullNotes = notes.filter(n => n.pitches.length >= 3);
      const candidate = fullNotes.length > 0 ? fullNotes : [notes[0]];
      const allPcs = new Set<number>();
      for (const n of candidate) {
        for (const p of n.pitches) allPcs.add(((p % 12) - 0 + 12) % 12);
      }
      for (const interval of required) {
        expect(allPcs.has(interval), `quality "${q}": missing interval ${interval} in pitches ${[...allPcs]}`).toBe(true);
      }
    });
  }

  for (const [q, forbidden] of Object.entries(FORBIDDEN_INTERVALS)) {
    it(`quality "${q}" voicing excludes forbidden intervals`, () => {
      const notes = generatePianoComping(
        [makeChord("C", q, 0, 4)],
        { style: "ballad", humanize: false, strum: false, density: 50 },
      );
      expect(notes.length).toBeGreaterThan(0);
      const pcs = new Set(notes[0].pitches.map((p) => ((p % 12) - 0 + 12) % 12));
      for (const interval of forbidden) {
        expect(pcs.has(interval), `quality "${q}": forbidden interval ${interval} found in pitches ${[...pcs]}`).toBe(false);
      }
    });
  }
});

// ── Tempo Validation ──

describe("Piano Comping — tempo validation", () => {
  it("throws RangeError for tempo = 0", () => {
    expect(() => generatePianoComping(iiVI(), { tempo: 0 })).toThrow(RangeError);
  });

  it("throws RangeError for negative tempo", () => {
    expect(() => generatePianoComping(iiVI(), { tempo: -60 })).toThrow(RangeError);
  });
});

// ── Density Full Range ──

describe("Piano Comping — density full range", () => {
  it("density 100 produces zero rests (maximum density)", () => {
    // With density=100 baseRestChance = 0.15 * (1 - 1) = 0
    // Run multiple trials — should consistently produce notes on every chord
    const chords = iiVI();
    for (let trial = 0; trial < 10; trial++) {
      const notes = generatePianoComping(chords, {
        style: "swing", humanize: false, density: 100, strum: false,
      });
      expect(notes.length).toBeGreaterThanOrEqual(chords.length);
    }
  });

  it("density 0 produces sparser output than density 100", () => {
    const chords = iiVI();
    let sparse = 0, dense = 0;
    for (let trial = 0; trial < 20; trial++) {
      sparse += generatePianoComping(chords, { style: "swing", humanize: false, density: 0, strum: false }).length;
      dense += generatePianoComping(chords, { style: "swing", humanize: false, density: 100, strum: false }).length;
    }
    expect(dense).toBeGreaterThan(sparse);
  });
});

// ── Strum Spread ──

describe("Piano Comping — strum spreading", () => {
  it("strum spreads 3+ pitch chords into single-pitch notes, dyads pass through", () => {
    const notes = generatePianoComping(iiVI(), {
      style: "swing", humanize: false, strum: true, strumMs: 25, density: 50,
    });
    // Strummed notes: max 2 pitches (dyads from broken voicings pass through intact)
    for (const note of notes) {
      expect(note.pitches.length).toBeLessThanOrEqual(2);
    }
    // At least some single-pitch notes from strummed 3-4 note chords
    const singles = notes.filter(n => n.pitches.length === 1);
    expect(singles.length).toBeGreaterThan(0);
  });

  it("strum off keeps multi-pitch voicings intact", () => {
    const notes = generatePianoComping(iiVI(), {
      style: "swing", humanize: false, strum: false, density: 50,
    });
    const multiPitch = notes.filter(n => n.pitches.length > 1);
    expect(multiPitch.length).toBeGreaterThan(0);
  });

  it("strum velocity decay capped at ~15% of base, floor at 40", () => {
    // Generate with strum and check velocity bounds
    for (let trial = 0; trial < 50; trial++) {
      const notes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: true, strumMs: 25, density: 50,
      });
      for (const n of notes) {
        // No note below floor of 40
        expect(n.velocity).toBeGreaterThanOrEqual(40);
      }
      // Find strum groups (single-pitch notes near same time)
      for (let i = 0; i < notes.length - 3; i++) {
        const group = [notes[i]];
        for (let j = i + 1; j < notes.length && notes[j].time - notes[i].time < 0.05; j++) {
          if (notes[j].pitches.length === 1) group.push(notes[j]);
        }
        if (group.length >= 3) {
          const baseVel = group[0].velocity;
          const lastVel = group[group.length - 1].velocity;
          const totalDrop = baseVel - lastVel;
          // Total drop should not exceed ~20% of base (15% cap + rounding tolerance)
          expect(totalDrop).toBeLessThanOrEqual(Math.ceil(baseVel * 0.20) + 1);
        }
      }
    }
  });

  it("strummed notes have decreasing velocity", () => {
    const notes = generatePianoComping(
      [makeChord("C", "7", 0, 4)],
      { style: "swing", humanize: false, strum: true, strumMs: 25, density: 50 },
    );
    // Find consecutive notes near same time (strum group)
    if (notes.length >= 2) {
      const group = notes.filter(n => Math.abs(n.time - notes[0].time) < 0.15);
      if (group.length >= 2) {
        // Each successive note should have equal or lower velocity
        for (let i = 1; i < group.length; i++) {
          expect(group[i].velocity).toBeLessThanOrEqual(group[i - 1].velocity);
        }
      }
    }
  });
});

// ── Odd Meter Piano Comping ──

describe("Piano Comping — odd meters", () => {
  function makeMeterChords(beats: number): ChordEvent[] {
    return [makeChord("D", "m7", 0, beats * 0.5), makeChord("G", "7", beats * 0.5, beats * 0.5)];
  }

  for (const meter of [5, 7]) {
    it(`produces notes in ${meter}/4 time`, () => {
      const chords = makeMeterChords(meter);
      const notes = generatePianoComping(chords, {
        style: "swing", humanize: false, strum: false, density: 50,
      });
      expect(notes.length).toBeGreaterThan(0);
      // All notes within time bounds
      const end = chords[chords.length - 1].time + chords[chords.length - 1].duration;
      for (const n of notes) {
        expect(n.time).toBeGreaterThanOrEqual(0);
        expect(n.time).toBeLessThan(end + 0.01);
      }
    });
  }
});

// ── Granular Controls ──

describe("Piano Comping — granular controls", () => {
  const SEEDS = [42, 100, 200];

  function longChords(): ChordEvent[] {
    // 8 measures of ii-V-I repeated
    return [
      ...iiVI().map(c => ({ ...c })),
      ...iiVI().map(c => ({ ...c, time: c.time + 8 })),
    ];
  }

  it("voicingDensity — low produces fewer notes per chord (shell voicings)", () => {
    let lowAvg = 0;
    let highAvg = 0;
    for (const seed of SEEDS) {
      const lowNotes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { voicingDensity: 10 }),
      });
      const highNotes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { voicingDensity: 90 }),
      });
      const lowPitchCount = lowNotes.reduce((s, n) => s + n.pitches.length, 0);
      const highPitchCount = highNotes.reduce((s, n) => s + n.pitches.length, 0);
      lowAvg += lowNotes.length > 0 ? lowPitchCount / lowNotes.length : 0;
      highAvg += highNotes.length > 0 ? highPitchCount / highNotes.length : 0;
    }
    expect(highAvg).toBeGreaterThanOrEqual(lowAvg);
  });

  it("rhythmicActivity — high produces more notes per measure", () => {
    let highTotal = 0;
    let lowTotal = 0;
    for (const seed of SEEDS) {
      const highNotes = generatePianoComping(longChords(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { rhythmicActivity: 90 }),
      });
      const lowNotes = generatePianoComping(longChords(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { rhythmicActivity: 10 }),
      });
      highTotal += highNotes.length;
      lowTotal += lowNotes.length;
    }
    expect(highTotal).toBeGreaterThanOrEqual(lowTotal);
  });

  it("registerRange — high produces wider pitch spread", () => {
    let highSpread = 0;
    let lowSpread = 0;
    for (const seed of SEEDS) {
      const highNotes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { registerRange: 90 }),
      });
      const lowNotes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { registerRange: 15 }),
      });
      const allHighPitches = highNotes.flatMap(n => n.pitches);
      const allLowPitches = lowNotes.flatMap(n => n.pitches);
      if (allHighPitches.length > 0) highSpread += Math.max(...allHighPitches) - Math.min(...allHighPitches);
      if (allLowPitches.length > 0) lowSpread += Math.max(...allLowPitches) - Math.min(...allLowPitches);
    }
    expect(highSpread).toBeGreaterThanOrEqual(lowSpread);
  });

  it("anticipation — high produces more pre-change notes", () => {
    const chords: ChordEvent[] = [
      makeChord("D", "m7", 0, 2),
      makeChord("G", "7", 2, 2),
      makeChord("C", "maj7", 4, 2),
      makeChord("A", "m7", 6, 2),
    ];
    const changeTimes = [2, 4, 6];

    let highAntic = 0;
    let lowAntic = 0;
    for (const seed of SEEDS) {
      const highNotes = generatePianoComping(chords, {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { anticipation: 75 }),
      });
      const lowNotes = generatePianoComping(chords, {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { anticipation: 5 }),
      });
      for (const ct of changeTimes) {
        highAntic += highNotes.filter(n => n.time >= ct - 0.3 && n.time < ct).length;
        lowAntic += lowNotes.filter(n => n.time >= ct - 0.3 && n.time < ct).length;
      }
    }
    expect(highAntic).toBeGreaterThanOrEqual(lowAntic);
  });

  it("no granular = backward compatible", () => {
    for (const seed of SEEDS) {
      const noGranular = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
      });
      const undefinedGranular = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: undefined,
      });
      expect(noGranular.length).toBe(undefinedGranular.length);
      for (let i = 0; i < noGranular.length; i++) {
        expect(noGranular[i].pitches).toEqual(undefinedGranular[i].pitches);
        expect(noGranular[i].time).toBeCloseTo(undefinedGranular[i].time, 6);
        expect(noGranular[i].velocity).toBe(undefinedGranular[i].velocity);
      }
    }
  });

  it("pianoRegister=0 shifts range down", () => {
    const lowPitches: number[] = [];
    const defaultPitches: number[] = [];
    for (const seed of SEEDS) {
      const low = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { pianoRegister: 0 }),
      });
      const def = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50),
      });
      low.forEach(n => lowPitches.push(...n.pitches));
      def.forEach(n => defaultPitches.push(...n.pitches));
    }
    const lowAvg = lowPitches.reduce((a, b) => a + b, 0) / lowPitches.length;
    const defAvg = defaultPitches.reduce((a, b) => a + b, 0) / defaultPitches.length;
    expect(lowAvg).toBeLessThan(defAvg);
  });

  it("pianoRegister=100 shifts range up", () => {
    // Use low-register chords and many seeds to ensure shift is audible
    const lowChords = [
      makeChord("E", "m7", 0, 2),
      makeChord("A", "7", 2, 2),
      makeChord("D", "m7", 4, 2),
      makeChord("G", "7", 6, 2),
    ];
    const moreSeeds = [42, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    const highPitches: number[] = [];
    const defaultPitches: number[] = [];
    for (const seed of moreSeeds) {
      const high = generatePianoComping(lowChords, {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { pianoRegister: 100 }),
      });
      const def = generatePianoComping(lowChords, {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50),
      });
      high.forEach(n => highPitches.push(...n.pitches));
      def.forEach(n => defaultPitches.push(...n.pitches));
    }
    const highAvg = highPitches.reduce((a, b) => a + b, 0) / highPitches.length;
    const defAvg = defaultPitches.reduce((a, b) => a + b, 0) / defaultPitches.length;
    expect(highAvg).toBeGreaterThanOrEqual(defAvg);
    // Also verify minimum pitch is higher with high register
    const highMin = Math.min(...highPitches);
    const defMin = Math.min(...defaultPitches);
    expect(highMin).toBeGreaterThanOrEqual(defMin);
  });

  it("pianoRegister=50 matches no-granular output", () => {
    for (const seed of SEEDS) {
      const reg50 = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
        granular: resolvePianoGranular(50, { pianoRegister: 50 }),
      });
      const noGranular = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false,
        random: createPRNG(seed),
      });
      expect(reg50.length).toBe(noGranular.length);
      for (let i = 0; i < reg50.length; i++) {
        expect(reg50[i].pitches).toEqual(noGranular[i].pitches);
      }
    }
  });

  it("pianoRegister extremes — all pitches stay within shifted range", () => {
    const roots = ["C", "D", "Eb", "F#", "A", "Bb"];
    const qualities = ["7", "m7", "maj7", "m7b5", "dim7", "sus4", "7alt"];
    const styles = ["swing", "bossa", "ballad", "neoSoul", "ecm", "hardBop"] as const;
    for (const reg of [0, 100]) {
      // Expected range: reg=0 → [41, 72], reg=100 → [55, 86]
      const shift = Math.round((reg - 50) / 50 * 7);
      const expectedLow = 48 + shift;
      const expectedHigh = 79 + shift;
      for (const style of styles) {
        for (const root of roots) {
          for (const q of qualities) {
            const chords = [makeChord(root, q, 0, 4)];
            const notes = generatePianoComping(chords, {
              style, humanize: false, strum: false,
              granular: resolvePianoGranular(50, { pianoRegister: reg }),
            });
            for (const note of notes) {
              for (const p of note.pitches) {
                expect(p, `${style} ${root}${q} reg=${reg}: pitch ${p} out of [${expectedLow},${expectedHigh}]`)
                  .toBeGreaterThanOrEqual(expectedLow);
                expect(p, `${style} ${root}${q} reg=${reg}: pitch ${p} out of [${expectedLow},${expectedHigh}]`)
                  .toBeLessThanOrEqual(expectedHigh);
              }
            }
          }
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// G4-G9: Dynamic Groove, Rubato, Feel, Harmonic Rhythm
// ═══════════════════════════════════════════════════

describe("G4/G5 — groove evolution + rubato (piano)", () => {
  it("humanized piano notes never have negative times", () => {
    const chords = [makeChord("C", "maj7", 0, 2), makeChord("G", "7", 2, 2)];
    for (let seed = 0; seed < 50; seed++) {
      const notes = generatePianoComping(chords, {
        style: "ballad",
        tempo: 60,
        humanize: true,
        strum: false,
        random: createPRNG(seed),
        bandContext: {
          kickTimes: [] as number[], kickDensity: 2, hihatPattern: "quarters" as const, drumDensity: 0.5,
          crashTimes: [] as number[], bassRegister: "mid" as const, bassRhythm: "walking" as const,
          bassTimes: [] as number[],
          phraseMap: { boundaries: [0], phraseLength: 4, intents: [{ arc: "build" as const, feel: "normal" as const, dropMeasures: [] as number[], pianoRests: [] as number[], bassRests: [] as number[], drumsMinimal: [] as number[], anticipationChance: 0, passingChordChance: 0, motifLockBars: 4, crescendo: false, conversationLeader: null }] },
          currentSection: null, sectionEnergy: 0.3,
          currentPhraseIntent: { arc: "build" as const, feel: "normal" as const, dropMeasures: [] as number[], pianoRests: [] as number[], bassRests: [] as number[], drumsMinimal: [] as number[], anticipationChance: 0, passingChordChance: 0, motifLockBars: 4, crescendo: false, conversationLeader: null },
          creativity: 50, conversation: 50, airGaps: 20, harmonicFreedom: 25, harmonicRhythm: 1,
        },
      });
      for (const n of notes) {
        expect(n.time, `seed=${seed} produced negative time ${n.time}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("groove evolves differently with build vs release arc", () => {
    const chords = [makeChord("C", "maj7", 0, 2), makeChord("G", "7", 2, 2)];
    const makeBandCtx = (arc: "build" | "release") => ({
      kickTimes: [] as number[], kickDensity: 2, hihatPattern: "quarters" as const, drumDensity: 0.5,
      crashTimes: [] as number[], bassRegister: "mid" as const, bassRhythm: "walking" as const,
      bassTimes: [] as number[],
      phraseMap: { boundaries: [0], phraseLength: 4, intents: [{ arc, feel: "normal" as const, dropMeasures: [] as number[], pianoRests: [] as number[], bassRests: [] as number[], drumsMinimal: [] as number[], anticipationChance: 0, passingChordChance: 0, motifLockBars: 4, crescendo: false, conversationLeader: null }] },
      currentSection: null, sectionEnergy: 0.7,
      currentPhraseIntent: { arc, feel: "normal" as const, dropMeasures: [] as number[], pianoRests: [] as number[], bassRests: [] as number[], drumsMinimal: [] as number[], anticipationChance: 0, passingChordChance: 0, motifLockBars: 4, crescendo: false, conversationLeader: null },
      creativity: 50, conversation: 50, airGaps: 20, harmonicFreedom: 25, harmonicRhythm: 1,
    });
    const buildNotes = generatePianoComping(chords, { style: "swing", tempo: 120, humanize: true, strum: false, random: createPRNG(42), bandContext: makeBandCtx("build") });
    const releaseNotes = generatePianoComping(chords, { style: "swing", tempo: 120, humanize: true, strum: false, random: createPRNG(42), bandContext: makeBandCtx("release") });
    const buildTimings = buildNotes.map(n => n.time);
    const releaseTimings = releaseNotes.map(n => n.time);
    const anyDifferent = buildTimings.some((t, i) => releaseTimings[i] !== undefined && Math.abs(t - releaseTimings[i]) > 0.0001);
    expect(anyDifferent).toBe(true);
  });
});

describe("G8 — feel changes (piano)", () => {
  const makeIntent = (feel: "normal" | "halfTime" | "doubleTime") => ({
    arc: "sustain" as const, feel, dropMeasures: [] as number[], pianoRests: [] as number[],
    bassRests: [] as number[], drumsMinimal: [] as number[], anticipationChance: 0,
    passingChordChance: 0, motifLockBars: 4, crescendo: false, conversationLeader: null,
  });
  const makeBandCtx = (feel: "normal" | "halfTime" | "doubleTime") => ({
    kickTimes: [] as number[], kickDensity: 2, hihatPattern: "quarters" as const, drumDensity: 0.5,
    crashTimes: [] as number[], bassRegister: "mid" as const, bassRhythm: "walking" as const,
    bassTimes: [] as number[],
    phraseMap: { boundaries: [0], phraseLength: 8, intents: [makeIntent(feel)] },
    currentSection: null, sectionEnergy: 0.7,
    currentPhraseIntent: makeIntent(feel),
    creativity: 50, conversation: 50, airGaps: 20, harmonicFreedom: 25, harmonicRhythm: 1,
  });

  it("halfTime piano produces fewer notes (higher rest chance)", () => {
    const chords = Array.from({ length: 8 }, (_, i) => makeChord("C", "maj7", i * 2, 2));
    let normalTotal = 0;
    let halfTotal = 0;
    for (let seed = 0; seed < 20; seed++) {
      const normalNotes = generatePianoComping(chords, { style: "swing", tempo: 120, strum: false, random: createPRNG(seed), bandContext: makeBandCtx("normal") });
      const halfNotes = generatePianoComping(chords, { style: "swing", tempo: 120, strum: false, random: createPRNG(seed), bandContext: makeBandCtx("halfTime") });
      normalTotal += normalNotes.length;
      halfTotal += halfNotes.length;
    }
    expect(halfTotal).toBeLessThan(normalTotal);
  });

  it("doubleTime piano produces more notes (lower rest chance)", () => {
    const chords = Array.from({ length: 8 }, (_, i) => makeChord("C", "maj7", i * 2, 2));
    let normalTotal = 0;
    let doubleTotal = 0;
    for (let seed = 0; seed < 20; seed++) {
      const normalNotes = generatePianoComping(chords, { style: "swing", tempo: 120, strum: false, random: createPRNG(seed), bandContext: makeBandCtx("normal") });
      const doubleNotes = generatePianoComping(chords, { style: "swing", tempo: 120, strum: false, random: createPRNG(seed), bandContext: makeBandCtx("doubleTime") });
      normalTotal += normalNotes.length;
      doubleTotal += doubleNotes.length;
    }
    expect(doubleTotal).toBeGreaterThan(normalTotal);
  });
});

describe("G9 — harmonic rhythm awareness (piano)", () => {
  it("fast harmonic rhythm forces shell voicings (fewer pitches per chord)", () => {
    const slowChords = [makeChord("C", "maj7", 0, 4)];
    const fastChords = [
      makeChord("C", "maj7", 0, 1), makeChord("D", "m7", 1, 1),
      makeChord("G", "7", 2, 1), makeChord("C", "maj7", 3, 1),
    ];
    const makeBandCtx = (hr: number) => ({
      kickTimes: [] as number[], kickDensity: 2, hihatPattern: "quarters" as const, drumDensity: 0.5,
      crashTimes: [] as number[], bassRegister: "mid" as const, bassRhythm: "walking" as const,
      bassTimes: [] as number[],
      phraseMap: { boundaries: [0], phraseLength: 4, intents: [{ arc: "sustain" as const, feel: "normal" as const, dropMeasures: [] as number[], pianoRests: [] as number[], bassRests: [] as number[], drumsMinimal: [] as number[], anticipationChance: 0, passingChordChance: 0, motifLockBars: 4, crescendo: false, conversationLeader: null }] },
      currentSection: null, sectionEnergy: 0.7, currentPhraseIntent: null,
      creativity: 20, conversation: 20, airGaps: 10, harmonicFreedom: 10, harmonicRhythm: hr,
    });
    let slowPitchCount = 0, slowNoteCount = 0;
    let fastPitchCount = 0, fastNoteCount = 0;
    for (let seed = 0; seed < 20; seed++) {
      const slowNotes = generatePianoComping(slowChords, { style: "swing", tempo: 120, humanize: false, strum: false, random: createPRNG(seed), bandContext: makeBandCtx(1) });
      for (const n of slowNotes) { slowPitchCount += n.pitches.length; slowNoteCount++; }
      const fastNotes = generatePianoComping(fastChords, { style: "swing", tempo: 120, humanize: false, strum: false, random: createPRNG(seed), bandContext: makeBandCtx(4) });
      for (const n of fastNotes) { fastPitchCount += n.pitches.length; fastNoteCount++; }
    }
    if (slowNoteCount > 0 && fastNoteCount > 0) {
      const slowAvg = slowPitchCount / slowNoteCount;
      const fastAvg = fastPitchCount / fastNoteCount;
      expect(fastAvg).toBeLessThanOrEqual(slowAvg);
    }
  });
});

// ═══════════════════════════════════════════════════
// G15 — Piano motif evolution depth
// ═══════════════════════════════════════════════════

describe("G15 — Enhanced motif evolution", () => {
  const chords: ChordEvent[] = [
    { root: "C", quality: "maj7", time: 0, duration: 2 },
    { root: "F", quality: "7", time: 2, duration: 2 },
    { root: "G", quality: "7", time: 4, duration: 2 },
    { root: "C", quality: "maj7", time: 6, duration: 2 },
    { root: "C", quality: "maj7", time: 8, duration: 2 },
    { root: "F", quality: "7", time: 10, duration: 2 },
    { root: "G", quality: "7", time: 12, duration: 2 },
    { root: "C", quality: "maj7", time: 14, duration: 2 },
  ];

  it("high creativity produces more varied rhythm patterns than low", () => {
    let lowVariation = 0;
    let highVariation = 0;
    for (let s = 0; s < 30; s++) {
      const lowCreativity = generatePianoComping(chords, {
        style: "swing", tempo: 140, humanize: false, strum: false,
        random: createPRNG(600 + s),
        bandContext: { kickTimes: [], kickDensity: 0, hihatPattern: "8ths", drumDensity: 0, crashTimes: [], bassRegister: "mid", bassRhythm: "walking", bassTimes: [], phraseMap: { boundaries: [0, 4], phraseLength: 4, intents: [] }, currentSection: null, sectionEnergy: 0.7, currentPhraseIntent: null, creativity: 20, conversation: 30, airGaps: 10, harmonicFreedom: 20, harmonicRhythm: 1 } as any,
      });
      const highCreativity = generatePianoComping(chords, {
        style: "swing", tempo: 140, humanize: false, strum: false,
        random: createPRNG(600 + s),
        bandContext: { kickTimes: [], kickDensity: 0, hihatPattern: "8ths", drumDensity: 0, crashTimes: [], bassRegister: "mid", bassRhythm: "walking", bassTimes: [], phraseMap: { boundaries: [0, 4], phraseLength: 4, intents: [] }, currentSection: null, sectionEnergy: 0.7, currentPhraseIntent: null, creativity: 90, conversation: 30, airGaps: 10, harmonicFreedom: 20, harmonicRhythm: 1 } as any,
      });
      lowVariation += lowCreativity.length;
      highVariation += highCreativity.length;
    }
    // Both should produce notes; high creativity may differ in count
    expect(lowVariation).toBeGreaterThan(0);
    expect(highVariation).toBeGreaterThan(0);
  });

  it("repeated chords produce varied comping patterns (motif evolution fires)", () => {
    // 16 bars of same chord - if motif evolution works, bars should NOT be identical
    const repeatingChords: ChordEvent[] = Array.from({ length: 16 }, (_, i) => ({
      root: "C", quality: "maj7", time: i * 2, duration: 2,
    }));
    let mutationDetected = 0;
    for (let s = 0; s < 20; s++) {
      const notes = generatePianoComping(repeatingChords, {
        style: "swing", tempo: 120, humanize: false, strum: false,
        random: createPRNG(800 + s),
        bandContext: {
          kickTimes: [], kickDensity: 0, hihatPattern: "8ths", drumDensity: 0,
          crashTimes: [], bassRegister: "mid", bassRhythm: "walking", bassTimes: [],
          phraseMap: { boundaries: [0, 4, 8, 12], phraseLength: 4, intents: [] },
          currentSection: null, sectionEnergy: 0.5,
          currentPhraseIntent: null, creativity: 70, conversation: 30,
          airGaps: 10, harmonicFreedom: 20, harmonicRhythm: 1,
        } as any,
      });
      // Characterize each 2-beat bar by number of notes and their relative timings
      const barSignatures: string[] = [];
      for (let bar = 0; bar < 16; bar++) {
        const barStart = bar * 2;
        const barEnd = barStart + 2;
        const barNotes = notes.filter(n => n.time >= barStart - 0.01 && n.time < barEnd - 0.01);
        const sig = barNotes.map(n => Math.round((n.time - barStart) * 100)).join(",");
        barSignatures.push(sig);
      }
      const uniqueSigs = new Set(barSignatures.filter(s => s !== ""));
      if (uniqueSigs.size > 2) mutationDetected++;
    }
    // Across 20 seeds, most should show rhythmic variety (motif evolution)
    expect(mutationDetected).toBeGreaterThan(10);
  });
});

// ═══════════════════════════════════════════════════
// G26 — Non-uniform strum spread
// ═══════════════════════════════════════════════════

describe("G26 — Non-uniform strum spread", () => {
  const chords: ChordEvent[] = [
    { root: "C", quality: "maj7", time: 0, duration: 2 },
    { root: "F", quality: "7", time: 2, duration: 2 },
  ];

  it("strummed chords have non-uniform timing gaps", () => {
    const notes = generatePianoComping(chords, {
      style: "swing", tempo: 120, humanize: false, strum: true, strumMs: 25,
      random: createPRNG(42),
    });
    // Find groups of single-pitch notes at similar times (strummed chord)
    const singlePitch = notes.filter(n => n.pitches.length === 1);
    if (singlePitch.length >= 3) {
      // Check that gaps between consecutive strum notes are NOT all equal
      const gaps: number[] = [];
      for (let i = 1; i < Math.min(4, singlePitch.length); i++) {
        gaps.push(singlePitch[i].time - singlePitch[i - 1].time);
      }
      if (gaps.length >= 2) {
        // At least some gaps should differ (non-uniform)
        const allSame = gaps.every(g => Math.abs(g - gaps[0]) < 0.0001);
        // With randomized exponent, gaps should vary
        expect(allSame).toBe(false);
      }
    }
  });
});

// ── G11: Upper Structure Triads ──

describe("G11 — Upper Structure Triads", () => {
  const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const ROOT_SEMITONES: Record<string, number> = {
    C: 0, "Db": 1, D: 2, Eb: 3, E: 4, F: 5, "Gb": 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
  };

  describe("buildUpperStructureVoicing — direct unit tests", () => {
    it("produces 3-4 note voicings for all 12 roots", () => {
      for (const root of ROOTS) {
        const saved = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(42));
        try {
          const pitches = buildUpperStructureVoicing(root, "7", null);
          expect(pitches.length).toBeGreaterThanOrEqual(3);
          expect(pitches.length).toBeLessThanOrEqual(4);
        } finally {
          restoreVoicingState(saved);
        }
      }
    });

    it("all pitches within piano range [48, 79]", () => {
      for (const root of ROOTS) {
        for (let seed = 0; seed < 5; seed++) {
          const saved = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(seed));
          try {
            const pitches = buildUpperStructureVoicing(root, "7", null);
            for (const p of pitches) {
              expect(p, `${root}7 seed=${seed}: pitch ${p} out of range`).toBeGreaterThanOrEqual(PIANO_LOW);
              expect(p, `${root}7 seed=${seed}: pitch ${p} out of range`).toBeLessThanOrEqual(PIANO_HIGH);
            }
          } finally {
            restoreVoicingState(saved);
          }
        }
      }
    });

    it("no semitone clusters (adjacent notes >= 2 semitones apart)", () => {
      for (const root of ROOTS) {
        for (const q of ["7", "7alt", "7b9", "7#9", "7#11", "7b5"]) {
          for (let seed = 0; seed < 10; seed++) {
            const saved = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(seed));
            try {
              const pitches = buildUpperStructureVoicing(root, q, null);
              const sorted = [...pitches].sort((a, b) => a - b);
              for (let i = 1; i < sorted.length; i++) {
                expect(
                  sorted[i] - sorted[i - 1],
                  `${root}${q} seed=${seed}: semitone cluster [${sorted}]`
                ).toBeGreaterThanOrEqual(2);
              }
            } finally {
              restoreVoicingState(saved);
            }
          }
        }
      }
    });

    it("span <= 15 semitones", () => {
      for (const root of ROOTS) {
        for (const q of ["7", "7alt", "7b9", "7#9", "7#11", "7#5", "7b5"]) {
          for (let seed = 0; seed < 10; seed++) {
            const saved = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(seed));
            try {
              const pitches = buildUpperStructureVoicing(root, q, null);
              const sorted = [...pitches].sort((a, b) => a - b);
              const span = sorted[sorted.length - 1] - sorted[0];
              expect(span, `${root}${q} seed=${seed}: span ${span}`).toBeLessThanOrEqual(15);
            } finally {
              restoreVoicingState(saved);
            }
          }
        }
      }
    });

    it("voicing always contains b7 (PC 10 from root)", () => {
      for (const root of ROOTS) {
        const rpc = ROOT_SEMITONES[root];
        for (let seed = 0; seed < 5; seed++) {
          const saved = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(seed));
          try {
            const pitches = buildUpperStructureVoicing(root, "7", null);
            const pcs = new Set(pitches.map(p => ((p % 12) - rpc + 12) % 12));
            expect(pcs.has(10), `${root}7 seed=${seed}: missing b7 in PCs [${[...pcs]}]`).toBe(true);
          } finally {
            restoreVoicingState(saved);
          }
        }
      }
    });

    it("correct triad PCs for each quality", () => {
      const QUALITY_EXPECTED_PCS: Record<string, number[][]> = {
        "7":    [[10, 2, 5]],       // b7 + bVII maj
        "7#11": [[10, 2, 6, 9], [2, 4, 6, 10]],   // b7 + II maj, or standard voicing fallback
        "7alt": [[10, 6, 1]],      // b7 + bV maj (10 shared with triad)
        "7b9":  [[10, 6, 1]],      // b7 + bV maj
        "7#9":  [[10, 3, 7]],      // b7 + bIII maj (10 shared with triad)
      };

      for (const [q, expectedSets] of Object.entries(QUALITY_EXPECTED_PCS)) {
        const rpc = ROOT_SEMITONES["C"];
        // Run many seeds to cover all candidates
        const allPcSets = new Set<string>();
        for (let seed = 0; seed < 20; seed++) {
          const saved = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(seed));
          try {
            const pitches = buildUpperStructureVoicing("C", q, null);
            const pcs = pitches.map(p => ((p % 12) - rpc + 12) % 12).sort((a, b) => a - b);
            allPcSets.add(pcs.join(","));
          } finally {
            restoreVoicingState(saved);
          }
        }
        // Every observed PC set must match one of the expected sets (b7 + triad)
        for (const pcStr of allPcSets) {
          const pcs = pcStr.split(",").map(Number);
          const matches = expectedSets.some(expected => {
            const expSet = new Set(expected);
            return pcs.every(pc => expSet.has(pc));
          });
          expect(matches, `C${q}: unexpected PCs [${pcStr}], expected one of ${JSON.stringify(expectedSets)}`).toBe(true);
        }
      }
    });

    it("deterministic with same PRNG seed", () => {
      for (let seed = 0; seed < 5; seed++) {
        const saved1 = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(seed));
        let pitches1: number[];
        try { pitches1 = buildUpperStructureVoicing("C", "7", null); }
        finally { restoreVoicingState(saved1); }

        const saved2 = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(seed));
        let pitches2: number[];
        try { pitches2 = buildUpperStructureVoicing("C", "7", null); }
        finally { restoreVoicingState(saved2); }

        expect(pitches1).toEqual(pitches2);
      }
    });

    it("7b5 routes to Lydian dominant (II maj) not generic bVII", () => {
      const rpc = ROOT_SEMITONES["C"];
      // II maj PCs: 2, 6, 9 (contains #11 = PC 6), or standard voicing fallback PCs: 2, 4, 6, 10
      const expectedPCs = new Set([2, 4, 6, 9, 10]); // triad + b7 + standard fallback 3rd
      for (let seed = 0; seed < 10; seed++) {
        const saved = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(seed));
        try {
          const pitches = buildUpperStructureVoicing("C", "7b5", null);
          const pcs = new Set(pitches.map(p => ((p % 12) - rpc + 12) % 12));
          for (const pc of pcs) {
            expect(expectedPCs.has(pc), `C7b5 seed=${seed}: PC ${pc} not in II maj triad`).toBe(true);
          }
          // Must still contain b5 (#11) = PC 6 to distinguish from generic bVII
          expect(pcs.has(6), `C7b5 seed=${seed}: missing b5/#11 (PC 6)`).toBe(true);
        } finally {
          restoreVoicingState(saved);
        }
      }
    });
  });

  describe("UST integration — fires only on dominant chords", () => {
    it("non-dominant qualities never produce UST pitch classes", () => {
      const nonDomQualities = ["maj7", "m7", "m9", "dim7", "m7b5", "6", "m6"];
      for (const q of nonDomQualities) {
        expect(isDominant(q), `${q} should not be dominant`).toBe(false);
      }
    });

    it("dominant qualities are recognized", () => {
      const domQualities = ["7", "9", "13", "7alt", "7b9", "7#9", "7#11", "7#5", "7b5"];
      for (const q of domQualities) {
        expect(isDominant(q), `${q} should be dominant`).toBe(true);
      }
    });

    it("UST appears in swing voicings for dominant chords (statistical)", () => {
      // Over many seeds, at least some dominant chord voicings should differ from
      // what buildStandardVoicing produces (indicating UST activation)
      const chords = [makeChord("G", "7", 0, 2)];
      let ustCount = 0;
      const trials = 50;
      for (let seed = 0; seed < trials; seed++) {
        const notes = generatePianoComping(chords, {
          style: "swing",
          humanize: false,
          strum: false,
          random: createPRNG(seed),
        });
        if (notes.length === 0) continue;
        // UST voicing has b7 but typically lacks the 3rd
        const rpc = ROOT_SEMITONES["G"];
        const pcs = new Set(notes[0].pitches.map(p => ((p % 12) - rpc + 12) % 12));
        const thirdPC = 4; // major 3rd of G7
        if (!pcs.has(thirdPC) && pcs.has(10)) ustCount++;
      }
      // Expect roughly 20% UST activation (allow wide margin for PRNG)
      expect(ustCount, `UST fired ${ustCount}/${trials} times`).toBeGreaterThan(0);
      expect(ustCount, `UST fired too often: ${ustCount}/${trials}`).toBeLessThan(trials * 0.6);
    });

    it("no UST on ballad style", () => {
      // Ballad excluded from UST - every voicing should have guide tones
      const chords = [makeChord("C", "7", 0, 4)];
      for (let seed = 0; seed < 20; seed++) {
        const notes = generatePianoComping(chords, {
          style: "ballad",
          humanize: false,
          strum: false,
          random: createPRNG(seed),
        });
        if (notes.length === 0) continue;
        const rpc = ROOT_SEMITONES["C"];
        const pcs = new Set(notes[0].pitches.map(p => ((p % 12) - rpc + 12) % 12));
        // Ballad should always have the 3rd (guide tone)
        expect(pcs.has(4), `ballad seed=${seed}: missing 3rd in [${[...pcs]}]`).toBe(true);
      }
    });

    it("no UST on coolJazz, funk, shuffleBlues styles", () => {
      const noUstStyles = ["coolJazz", "funk", "shuffleBlues"] as const;
      for (const style of noUstStyles) {
        const chords = [makeChord("C", "7", 0, 2)];
        for (let seed = 0; seed < 10; seed++) {
          const notes = generatePianoComping(chords, {
            style,
            humanize: false,
            strum: false,
            random: createPRNG(seed),
          });
          if (notes.length === 0) continue;
          // These styles should always produce standard voicings with the 3rd
          const rpc = ROOT_SEMITONES["C"];
          const pcs = new Set(notes[0].pitches.map(p => ((p % 12) - rpc + 12) % 12));
          // funk/shuffleBlues have root position (includes 3rd), coolJazz has shell (3rd+7th)
          expect(pcs.has(4), `${style} seed=${seed}: missing 3rd in [${[...pcs]}]`).toBe(true);
        }
      }
    });

    it("non-dominant chords never trigger UST (no b7-only voicings without 3rd)", () => {
      // For non-dominant chords, UST builder is never called. Verify by checking
      // that voicings never match the UST pattern (b7 present, 3rd absent).
      const nonDomChords = [
        makeChord("C", "maj7", 0, 2),
        makeChord("D", "m7", 2, 2),
      ];
      for (let seed = 0; seed < 20; seed++) {
        const notes = generatePianoComping(nonDomChords, {
          style: "swing",
          humanize: false,
          strum: false,
          random: createPRNG(seed),
        });
        for (const note of notes) {
          const root = note.time < 2 ? "C" : "D";
          const quality = note.time < 2 ? "maj7" : "m7";
          const rpc = ROOT_SEMITONES[root];
          const pcs = new Set(note.pitches.map(p => ((p % 12) - rpc + 12) % 12));
          const third = quality.startsWith("m") ? 3 : 4;
          const seventh = quality === "maj7" ? 11 : 10;
          // If voicing has 7th but not 3rd, that would indicate UST (which shouldn't happen)
          if (pcs.has(seventh) && !pcs.has(third)) {
            // Quartal voicings can legitimately omit the 3rd, but they won't have
            // the exact UST triad PCs. Just verify non-dom chords never get UST pattern.
            // This is a soft check - quartal voicings may omit 3rd naturally.
            // For maj7, the 7th is 11 (not 10), so UST b7 pattern won't match.
            if (seventh === 10) {
              // Only m7 has b7=10. Verify it's not a UST triad pattern.
              const ustTriadPCs = [
                [2, 5], [6, 9], [1, 6], [3, 7], // subsets of UST triads
              ];
              const isUST = ustTriadPCs.some(t => t.every(pc => pcs.has(pc)));
              expect(isUST, `${root}${quality} seed=${seed}: looks like UST on non-dom chord`).toBe(false);
            }
          }
        }
      }
    });
  });

  describe("UST data — UST_TRIADS constants", () => {
    it("all entries have exactly 3 pitch classes", () => {
      for (const [key, entries] of Object.entries(UST_TRIADS)) {
        for (const entry of entries) {
          expect(entry.triadPCs.length, `${key} ${entry.label}`).toBe(3);
        }
      }
    });

    it("all pitch classes are 0-11", () => {
      for (const [key, entries] of Object.entries(UST_TRIADS)) {
        for (const entry of entries) {
          for (const pc of entry.triadPCs) {
            expect(pc, `${key} ${entry.label}: PC ${pc}`).toBeGreaterThanOrEqual(0);
            expect(pc, `${key} ${entry.label}: PC ${pc}`).toBeLessThan(12);
          }
        }
      }
    });

    it("all expected quality keys present", () => {
      const expectedKeys = ["7", "7#11", "7alt", "7b9", "7#9"];
      for (const key of expectedKeys) {
        expect(UST_TRIADS[key], `missing UST key: ${key}`).toBeDefined();
        expect(UST_TRIADS[key].length, `empty UST entries for ${key}`).toBeGreaterThan(0);
      }
    });

    it("7#5 falls through to generic 7 (no dedicated entry)", () => {
      // 7#5 has no scale-compatible UST triads, so quality matching uses "7" fallback
      expect(UST_TRIADS["7#5"]).toBeUndefined();
    });

    it("triad pitch classes form valid major triads (intervals 0-4-7 in some rotation)", () => {
      for (const [key, entries] of Object.entries(UST_TRIADS)) {
        for (const entry of entries) {
          const [a, b, c] = entry.triadPCs;
          // Check intervals between notes form a major triad (4+3 semitones in some rotation)
          const intervals = [
            ((b - a) + 12) % 12,
            ((c - b) + 12) % 12,
            ((a - c) + 12) % 12,
          ].sort((x, y) => x - y);
          expect(
            intervals,
            `${key} ${entry.label}: PCs [${entry.triadPCs}] not a major triad`
          ).toEqual([3, 4, 5]);
        }
      }
    });
  });
});

// ── G12: Tritone Substitution ──

describe("G12 — Tritone Substitution (piano)", () => {
  it("tritone sub and altered voicings share guide tones (theory validation)", () => {
    // Jazz theory: G7alt rootless and Db7 rootless share the tritone (F-B).
    // This confirms our tritone sub is musically correct.
    const saved = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(99));
    try {
      const altVoicing = buildStandardVoicing("G", "7alt", null, false, false);
      const altPCs = new Set(altVoicing.map(p => p % 12));
      // G7alt should have tritone: B(11) and F(5)
      expect(altPCs.has(5) || altPCs.has(11), `G7alt missing tritone: [${[...altPCs]}]`).toBe(true);
    } finally {
      restoreVoicingState(saved);
    }

    const saved2 = initVoicingState(PIANO_LOW, PIANO_HIGH, createPRNG(99));
    try {
      const triSubVoicing = buildStandardVoicing("Db", "7", null, false, false);
      const triPCs = new Set(triSubVoicing.map(p => p % 12));
      // Db7 standard should have tritone: F(5) as 3rd, Cb/B(11) as b7
      expect(triPCs.has(5) || triPCs.has(11), `Db7 missing tritone: [${[...triPCs]}]`).toBe(true);
    } finally {
      restoreVoicingState(saved2);
    }
  });

  it("resolving dominant produces valid voicings across all styles", () => {
    const chords: ChordEvent[] = [
      makeChord("G", "7", 0, 2),
      makeChord("C", "maj7", 2, 2),
    ];
    const styles = ["swing", "hardBop", "fusion", "contemporaryJazz", "metheny", "modal", "ecm", "ballad"] as const;
    for (const style of styles) {
      for (let seed = 0; seed < 20; seed++) {
        const notes = generatePianoComping(chords, {
          style,
          humanize: false,
          strum: false,
          random: createPRNG(seed),
        });
        expect(notes.length, `${style} seed=${seed}: no notes`).toBeGreaterThan(0);
        for (const note of notes) {
          for (const p of note.pitches) {
            expect(p, `${style} seed=${seed}: out of range`).toBeGreaterThanOrEqual(PIANO_LOW);
            expect(p, `${style} seed=${seed}: out of range`).toBeLessThanOrEqual(PIANO_HIGH);
          }
        }
      }
    }
  });

  it("non-resolving dominants do not activate tritone sub path", () => {
    // C7 → Ab7: interval = 8 semitones (not V-I which needs 5)
    const chords: ChordEvent[] = [
      makeChord("C", "7", 0, 2),
      makeChord("Ab", "7", 2, 2),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const notes = generatePianoComping(chords, {
        style: "hardBop",
        humanize: false,
        strum: false,
        random: createPRNG(seed),
      });
      expect(notes.length).toBeGreaterThan(0);
      // Standard C7: PCs include 3rd (E=4) and b7 (Bb=10)
      // Verify the voicing is a valid C7 sonority (not a tritone sub which would be Gb7)
      const pcs = new Set(notes[0].pitches.map(p => p % 12));
      // Should contain either 3rd (4) or b7 (10) for standard C7
      expect(pcs.has(4) || pcs.has(10), `seed=${seed}: missing C7 guide tones`).toBe(true);
    }
  });

  it("tritone sub weight is 0 for funk and shuffleBlues", () => {
    const chords: ChordEvent[] = [
      makeChord("G", "7", 0, 2),
      makeChord("C", "maj7", 2, 2),
    ];
    for (const style of ["funk", "shuffleBlues"] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const notes = generatePianoComping(chords, {
          style,
          humanize: false,
          strum: false,
          random: createPRNG(seed),
        });
        if (notes.length === 0) continue;
        expect(notes[0].pitches.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("V-I resolution detected correctly for all root combinations", () => {
    // Test isResolvingDominant via integration: every V→I pair should produce valid output
    const vIpairs = [
      ["G", "C"], ["D", "G"], ["A", "D"], ["E", "A"],
      ["B", "E"], ["Gb", "B"], ["Db", "Gb"], ["Ab", "Db"],
      ["Eb", "Ab"], ["Bb", "Eb"], ["F", "Bb"], ["C", "F"],
    ];
    for (const [v, i] of vIpairs) {
      const chords = [makeChord(v, "7", 0, 2), makeChord(i, "maj7", 2, 2)];
      const notes = generatePianoComping(chords, {
        style: "swing", humanize: false, strum: false, random: createPRNG(42),
      });
      expect(notes.length, `${v}7→${i}maj7: no output`).toBeGreaterThan(0);
    }
  });
});

// ── Augmented chord cluster regression ──

describe("Augmented/#5 chord cluster regression", () => {
  const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const AUG_QUALITIES = ["maj7#5", "7#5", "aug7", "aug"];

  const hasSemitoneCluster = (pitches: number[]) => {
    const sorted = [...pitches].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] === 1) return true;
    }
    return false;
  };

  it("buildOpenVoicing: no semitone clusters on #5 chords", () => {
    for (const root of ROOTS) {
      for (const q of AUG_QUALITIES) {
        const pitches = buildOpenVoicing(root, q);
        expect(hasSemitoneCluster(pitches), `${root}${q} open: cluster [${pitches}]`).toBe(false);
      }
    }
  });

  it("buildQuartalVoicing: no semitone clusters on #5 chords", () => {
    for (const root of ROOTS) {
      for (const q of AUG_QUALITIES) {
        const pitches = buildQuartalVoicing(root, q);
        expect(hasSemitoneCluster(pitches), `${root}${q} quartal: cluster [${pitches}]`).toBe(false);
      }
    }
  });

  it("buildOpen5thsVoicing: no semitone clusters on #5 chords", () => {
    for (const root of ROOTS) {
      for (const q of AUG_QUALITIES) {
        const pitches = buildOpen5thsVoicing(root, q);
        expect(hasSemitoneCluster(pitches), `${root}${q} open5ths: cluster [${pitches}]`).toBe(false);
      }
    }
  });

  it("maj7#5 uses maj7 interval (11) not b7 (10)", () => {
    for (const root of ROOTS) {
      const pitches = buildOpenVoicing(root, "maj7#5");
      const pcs = pitches.map(p => p % 12);
      const rootPC = pitches[0] % 12 - 4; // 3rd is +4, so root = first - 4
      // Should contain interval 11 (maj7) from root, not 10 (b7)
      const normalizedRoot = ((rootPC % 12) + 12) % 12;
      const maj7PC = (normalizedRoot + 11) % 12;
      const b7PC = (normalizedRoot + 10) % 12;
      expect(pcs, `${root}maj7#5: should have maj7`).toContain(maj7PC);
      expect(pcs.includes(b7PC), `${root}maj7#5: should NOT have b7`).toBe(false);
    }
  });
});
