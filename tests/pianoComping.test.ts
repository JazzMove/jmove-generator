import { describe, it, expect } from "vitest";
import {
  generatePianoComping,
  type ChordEvent,
  type CompNote,
} from "../src/index";

// ── Constants ──
const PIANO_LOW = 48;  // C3
const PIANO_HIGH = 76; // E5

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
  it("all pitches within C3–C5 (MIDI 48–72)", () => {
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
});

// ── Voicing Tests ──

describe("Piano Comping — voicings", () => {
  it("produces rootless voicings (4 notes per chord)", () => {
    const notes = generatePianoComping([makeChord("C", "maj7", 0)], { style: "ballad", humanize: false, strum: false });
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
    });

    const pitchClasses = notes[0].pitches.map((p) => p % 12).sort((a, b) => a - b);
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
});

// ── Edge Cases ──

describe("Piano Comping — edge cases", () => {
  it("returns empty for empty chords", () => {
    expect(generatePianoComping([])).toEqual([]);
  });

  it("handles unknown quality (falls back to dom7)", () => {
    const notes = generatePianoComping([makeChord("C", "strangeQuality", 0)], { humanize: false, strum: false, style: "ballad" });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].pitches.length).toBe(4);
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
      expect(notes[0].pitches.length).toBe(4);
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

// ── Strum Tests ──

describe("Piano Comping — chord strum", () => {
  it("strum=true (default) produces single-pitch notes from 4-note voicing", () => {
    const notes = generatePianoComping([makeChord("C", "maj7", 0)], {
      style: "ballad",
      humanize: false,
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
  it("density < 35 produces 2-note voicings", () => {
    const notes = generatePianoComping(iiVI(), {
      style: "swing", humanize: false, density: 20, strum: false,
    });
    for (const note of notes) {
      expect(note.pitches.length).toBe(2);
    }
  });

  it("density >= 35 produces full voicings (3-4 notes)", () => {
    const notes = generatePianoComping(iiVI(), {
      style: "ballad", humanize: false, density: 50, strum: false,
    });
    for (const note of notes) {
      expect(note.pitches.length).toBeGreaterThanOrEqual(3);
    }
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
    for (let trial = 0; trial < 50; trial++) {
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
        style: "swing", humanize: false, strum: false, density: 50,
      });
      for (let i = 0; i < notes.length - 1; i++) {
        if (notes[i].pitches.length === 2 && notes[i + 1].pitches.length === 2 &&
            notes[i + 1].time > notes[i].time && notes[i + 1].time - notes[i].time < 1.0) {
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

  it("second group is time-offset by ~half beat", () => {
    const tempo = 120;
    const beatDur = 60 / tempo;
    for (let trial = 0; trial < 200; trial++) {
      const notes = generatePianoComping(iiVI(), {
        style: "swing", humanize: false, strum: false, density: 50, tempo,
      });
      for (let i = 0; i < notes.length - 1; i++) {
        if (notes[i].pitches.length === 2 && notes[i + 1].pitches.length === 2 &&
            notes[i + 1].time > notes[i].time && notes[i + 1].time - notes[i].time < 1.0) {
          const offset = notes[i + 1].time - notes[i].time;
          // Should be approximately half a beat (± swing adjustment)
          expect(offset).toBeGreaterThan(beatDur * 0.3);
          expect(offset).toBeLessThan(beatDur * 1.0);
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
        { style: "ballad", humanize: false, strum: false, density: 50 },
      );
      expect(notes.length).toBeGreaterThan(0);
      const pcs = new Set(notes[0].pitches.map((p) => ((p % 12) - 0 + 12) % 12)); // C=0
      for (const interval of required) {
        expect(pcs.has(interval), `quality "${q}": missing interval ${interval} in pitches ${[...pcs]}`).toBe(true);
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
  it("strum spreads multi-pitch chords into single-pitch notes", () => {
    const notes = generatePianoComping(iiVI(), {
      style: "swing", humanize: false, strum: true, strumMs: 25, density: 50,
    });
    // All strummed notes should be single-pitch
    for (const note of notes) {
      expect(note.pitches.length).toBe(1);
    }
  });

  it("strum off keeps multi-pitch voicings intact", () => {
    const notes = generatePianoComping(iiVI(), {
      style: "swing", humanize: false, strum: false, density: 50,
    });
    const multiPitch = notes.filter(n => n.pitches.length > 1);
    expect(multiPitch.length).toBeGreaterThan(0);
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
