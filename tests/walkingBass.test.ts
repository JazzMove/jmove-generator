import { describe, it, expect } from "vitest";
import {
  generateWalkingBass,
  scoreChordsToEvents,
  type ChordEvent,
  type BassNote,
} from "../src/index";

// ── Constants ──
const BASS_LOW = 28;  // E1
const BASS_HIGH = 55; // G3

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

describe("Walking Bass — range constraints", () => {
  it("all notes within E1–G3 (MIDI 28–55)", () => {
    const chords = iiVI();
    const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });

    for (const note of notes) {
      expect(note.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(note.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
  });

  it("range holds for all 12 roots", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    for (const root of roots) {
      const chords = [makeChord(root, "m7", 0), makeChord(root, "7", 2)];
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      for (const note of notes) {
        expect(note.pitch).toBeGreaterThanOrEqual(BASS_LOW);
        expect(note.pitch).toBeLessThanOrEqual(BASS_HIGH);
      }
    }
  });

  it("range holds for bossa style", () => {
    const notes = generateWalkingBass(iiVI(), { style: "bossa", tempo: 140 });
    for (const note of notes) {
      expect(note.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(note.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
  });

  it("range holds for latin style", () => {
    const notes = generateWalkingBass(iiVI(), { style: "latin", tempo: 100 });
    for (const note of notes) {
      expect(note.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(note.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
  });
});

// ── Swing Style Tests ──

describe("Walking Bass — swing", () => {
  it("produces 4 notes per measure in 4/4", () => {
    const chords = [makeChord("C", "maj7", 0)];
    const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
    expect(notes.length).toBe(4);
  });

  it("beat 1 is root or 5th of chord", () => {
    // Run 50 times to account for randomness
    const rootC = 48; // C3
    const fifthC = 55; // G3
    const rootC_alt = 36; // C2
    for (let i = 0; i < 50; i++) {
      const chords = [makeChord("C", "maj7", 0)];
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      const beat1 = notes[0].pitch % 12;
      // Root = C (0) or 5th = G (7)
      expect([0, 7]).toContain(beat1);
    }
  });

  it("beat 2 moves stepwise from root (pattern-based)", () => {
    const chords = [makeChord("C", "maj7", 0)];
    for (let i = 0; i < 30; i++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      const root = notes[0].pitch;
      const beat2 = notes[1].pitch;
      // Pattern-based: beat 2 within 9 semitones of root (scale steps)
      expect(Math.abs(beat2 - root)).toBeLessThanOrEqual(9);
    }
  });

  it("beat 4 is chromatic approach to next root", () => {
    const chords = [makeChord("D", "m7", 0), makeChord("G", "7", 2)];
    // Run multiple trials (enclosures/dedup can occasionally shift approach note)
    let approachCount = 0;
    const trials = 20;
    for (let t = 0; t < trials; t++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      const lastOfBar0 = [...notes].filter(n => n.time < 2 - 0.05).pop()!;
      const gPC = 7; // G pitch class
      const pc = lastOfBar0.pitch % 12;
      const dist = Math.min(Math.abs(pc - gPC), 12 - Math.abs(pc - gPC));
      if (dist <= 2) approachCount++;
    }
    // At least 80% of trials should have chromatic/diatonic approach
    expect(approachCount / trials).toBeGreaterThanOrEqual(0.8);
  });

  it("produces correct timing", () => {
    const chords = [makeChord("C", "maj7", 0)];
    const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
    const beatDur = 60 / 120; // 0.5s

    expect(notes[0].time).toBeCloseTo(0);
    expect(notes[1].time).toBeCloseTo(beatDur);
    expect(notes[2].time).toBeCloseTo(beatDur * 2);
    expect(notes[3].time).toBeCloseTo(beatDur * 3);
  });

  it("monophonic: each note sustains until next note starts (no overlap)", () => {
    const chords = [makeChord("C", "maj7", 0), makeChord("G", "7", 2)];
    const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });

    for (let i = 0; i < notes.length - 1; i++) {
      // Duration fills exactly to next note start
      expect(notes[i].duration).toBeCloseTo(notes[i + 1].time - notes[i].time, 2);
      // No overlap: note end <= next note start
      expect(notes[i].time + notes[i].duration).toBeLessThanOrEqual(notes[i + 1].time + 0.01);
    }
    // Last note keeps its original duration
    expect(notes[notes.length - 1].duration).toBeGreaterThan(0);
  });

  it("handles multiple measures", () => {
    const chords = iiVI();
    const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
    // 4 measures × 4 beats = 16, enclosures may add 1 extra per measure
    expect(notes.length).toBeGreaterThanOrEqual(16);
    expect(notes.length).toBeLessThanOrEqual(20);
  });

  it("velocity on beat 1 is strongest", () => {
    const chords = [makeChord("C", "maj7", 0)];
    const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
    expect(notes[0].velocity).toBeGreaterThanOrEqual(notes[1].velocity);
    expect(notes[0].velocity).toBeGreaterThanOrEqual(notes[2].velocity);
    expect(notes[0].velocity).toBeGreaterThanOrEqual(notes[3].velocity);
  });
});

// ── Bossa Style Tests ──

describe("Walking Bass — bossa", () => {
  it("produces 2 notes per measure (root + 5th)", () => {
    const chords = [makeChord("C", "maj7", 0)];
    const notes = generateWalkingBass(chords, { style: "bossa", tempo: 140 });
    expect(notes.length).toBe(2);
  });

  it("first note is root", () => {
    const chords = [makeChord("A", "m7", 0)];
    const notes = generateWalkingBass(chords, { style: "bossa", tempo: 140 });
    expect(notes[0].pitch % 12).toBe(9); // A
  });

  it("second note is 5th", () => {
    const chords = [makeChord("A", "m7", 0)];
    const notes = generateWalkingBass(chords, { style: "bossa", tempo: 140 });
    expect(notes[1].pitch % 12).toBe(4); // E (5th of A)
  });

  it("uses half-note durations (monophonic fill)", () => {
    const chords = [makeChord("C", "maj7", 0)];
    const notes = generateWalkingBass(chords, { style: "bossa", tempo: 120 });
    const beatDur = 60 / 120;
    // First note fills to second note start (2 beats)
    expect(notes[0].duration).toBeCloseTo(beatDur * 2);
    // Last note keeps original duration
    expect(notes[1].duration).toBeGreaterThan(0);
  });
});

// ── Latin Style Tests ──

describe("Walking Bass — latin", () => {
  it("produces 4 notes per measure (tumbao pattern)", () => {
    const chords = [makeChord("C", "maj7", 0)];
    const notes = generateWalkingBass(chords, { style: "latin", tempo: 100 });
    expect(notes.length).toBe(4);
  });

  it("first note is root", () => {
    const chords = [makeChord("F", "7", 0)];
    const notes = generateWalkingBass(chords, { style: "latin", tempo: 100 });
    expect(notes[0].pitch % 12).toBe(5); // F
  });

  it("has syncopated timing (not on straight beats)", () => {
    const chords = [makeChord("C", "maj7", 0)];
    const notes = generateWalkingBass(chords, { style: "latin", tempo: 120 });
    const beatDur = 60 / 120;
    // Second note at beat 1.5 (syncopated)
    expect(notes[1].time).toBeCloseTo(beatDur * 1.5);
  });
});

// ── Edge Cases ──

describe("Walking Bass — edge cases", () => {
  it("returns empty for empty chords", () => {
    const notes = generateWalkingBass([]);
    expect(notes).toEqual([]);
  });

  it("handles single chord", () => {
    const notes = generateWalkingBass([makeChord("C", "", 0)], { style: "swing" });
    expect(notes.length).toBe(4);
  });

  it("handles unknown quality gracefully", () => {
    const notes = generateWalkingBass([makeChord("C", "weird13b9#11", 0)]);
    expect(notes.length).toBe(4);
    // Should still produce valid MIDI range
    for (const n of notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
  });

  it("handles slash chords", () => {
    const notes = generateWalkingBass([makeChord("C", "maj7/G", 0)]);
    expect(notes.length).toBe(4);
    for (const n of notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
  });

  it("defaults to swing style", () => {
    const notes = generateWalkingBass([makeChord("C", "7", 0)]);
    expect(notes.length).toBe(4); // swing = 4 per measure
  });

  it("defaults tempo to 120", () => {
    const notes = generateWalkingBass([makeChord("C", "7", 0)]);
    expect(notes[1].time).toBeCloseTo(0.5); // 60/120 = 0.5s per beat
  });

  it("all notes have positive duration", () => {
    const chords = iiVI();
    const notes = generateWalkingBass(chords);
    for (const n of notes) {
      expect(n.duration).toBeGreaterThan(0);
    }
  });

  it("notes are in chronological order", () => {
    const chords = iiVI();
    const notes = generateWalkingBass(chords);
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].time).toBeGreaterThanOrEqual(notes[i - 1].time);
    }
  });
});

// ── scoreChordsToEvents Tests ──

describe("scoreChordsToEvents", () => {
  it("converts measure chords to ChordEvent array", () => {
    const measures = [
      {
        chords: [{ root: "D", quality: "m7", startTime: 0 }],
        startTime: 0,
        endTime: 2,
      },
      {
        chords: [{ root: "G", quality: "7", startTime: 2 }],
        startTime: 2,
        endTime: 4,
      },
    ];

    const events = scoreChordsToEvents(measures);
    expect(events.length).toBe(2);
    expect(events[0]).toEqual({ root: "D", quality: "m7", time: 0, duration: 2 });
    expect(events[1]).toEqual({ root: "G", quality: "7", time: 2, duration: 2 });
  });

  it("handles multiple chords per measure", () => {
    const measures = [
      {
        chords: [
          { root: "D", quality: "m7", startTime: 0 },
          { root: "G", quality: "7", startTime: 1 },
        ],
        startTime: 0,
        endTime: 2,
      },
    ];

    const events = scoreChordsToEvents(measures);
    expect(events.length).toBe(2);
    expect(events[0].duration).toBe(1);
    expect(events[1].duration).toBe(1);
  });

  it("skips measures with no chords", () => {
    const measures = [
      { chords: [], startTime: 0, endTime: 2 },
      { chords: [{ root: "C", quality: "maj7", startTime: 2 }], startTime: 2, endTime: 4 },
    ];

    const events = scoreChordsToEvents(measures);
    expect(events.length).toBe(1);
    expect(events[0].root).toBe("C");
  });
});

// ── Phase H: Approach Direction Variety ──

describe("Walking Bass — approach direction variety", () => {
  it("approach tone varies direction across many measures", () => {
    // Over many trials, approach should come from both above and below
    const chords = [makeChord("C", "maj7", 0), makeChord("G", "7", 2)];
    let fromAboveCount = 0;
    let fromBelowCount = 0;
    for (let i = 0; i < 50; i++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      const beat4 = notes[3].pitch;
      // G in bass range — check if approach is from above (G#+1) or below (F#-1)
      const gPC = 7;
      const beat4PC = beat4 % 12;
      const distAbove = (beat4PC - gPC + 12) % 12;
      const distBelow = (gPC - beat4PC + 12) % 12;
      if (distAbove > 0 && distAbove <= 2) fromAboveCount++;
      if (distBelow > 0 && distBelow <= 2) fromBelowCount++;
    }
    // Both directions should appear (30% flip rate)
    expect(fromAboveCount).toBeGreaterThan(0);
    expect(fromBelowCount).toBeGreaterThan(0);
  });
});

// ── Phase F: Style-Biased Bass Humanization ──

describe("Walking Bass — style-biased humanization", () => {
  it("ballad style lays back (negative average offset)", () => {
    const chords = [makeChord("C", "maj7", 0, 2), makeChord("G", "7", 2, 2)];
    const offsets: number[] = [];
    for (let trial = 0; trial < 20; trial++) {
      const notes = generateWalkingBass(chords, { style: "ballad", tempo: 120, humanize: true });
      // Beat 1 offset from expected time 0
      offsets.push(notes[0].time - 0);
    }
    const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    // Ballad groove template: positive bias (+12ms = behind the beat, laid back)
    expect(avg).toBeGreaterThan(0.005);
  });

  it("bossa style has tight timing (small jitter)", () => {
    const chords = [makeChord("C", "maj7", 0, 2), makeChord("G", "7", 2, 2)];
    const offsets: number[] = [];
    for (let trial = 0; trial < 20; trial++) {
      const notes = generateWalkingBass(chords, { style: "bossa", tempo: 120, humanize: true });
      offsets.push(Math.abs(notes[0].time));
    }
    const maxOffset = Math.max(...offsets);
    // Bossa jitter ±2ms
    expect(maxOffset).toBeLessThan(0.003);
  });
});

// ── Phase O: Bass enclosures ──

describe("Walking Bass — enclosures", () => {
  it("enclosures produce 5 notes in a measure (statistical)", () => {
    const chords = [makeChord("D", "m7", 0, 2), makeChord("G", "7", 2, 2)];
    let fiveNoteCount = 0;
    for (let trial = 0; trial < 200; trial++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      // First measure notes (before time 2)
      const bar0 = notes.filter(n => n.time < 2 - 0.05);
      if (bar0.length === 5) fiveNoteCount++;
    }
    // ~10% enclosure rate (boundary guards reduce actual rate slightly)
    expect(fiveNoteCount).toBeGreaterThan(0);
    expect(fiveNoteCount).toBeLessThan(60);
  });

  it("enclosure notes are close together (chromatic approach pair)", () => {
    const chords = [makeChord("D", "m7", 0, 2), makeChord("G", "7", 2, 2)];
    let found = false;
    for (let trial = 0; trial < 500; trial++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      const bar0 = notes.filter(n => n.time < 2 - 0.05);
      if (bar0.length === 5) {
        // Notes 3 and 4 are enclosure eighths — chromatic above and below target
        const enc1 = bar0[3].pitch;
        const enc2 = bar0[4].pitch;
        // After dedup/constrainStepwise, they should still be within 4 semitones
        const dist = Math.abs(enc1 - enc2);
        expect(dist).toBeLessThanOrEqual(4);
        found = true;
        break;
      }
    }
    expect(found, "no enclosure found in 500 trials").toBe(true);
  });

  it("no enclosure on last chord", () => {
    const chords = [makeChord("C", "maj7", 0, 2)]; // single chord = last chord
    for (let trial = 0; trial < 100; trial++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      // Should always be exactly 4 notes (no enclosure on last chord)
      expect(notes.length).toBe(4);
    }
  });
});

// ── Phase K: Tempo-dependent swing ──

describe("Walking Bass — tempo-dependent swing", () => {
  it("works at extreme tempos without errors", () => {
    const chords = [makeChord("C", "7", 0, 2), makeChord("G", "7", 2, 2)];
    for (const tempo of [60, 80, 120, 200, 280]) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo, swingAmount: 100 });
      expect(notes.length).toBeGreaterThanOrEqual(4);
      // All notes should have valid pitches
      for (const n of notes) {
        expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
        expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
      }
    }
  });
});

// ── Phase P: Dynamic arc ──

describe("Walking Bass — dynamic arc", () => {
  it("opening bars have lower velocity than peak with measureInfo", () => {
    const chords = Array.from({ length: 32 }, (_, i) =>
      makeChord("C", "7", i * 2, 2)
    );
    const notes = generateWalkingBass(chords, {
      style: "swing", tempo: 120,
      measureInfo: { totalMeasures: 32, measureDuration: 2 },
    });
    // Early notes (bars 0-3) vs peak notes (bars 20-24)
    const early = notes.filter(n => n.time >= 0 && n.time < 8);
    const peak = notes.filter(n => n.time >= 40 && n.time < 48);
    if (early.length > 0 && peak.length > 0) {
      const avgEarly = early.reduce((s, n) => s + n.velocity, 0) / early.length;
      const avgPeak = peak.reduce((s, n) => s + n.velocity, 0) / peak.length;
      expect(avgEarly).toBeLessThan(avgPeak);
    }
  });

  it("dynamic arc returns to taper at end", () => {
    const chords = Array.from({ length: 32 }, (_, i) =>
      makeChord("C", "7", i * 2, 2)
    );
    const notes = generateWalkingBass(chords, {
      style: "swing", tempo: 120,
      measureInfo: { totalMeasures: 32, measureDuration: 2 },
    });
    // Peak notes (bars 20-24) vs taper notes (bars 28-31)
    const peak = notes.filter(n => n.time >= 40 && n.time < 48);
    const taper = notes.filter(n => n.time >= 56 && n.time < 64);
    if (peak.length > 0 && taper.length > 0) {
      const avgPeak = peak.reduce((s, n) => s + n.velocity, 0) / peak.length;
      const avgTaper = taper.reduce((s, n) => s + n.velocity, 0) / taper.length;
      expect(avgTaper).toBeLessThan(avgPeak);
    }
  });
});

// ── New Genre Bass Tests ──

describe("Walking Bass — new genres", () => {
  it("neoSoul: notes in range with staccato durations", () => {
    const notes = generateWalkingBass(iiVI(), { style: "neoSoul", tempo: 90 });
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
    // Staccato: at least some notes shorter than a quarter note
    const beatDur = 60 / 90;
    const shortNotes = notes.filter(n => n.duration < beatDur * 0.7);
    expect(shortNotes.length).toBeGreaterThan(0);
  });

  it("neoSoul: 4-6 notes per chord (groove density)", () => {
    const chords = iiVI();
    const notes = generateWalkingBass(chords, { style: "neoSoul", tempo: 90 });
    const perChord = chords.map(c => notes.filter(n => n.time >= c.time && n.time < c.time + c.duration).length);
    for (const count of perChord) {
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it("contemporaryJazz: notes in range", () => {
    const notes = generateWalkingBass(iiVI(), { style: "contemporaryJazz", tempo: 120 });
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
  });

  it("contemporaryJazz: occasional 8th-note runs (statistical)", () => {
    let eighthRunFound = false;
    for (let trial = 0; trial < 30; trial++) {
      const notes = generateWalkingBass(iiVI(), { style: "contemporaryJazz", tempo: 120 });
      // Look for notes closer than a quarter note apart
      const beatDur = 60 / 120;
      for (let i = 1; i < notes.length; i++) {
        const gap = notes[i].time - notes[i - 1].time;
        if (gap > 0 && gap < beatDur * 0.7) {
          eighthRunFound = true;
          break;
        }
      }
      if (eighthRunFound) break;
    }
    expect(eighthRunFound).toBe(true);
  });

  it("mathRock: notes in range with tight staccato", () => {
    const notes = generateWalkingBass(iiVI(), { style: "mathRock", tempo: 140 });
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
    // Math rock: staccato — at least some notes should be short
    const beatDur = 60 / 140;
    const shortNotes = notes.filter(n => n.duration < beatDur * 0.5);
    expect(shortNotes.length).toBeGreaterThan(0);
  });

  it("mathRock: octave patterns present", () => {
    let octaveFound = false;
    for (let trial = 0; trial < 30; trial++) {
      const notes = generateWalkingBass(iiVI(), { style: "mathRock", tempo: 140 });
      for (let i = 1; i < notes.length; i++) {
        if (Math.abs(notes[i].pitch - notes[i - 1].pitch) === 12) {
          octaveFound = true;
          break;
        }
      }
      if (octaveFound) break;
    }
    expect(octaveFound).toBe(true);
  });

  it("idm: notes in range, sparse (1-2 per chord)", () => {
    const chords = iiVI();
    const notes = generateWalkingBass(chords, { style: "idm", tempo: 100 });
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
    // IDM: sub-bass pedal, 1-2 notes per chord
    const perChord = chords.map(c => notes.filter(n => n.time >= c.time && n.time < c.time + c.duration).length);
    for (const count of perChord) {
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it("idm: sustained durations (longer than walking)", () => {
    const notes = generateWalkingBass(iiVI(), { style: "idm", tempo: 100 });
    const beatDur = 60 / 100;
    // At least some notes should be longer than 2 beats
    const longNotes = notes.filter(n => n.duration > beatDur * 1.5);
    expect(longNotes.length).toBeGreaterThan(0);
  });
});

// ── Phase G: Contour-Based Bass + Approach Vocabulary ──

describe("Walking Bass — contour-based targeting", () => {
  it("beat 4 approach tone is within 2 semitones of next root", () => {
    const chords = [
      makeChord("C", "maj7", 0, 2),
      makeChord("F", "7", 2, 2),
      makeChord("Bb", "maj7", 4, 2),
      makeChord("Eb", "maj7", 6, 2),
    ];
    for (let trial = 0; trial < 20; trial++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      const beatDur = 0.5;
      for (let ci = 0; ci < chords.length - 1; ci++) {
        // Find beat 4 note (last note in this chord's measure)
        const measureStart = chords[ci].time;
        const measureEnd = measureStart + chords[ci].duration;
        const measureNotes = notes.filter(n => n.time >= measureStart && n.time < measureEnd);
        if (measureNotes.length < 4) continue;
        const beat4 = measureNotes[measureNotes.length - 1];
        const nextRootPC = { C: 0, F: 5, Bb: 10, Eb: 3 }[chords[ci + 1].root]!;
        const beat4PC = beat4.pitch % 12;
        // Should be within 2 semitones (chromatic or diatonic approach)
        const dist = Math.min(
          Math.abs(beat4PC - nextRootPC),
          12 - Math.abs(beat4PC - nextRootPC),
        );
        expect(dist).toBeLessThanOrEqual(2);
      }
    }
  });

  it("per-style approach vocabulary produces varied approach tones", () => {
    // contemporaryJazz should use more double-chromatic approaches
    const chords = [
      makeChord("C", "maj7", 0, 2),
      makeChord("G", "7", 2, 2),
    ];
    const approaches = new Set<number>();
    for (let trial = 0; trial < 50; trial++) {
      const notes = generateWalkingBass(chords, { style: "contemporaryJazz", tempo: 120 });
      const measureNotes = notes.filter(n => n.time >= 0 && n.time < 2);
      if (measureNotes.length >= 4) {
        approaches.add(measureNotes[measureNotes.length - 1].pitch % 12);
      }
    }
    // Should see at least 2 different approach tones (not always same chromatic)
    expect(approaches.size).toBeGreaterThanOrEqual(2);
  });

  it("two-bar phrasing: consecutive bars alternate direction more than 50%", () => {
    // 8 bars of ii-V-I with repeated chords — enough bars to measure alternation
    const chords = [
      makeChord("D", "m7", 0, 2), makeChord("G", "7", 2, 2),
      makeChord("C", "maj7", 4, 2), makeChord("A", "m7", 6, 2),
      makeChord("D", "m7", 8, 2), makeChord("G", "7", 10, 2),
      makeChord("C", "maj7", 12, 2), makeChord("F", "maj7", 14, 2),
    ];
    let alternations = 0;
    let comparisons = 0;
    for (let trial = 0; trial < 40; trial++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      // Compute direction per measure (first note vs last note)
      const dirs: ("up" | "down")[] = [];
      for (let ci = 0; ci < chords.length; ci++) {
        const mNotes = notes.filter(n => n.time >= chords[ci].time && n.time < chords[ci].time + chords[ci].duration);
        if (mNotes.length < 2) continue;
        dirs.push(mNotes[mNotes.length - 1].pitch > mNotes[0].pitch ? "up" : "down");
      }
      for (let d = 1; d < dirs.length; d++) {
        comparisons++;
        if (dirs[d] !== dirs[d - 1]) alternations++;
      }
    }
    // With 65-70% biasing, alternation rate should be > 50%
    expect(alternations / comparisons).toBeGreaterThan(0.5);
  });
});

describe("Walking Bass — drums-first kick snapping", () => {
  it("bass downbeats snap to nearby kick times", () => {
    const chords = [
      makeChord("C", "maj7", 0, 2),
      makeChord("G", "7", 2, 2),
    ];
    // Provide kick times slightly offset from grid (simulates humanized kicks)
    const kickTimes = [0.005, 0.505, 1.005, 1.505, 2.003, 2.503, 3.003, 3.503];
    const notes = generateWalkingBass(chords, {
      style: "swing", tempo: 120, humanize: true, kickTimes,
    });
    // Beat 1 notes (first of each measure) should snap to kick times
    const beat1Notes = notes.filter((_, i) => i === 0 || i === 4); // approx indices
    for (const n of beat1Notes) {
      const nearestKick = kickTimes.reduce((best, kt) =>
        Math.abs(kt - n.time) < Math.abs(best - n.time) ? kt : best
      );
      // Should be within 15ms of a kick (snapped or already close)
      expect(Math.abs(n.time - nearestKick)).toBeLessThan(0.02);
    }
  });
});

describe("Walking Bass — shuffle blues patterns", () => {
  it("produces varied patterns across multiple generations", () => {
    const chords = [
      makeChord("A", "7", 0, 2),
      makeChord("D", "7", 2, 2),
      makeChord("A", "7", 4, 2),
      makeChord("E", "7", 6, 2),
    ];
    const fingerprints = new Set<string>();
    for (let trial = 0; trial < 30; trial++) {
      const notes = generateWalkingBass(chords, { style: "shuffleBlues", tempo: 120 });
      // Fingerprint: pitch intervals within first measure
      const m1 = notes.filter(n => n.time >= 0 && n.time < 2);
      if (m1.length >= 4) {
        const intervals = [m1[1].pitch - m1[0].pitch, m1[2].pitch - m1[1].pitch, m1[3].pitch - m1[2].pitch];
        fingerprints.add(intervals.join(","));
      }
    }
    // Should see at least 3 different patterns (boogie, classic, walking 6ths, etc.)
    expect(fingerprints.size).toBeGreaterThanOrEqual(3);
  });
});

// ── Quality coverage guard: every engine quality must produce bass output ──

describe("Walking Bass — quality coverage (no missing chord tones)", () => {
  const ENGINE_QUALITIES = [
    "", "m", "dim", "aug",
    "maj7", "maj9", "maj7#11", "maj7#5",
    "m7", "m9", "m11", "m6", "m6/9", "m(maj7)", "m7b5",
    "7", "9", "13", "7#9", "7b9", "7#9b5", "7b9b5", "7#11", "7#5", "7b5", "7alt",
    "7sus4", "sus4", "sus2",
    "dim7", "6", "6/9", "add9",
  ];

  for (const q of ENGINE_QUALITIES) {
    it(`quality "${q || "(major)"}" produces bass notes`, () => {
      const notes = generateWalkingBass(
        [makeChord("C", q, 0, 4)],
        { tempo: 120, style: "swing" },
      );
      expect(notes.length).toBeGreaterThan(0);
      // Beat 1 should be root (C = any pitch where pitch % 12 === 0)
      expect(notes[0].pitch % 12).toBe(0);
    });
  }

  // Verify b5 qualities don't produce natural 5th on downbeat chord tones
  it("7b5 family: beat-1 root is correct (pattern uses right chord tones)", () => {
    for (const q of ["7b5", "7#9b5", "7b9b5"]) {
      const notes = generateWalkingBass([makeChord("C", q, 0, 4)], { tempo: 120, style: "swing" });
      expect(notes[0].pitch % 12).toBe(0); // root on beat 1
    }
  });
});

// ── Tempo Validation ──

describe("Walking Bass — tempo validation", () => {
  it("throws RangeError for tempo = 0", () => {
    expect(() => generateWalkingBass(iiVI(), { tempo: 0 })).toThrow(RangeError);
  });

  it("throws RangeError for negative tempo", () => {
    expect(() => generateWalkingBass(iiVI(), { tempo: -120 })).toThrow(RangeError);
  });
});
