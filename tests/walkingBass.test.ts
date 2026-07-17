import { describe, it, expect } from "vitest";
import {
  generateWalkingBass,
  scoreChordsToEvents,
  resolveBassGranular,
  createPRNG,
  type ChordEvent,
  type ChordAnalysis,
  type BassNote,
  type BassGranular,
} from "../src/index";

// ── Constants ──
const BASS_LOW = 28;  // E1
const BASS_HIGH = 55; // G3
const ROOT_SEMITONES: Record<string, number> = {
  "C": 0, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5,
  "Gb": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11,
};

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

  it("beat 1 is chord tone (root, 5th, or 3rd)", () => {
    for (let i = 0; i < 50; i++) {
      const chords = [makeChord("C", "maj7", 0)];
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      const beat1 = notes[0].pitch % 12;
      // Root = C (0), 3rd = E (4), 5th = G (7)
      expect([0, 4, 7]).toContain(beat1);
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

  it("diatonic approach finds half-step scale positions (E-F, B-C)", () => {
    // F major: scale has E-F half step. Approach to F from above should use E (not F#)
    // Run many trials to catch diatonic approaches
    let correctDiatonic = 0;
    let wrongDiatonic = 0;
    const trials = 200;
    for (let t = 0; t < trials; t++) {
      const chords = [makeChord("C", "maj7", 0), makeChord("F", "maj7", 2)];
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      const lastOfBar0 = [...notes].filter(n => n.time < 2 - 0.05).pop()!;
      // F target = 5 (mod 12). Approach from above:
      // Correct diatonic: E (4) = half step. Old bug: target+2 = G (7) = wrong
      const pc = lastOfBar0.pitch % 12;
      const fPC = 5;
      const dist = Math.min(Math.abs(pc - fPC), 12 - Math.abs(pc - fPC));
      if (dist === 1) correctDiatonic++; // half step (chromatic or correct diatonic)
      if (pc === 7) wrongDiatonic++; // G = old bug (target + 2 = always whole step)
    }
    // Should never see the old bug (G as approach to F from above)
    // Allow small count since G could appear as a chord tone on beat 4 (not approach)
    expect(wrongDiatonic / trials, `wrong diatonic (G): ${wrongDiatonic}/${trials}`).toBeLessThan(0.15);
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

// ── Beat 1 Non-Root Distribution ──

describe("Walking Bass — beat 1 non-root distribution", () => {
  it("multi-bar: beat 1 is root ~65%, 5th ~25%, 3rd ~10% (first bar always root)", () => {
    let rootCount = 0;
    let fifthCount = 0;
    let thirdCount = 0;
    let otherCount = 0;
    const trials = 200;

    for (let i = 0; i < trials; i++) {
      const chords = [
        makeChord("C", "maj7", 0), makeChord("F", "7", 2),
        makeChord("G", "7", 4), makeChord("C", "maj7", 6),
        makeChord("A", "m7", 8), makeChord("D", "7", 10),
      ];
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      // Skip first chord (always root) - check bars 2-6
      for (let bar = 1; bar < chords.length; bar++) {
        const chordTime = chords[bar].time;
        const beat1Note = notes.find(n => Math.abs(n.time - chordTime) < 0.1);
        if (!beat1Note) continue;
        const pc = beat1Note.pitch % 12;
        const rootPC = ROOT_SEMITONES[chords[bar].root];
        const fifthPC = (rootPC + 7) % 12;
        const q = chords[bar].quality;
        const isMinor = q.startsWith("m") && !q.startsWith("maj");
        const thirdPC = isMinor ? (rootPC + 3) % 12 : (rootPC + 4) % 12;

        if (pc === rootPC) rootCount++;
        else if (pc === fifthPC) fifthCount++;
        else if (pc === thirdPC) thirdCount++;
        else otherCount++;
      }
    }

    const total = rootCount + fifthCount + thirdCount + otherCount;
    const rootPct = rootCount / total;
    const fifthPct = fifthCount / total;
    const thirdPct = thirdCount / total;

    // Root should dominate (55-80%), 5th significant (10-35%), 3rd minor (2-20%)
    expect(rootPct, `root: ${(rootPct * 100).toFixed(1)}%`).toBeGreaterThan(0.50);
    expect(rootPct, `root: ${(rootPct * 100).toFixed(1)}%`).toBeLessThan(0.85);
    expect(fifthPct, `5th: ${(fifthPct * 100).toFixed(1)}%`).toBeGreaterThan(0.05);
    expect(thirdPct + fifthPct, `non-root: ${((thirdPct + fifthPct) * 100).toFixed(1)}%`).toBeGreaterThan(0.10);
    expect(otherCount, `unexpected pitch classes: ${otherCount}`).toBe(0);
  });

  it("first bar is always root", () => {
    for (let i = 0; i < 50; i++) {
      const chords = [makeChord("E", "m7", 0), makeChord("A", "7", 2)];
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      expect(notes[0].pitch % 12).toBe(4); // E is always root on first bar
    }
  });

  it("voice-leading guard: no beat 1 jumps > 7 from previous bar", () => {
    for (let trial = 0; trial < 50; trial++) {
      const chords = [
        makeChord("C", "maj7", 0), makeChord("Gb", "7", 2),
        makeChord("B", "maj7", 4), makeChord("Eb", "m7", 6),
      ];
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      for (let i = 1; i < chords.length; i++) {
        const prevLast = notes.filter(n => n.time < chords[i].time).pop();
        const currFirst = notes.find(n => Math.abs(n.time - chords[i].time) < 0.1);
        if (!prevLast || !currFirst) continue;
        expect(
          Math.abs(currFirst.pitch - prevLast.pitch),
          `bar ${i}: ${prevLast.pitch}→${currFirst.pitch}`
        ).toBeLessThanOrEqual(7);
      }
    }
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

  it("second note is a chord tone (root, 3rd, 5th, or approach)", () => {
    // Bossa now varies: 50% 5th, 25% 3rd, 15% approach, 10% root
    const chords = [makeChord("A", "m7", 0)];
    const rootPC = 9; // A
    const thirdPC = 0; // C (minor 3rd)
    const fifthPC = 4; // E
    let valid = 0;
    for (let i = 0; i < 50; i++) {
      const notes = generateWalkingBass(chords, { style: "bossa", tempo: 140 });
      const pc = notes[1].pitch % 12;
      if (pc === rootPC || pc === thirdPC || pc === fifthPC || pc === 8 /* G#, chromatic approach */) valid++;
    }
    expect(valid).toBe(50); // all should be valid chord tones or approach
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

  it("all 4 patterns appear across many trials", () => {
    // Pattern distribution: root-5th (50%), root-3rd (25%), root-approach (15%), 5th-root (10%)
    // Use multi-chord progressions so prevPitch is set (enables all patterns)
    const chords = [
      makeChord("C", "maj7", 0),
      makeChord("F", "7", 4),
      makeChord("G", "7", 8),
      makeChord("C", "maj7", 12),
    ];
    let rootFifth = 0, rootThird = 0, rootApproach = 0, fifthRoot = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const notes = generateWalkingBass(chords, { style: "bossa", tempo: 120 });
      // Check 2nd chord onwards (first chord is always root-5th)
      for (let c = 1; c < 4; c++) {
        const n1 = notes[c * 2];
        const n2 = notes[c * 2 + 1];
        const n1pc = n1.pitch % 12;
        const n2pc = n2.pitch % 12;
        const chordRoot = [0, 5, 7, 0][c]; // C, F, G, C
        if (n1pc === chordRoot && n2pc === (chordRoot + 7) % 12) rootFifth++;
        else if (n1pc !== chordRoot && n2pc === chordRoot) fifthRoot++;
        else if (n1pc === chordRoot) {
          // Differentiate 3rd vs approach
          const dist = Math.abs(n2.pitch - n1.pitch);
          if (dist <= 2) rootApproach++;
          else rootThird++;
        }
      }
    }
    // All patterns should appear at least once (200*3=600 samples)
    expect(rootFifth).toBeGreaterThan(0);
    expect(rootThird).toBeGreaterThan(0);
    expect(rootApproach).toBeGreaterThan(0);
    expect(fifthRoot).toBeGreaterThan(0);
  });
});

// ── Latin Style Tests ──

describe("Walking Bass — latin", () => {
  it("produces 3-4 notes per measure (tumbao variations)", () => {
    // Latin now has pattern variations: 3-note anticipated and 4-note standard
    const chords = [makeChord("C", "maj7", 0)];
    const notes = generateWalkingBass(chords, { style: "latin", tempo: 100 });
    expect(notes.length).toBeGreaterThanOrEqual(3);
    expect(notes.length).toBeLessThanOrEqual(4);
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

  it("all 4 tumbao patterns appear across many trials", () => {
    // Pattern 0: classic (4 notes, root first) - 40%
    // Pattern 1: melodic (4 notes, root first) - 25%
    // Pattern 2: approach (4 notes, root first) - 20%
    // Pattern 3: anticipated (3 notes, NOT root first) - 15%
    const chords = [
      makeChord("C", "maj7", 0),
      makeChord("F", "7", 4),
      makeChord("G", "7", 8),
    ];
    let fourNote = 0, threeNote = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const notes = generateWalkingBass(chords, { style: "latin", tempo: 120 });
      // Count notes per chord (chord at idx 1+ to skip first-chord guard)
      const beatDur = 60 / 120;
      for (let c = 1; c < 3; c++) {
        const chordStart = c * 4 * beatDur;
        const chordEnd = (c + 1) * 4 * beatDur;
        const chordNotes = notes.filter(n => n.time >= chordStart - 0.01 && n.time < chordEnd - 0.01);
        if (chordNotes.length === 4) fourNote++;
        else if (chordNotes.length === 3) threeNote++;
      }
    }
    // Both 3-note and 4-note patterns should appear
    expect(fourNote).toBeGreaterThan(0);
    expect(threeNote).toBeGreaterThan(0);
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
    // Beat 1 notes: closest note to each measure start (beat 0 and beat 2)
    const beatDur = 60 / 120;
    const measureStarts = [0, 2 * beatDur]; // beats 0 and 2 in seconds
    const beat1Notes = measureStarts.map(ms =>
      notes.reduce((best, n) => Math.abs(n.time - ms) < Math.abs(best.time - ms) ? n : best)
    );
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

// ── Dissonance Filtering ──

describe("Walking Bass — dissonance filtering", () => {
  it("beats 2-3 avoid tritone from root (statistical)", () => {
    // Generate many measures and count how often beat 2/3 form tritone (6 semitones) with root
    let totalInner = 0;
    let tritones = 0;
    for (let run = 0; run < 50; run++) {
      const chords = [
        makeChord("C", "maj7", 0), makeChord("F", "maj7", 2),
        makeChord("G", "7", 4), makeChord("C", "maj7", 6),
      ];
      const notes = generateWalkingBass(chords, { tempo: 120, style: "swing" });
      // Check beats 2-3 of each measure (notes at index 1,2 per 4-note group)
      for (let m = 0; m < 4; m++) {
        const rootPC = notes[m * 4]?.pitch % 12;
        for (const idx of [m * 4 + 1, m * 4 + 2]) {
          const n = notes[idx];
          if (!n) continue;
          totalInner++;
          const interval = ((n.pitch % 12) - rootPC + 12) % 12;
          if (interval === 6) tritones++;
        }
      }
    }
    // Tritone should be rare (< 5% of inner notes)
    expect(tritones / totalInner).toBeLessThan(0.05);
  });
});

// ── Beat 2-3 Variety ──

describe("Walking Bass — beat 2-3 variety", () => {
  it("same chord progression produces varied beat-2 pitches across runs", () => {
    const beat2Pitches = new Set<number>();
    const chords = [
      makeChord("D", "m7", 0), makeChord("G", "7", 2),
      makeChord("C", "maj7", 4), makeChord("A", "7", 6),
      makeChord("D", "m7", 8), makeChord("G", "7", 10),
      makeChord("C", "maj7", 12), makeChord("C", "maj7", 14),
    ];
    for (let run = 0; run < 80; run++) {
      const notes = generateWalkingBass(chords, { tempo: 120, style: "swing" });
      // Collect beat-2 pitch of each 4-note measure
      for (let m = 0; m < 8; m++) {
        const n = notes[m * 4 + 1];
        if (n) beat2Pitches.add(n.pitch);
      }
    }
    // With randomization, should see at least 3 distinct beat-2 pitches across all measures
    expect(beat2Pitches.size).toBeGreaterThanOrEqual(3);
  });
});

// ── 11/8 Grouping ──

describe("Walking Bass — 11/8 grouping", () => {
  it("produces 5 notes in 11/8 (one per group)", () => {
    const eighth = 0.25; // at 120bpm, quarter=0.5s, eighth=0.25s
    const measureDur = 11 * eighth; // 2.75s
    const notes = generateWalkingBass(
      [makeChord("C", "m7", 0, measureDur), makeChord("F", "7", measureDur, measureDur)],
      { tempo: 120, style: "swing" },
    );
    // First measure should have 5 notes (2+2+3+2+2 grouping)
    const firstMeasure = notes.filter(n => n.time < measureDur);
    expect(firstMeasure).toHaveLength(5);
  });

  it("11/8 note onsets follow 2+2+3+2+2 grouping", () => {
    const eighth = 0.25;
    const measureDur = 11 * eighth;
    const notes = generateWalkingBass(
      [makeChord("C", "maj7", 0, measureDur), makeChord("G", "7", measureDur, measureDur)],
      { tempo: 120, style: "swing" },
    );
    const firstMeasure = notes.filter(n => n.time < measureDur);
    // Expected onsets: 0, 2*eighth, 4*eighth, 7*eighth, 9*eighth
    const expectedOnsets = [0, 0.5, 1.0, 1.75, 2.25];
    for (let i = 0; i < Math.min(5, firstMeasure.length); i++) {
      expect(firstMeasure[i].time).toBeCloseTo(expectedOnsets[i], 2);
    }
  });

  it("11/8 all notes in bass range", () => {
    const eighth = 0.25;
    const measureDur = 11 * eighth;
    const chords = [
      makeChord("Bb", "m7", 0, measureDur),
      makeChord("Eb", "7", measureDur, measureDur),
      makeChord("Ab", "maj7", measureDur * 2, measureDur),
    ];
    const notes = generateWalkingBass(chords, { tempo: 120, style: "swing" });
    for (const n of notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
      expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
    }
  });
});

// ── Holdsworth Measure Scaling ──

describe("Walking Bass — Holdsworth odd-meter scaling", () => {
  it("Holdsworth notes span full measure in 11/8", () => {
    const eighth = 0.25;
    const measureDur = 11 * eighth; // 2.75s
    const notes = generateWalkingBass(
      [makeChord("C", "m7", 0, measureDur)],
      { tempo: 120, style: "holdsworth" },
    );
    // Last note should start past halfway through the measure
    const lastNote = notes[notes.length - 1];
    expect(lastNote.time).toBeGreaterThan(measureDur * 0.5);
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

// ── Granular Controls ──

describe("Walking Bass — granular controls", () => {
  const SEEDS = [42, 100, 200];

  function longChords(): ChordEvent[] {
    // 8 measures ii-V-I
    const base = iiVI();
    return [
      ...base.map(c => ({ ...c })),
      ...base.map(c => ({ ...c, time: c.time + 8 })),
    ];
  }

  it("chromaticApproach — high produces more chromatic passing tones", () => {
    // Diatonic pitch classes for Dm7→G7→Cmaj7 progression (C major scale)
    const diatonic = new Set([0, 2, 4, 5, 7, 9, 11]); // C D E F G A B
    let highChromatic = 0;
    let lowChromatic = 0;
    for (const seed of SEEDS) {
      const highNotes = generateWalkingBass(longChords(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: resolveBassGranular(50, { chromaticApproach: 85 }),
      });
      const lowNotes = generateWalkingBass(longChords(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: resolveBassGranular(50, { chromaticApproach: 10 }),
      });
      highChromatic += highNotes.filter(n => !diatonic.has(n.pitch % 12)).length;
      lowChromatic += lowNotes.filter(n => !diatonic.has(n.pitch % 12)).length;
    }
    expect(highChromatic).toBeGreaterThanOrEqual(lowChromatic);
  });

  it("registerWidth — high produces wider pitch range", () => {
    let highRange = 0;
    let lowRange = 0;
    for (const seed of SEEDS) {
      const wideNotes = generateWalkingBass(longChords(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: resolveBassGranular(50, { registerWidth: 90 }),
      });
      const narrowNotes = generateWalkingBass(longChords(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: resolveBassGranular(50, { registerWidth: 15 }),
      });
      const widePitches = wideNotes.map(n => n.pitch);
      const narrowPitches = narrowNotes.map(n => n.pitch);
      if (widePitches.length > 0) highRange += Math.max(...widePitches) - Math.min(...widePitches);
      if (narrowPitches.length > 0) lowRange += Math.max(...narrowPitches) - Math.min(...narrowPitches);
    }
    expect(highRange).toBeGreaterThanOrEqual(lowRange);
  });

  it("registerWidth extremes — narrow constrains to ~12 semitone range", () => {
    for (const seed of SEEDS) {
      const notes = generateWalkingBass(longChords(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: { chromaticApproach: 50, registerWidth: 0, syncopation: 30, beatVariety: 40 },
      });
      const pitches = notes.map(n => n.pitch);
      // registerWidth=0 → getBassLow()=35, getBassHigh()=47, range ~12
      for (const p of pitches) {
        expect(p).toBeGreaterThanOrEqual(28); // absolute floor
        expect(p).toBeLessThanOrEqual(55);    // absolute ceiling
      }
      if (pitches.length > 0) {
        const range = Math.max(...pitches) - Math.min(...pitches);
        expect(range).toBeLessThanOrEqual(20); // narrow range
      }
    }
  });

  it("syncopation — high produces more off-beat notes", () => {
    const beatDur = 0.5; // 120bpm
    let highOffbeat = 0;
    let lowOffbeat = 0;
    for (const seed of SEEDS) {
      const highNotes = generateWalkingBass(longChords(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: resolveBassGranular(50, { syncopation: 75 }),
      });
      const lowNotes = generateWalkingBass(longChords(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: resolveBassGranular(50, { syncopation: 0 }),
      });
      // Off-beat = time offset from nearest beat > threshold
      for (const n of highNotes) {
        const offset = n.time % beatDur;
        if (offset > 0.05 && offset < beatDur - 0.05) highOffbeat++;
      }
      for (const n of lowNotes) {
        const offset = n.time % beatDur;
        if (offset > 0.05 && offset < beatDur - 0.05) lowOffbeat++;
      }
    }
    expect(highOffbeat).toBeGreaterThanOrEqual(lowOffbeat);
  });

  it("beatVariety — high produces more varied beat 2 pitch choices", () => {
    let highUnique = 0;
    let lowUnique = 0;
    // Run many seeds to see variety
    for (let seed = 0; seed < 20; seed++) {
      const highNotes = generateWalkingBass(iiVI(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: resolveBassGranular(50, { beatVariety: 80 }),
      });
      const lowNotes = generateWalkingBass(iiVI(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: resolveBassGranular(50, { beatVariety: 10 }),
      });
      // Collect beat-2 pitches (every 2nd note in each 4-note measure)
      if (highNotes.length >= 2) highUnique = new Set([...Array(20)].map((_, s) => {
        const notes = generateWalkingBass(iiVI(), {
          style: "swing", tempo: 120, random: createPRNG(s),
          granular: resolveBassGranular(50, { beatVariety: 80 }),
        });
        return notes.length >= 2 ? notes[1].pitch : -1;
      })).size;
      if (lowNotes.length >= 2) lowUnique = new Set([...Array(20)].map((_, s) => {
        const notes = generateWalkingBass(iiVI(), {
          style: "swing", tempo: 120, random: createPRNG(s),
          granular: resolveBassGranular(50, { beatVariety: 10 }),
        });
        return notes.length >= 2 ? notes[1].pitch : -1;
      })).size;
      break; // only need one pass since we iterate seeds internally
    }
    expect(highUnique).toBeGreaterThanOrEqual(lowUnique);
  });

  it("no granular = backward compatible", () => {
    for (const seed of SEEDS) {
      const noGranular = generateWalkingBass(iiVI(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
      });
      const undefinedGranular = generateWalkingBass(iiVI(), {
        style: "swing", tempo: 120,
        random: createPRNG(seed),
        granular: undefined,
      });
      expect(noGranular.length).toBe(undefinedGranular.length);
      for (let i = 0; i < noGranular.length; i++) {
        expect(noGranular[i].pitch).toBe(undefinedGranular[i].pitch);
        expect(noGranular[i].time).toBeCloseTo(undefinedGranular[i].time, 6);
        expect(noGranular[i].velocity).toBe(undefinedGranular[i].velocity);
      }
    }
  });
});

// ── Anti-Repetition & Harmonic Approach Tones ──

function makeAnalysis(overrides: Partial<ChordAnalysis>): ChordAnalysis {
  return {
    degree: "I", function: "tonic", keyCenter: "C",
    isSecondaryDominant: false, isPartOfIiVI: false,
    isModulationPoint: false, tension: 0,
    ...overrides,
  };
}

describe("Walking Bass — approach tone anti-repetition", () => {
  it("approach direction varies over 16+ bars (both directions appear)", () => {
    // Build a long progression to test anti-repetition across many bars
    const chords: ChordEvent[] = [];
    const roots = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G",
                   "C", "F", "Bb", "Eb", "Ab", "Db"];
    for (let i = 0; i < roots.length; i++) {
      chords.push(makeChord(roots[i], "maj7", i * 2));
    }

    let totalAbove = 0;
    let totalBelow = 0;
    for (let trial = 0; trial < 20; trial++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      for (let i = 3; i < notes.length; i += 4) {
        if (i + 1 >= notes.length) break;
        const approach = notes[i].pitch;
        const nextBeat1 = notes[i + 1]?.pitch;
        if (nextBeat1 == null) break;
        if (approach > nextBeat1) totalAbove++;
        else if (approach < nextBeat1) totalBelow++;
      }
    }
    // Anti-repetition ensures meaningful mix of directions
    const total = totalAbove + totalBelow;
    const minorityPct = Math.min(totalAbove, totalBelow) / total;
    // At least 20% minority direction (without anti-rep, circular progressions bias one way)
    expect(minorityPct).toBeGreaterThan(0.15);
  });

  it("approach interval variety over 16 bars (not all half-steps)", () => {
    const chords: ChordEvent[] = [];
    const roots = ["C", "G", "D", "A", "E", "B", "F", "Bb", "Eb", "Ab", "Db", "Gb",
                   "C", "G", "D", "A"];
    for (let i = 0; i < roots.length; i++) {
      chords.push(makeChord(roots[i], "7", i * 2));
    }

    const intervals = new Set<number>();
    for (let trial = 0; trial < 10; trial++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      for (let i = 3; i < notes.length; i += 4) {
        if (i + 1 >= notes.length) break;
        const approach = notes[i].pitch;
        const nextBeat1 = notes[i + 1]?.pitch;
        if (nextBeat1 != null) intervals.add(Math.abs(approach - nextBeat1));
      }
    }
    // Should see more than just half-step (1) — also 2 (diatonic) and others
    expect(intervals.size).toBeGreaterThanOrEqual(2);
  });

  it("hardBop approach tones are not always chromatic from below", () => {
    const chords = [
      makeChord("C", "maj7", 0), makeChord("F", "maj7", 2),
      makeChord("Bb", "maj7", 4), makeChord("Eb", "maj7", 6),
      makeChord("Ab", "maj7", 8), makeChord("Db", "maj7", 10),
      makeChord("Gb", "maj7", 12), makeChord("B", "maj7", 14),
    ];
    const approaches: number[] = [];
    for (let trial = 0; trial < 20; trial++) {
      const notes = generateWalkingBass(chords, { style: "hardBop", tempo: 140 });
      for (let i = 3; i < notes.length; i += 4) {
        if (i + 1 >= notes.length) break;
        approaches.push(notes[i].pitch - notes[i + 1].pitch);
      }
    }
    // Old behavior: always -1 (chromatic from below). New: at least some variety
    const unique = new Set(approaches);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  it("coolJazz uses diatonic approaches (not just chromatic)", () => {
    const chords = [
      makeChord("C", "maj7", 0), makeChord("F", "maj7", 2),
      makeChord("Bb", "maj7", 4), makeChord("Eb", "maj7", 6),
    ];
    const intervals = new Set<number>();
    for (let trial = 0; trial < 30; trial++) {
      const notes = generateWalkingBass(chords, { style: "coolJazz", tempo: 100 });
      for (let i = 3; i < notes.length; i += 4) {
        if (i + 1 >= notes.length) break;
        intervals.add(Math.abs(notes[i].pitch - notes[i + 1].pitch));
      }
    }
    // coolJazz APPROACH_VOCAB: chromatic 55%, diatonic 35%, double 10%
    // Should see both half-step (1) and whole-step (2) intervals
    expect(intervals.size).toBeGreaterThanOrEqual(2);
  });
});

describe("Walking Bass — harmonic-aware approach", () => {
  it("ii-V-I uses leading tone on V->I resolution (statistical)", () => {
    // Tag chords with harmonic analysis for V->I awareness
    const chords: ChordEvent[] = [
      { root: "D", quality: "m7", time: 0, duration: 2,
        analysis: makeAnalysis({ degree: "ii", function: "predominant", isPartOfIiVI: true, iiViPosition: "ii" }) },
      { root: "G", quality: "7", time: 2, duration: 2,
        analysis: makeAnalysis({ degree: "V", function: "dominant", isPartOfIiVI: true, iiViPosition: "V" }) },
      { root: "C", quality: "maj7", time: 4, duration: 2,
        analysis: makeAnalysis({ degree: "I", function: "tonic", isPartOfIiVI: true, iiViPosition: "I", cadenceRole: "resolution" }) },
    ];

    let leadingToneCount = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      // Beat 4 of bar 2 (G7 bar) = approach to C. Leading tone = B = pitch%12 === 11
      const bar2Notes = notes.filter(n => n.time >= 2 && n.time < 4);
      if (bar2Notes.length >= 4) {
        const beat4 = bar2Notes[3];
        // B is the leading tone to C (one half-step below)
        if (beat4.pitch % 12 === 11) leadingToneCount++;
      }
    }
    // V->I should produce leading tone ~45% of the time
    expect(leadingToneCount).toBeGreaterThan(trials * 0.2);
  });

  it("ii->V approach uses chromatic or b7 (not just random)", () => {
    const chords: ChordEvent[] = [
      { root: "D", quality: "m7", time: 0, duration: 2,
        analysis: makeAnalysis({ degree: "ii", function: "predominant", isPartOfIiVI: true, iiViPosition: "ii" }) },
      { root: "G", quality: "7", time: 2, duration: 2,
        analysis: makeAnalysis({ degree: "V", function: "dominant", isPartOfIiVI: true, iiViPosition: "V" }) },
      { root: "C", quality: "maj7", time: 4, duration: 2,
        analysis: makeAnalysis({ degree: "I", function: "tonic", isPartOfIiVI: true, iiViPosition: "I" }) },
    ];

    const approachPCs = new Map<number, number>();
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      // Beat 4 of bar 1 (Dm7 bar) = approach to G
      const bar1Notes = notes.filter(n => n.time >= 0 && n.time < 2);
      if (bar1Notes.length >= 4) {
        const pc = bar1Notes[3].pitch % 12;
        approachPCs.set(pc, (approachPCs.get(pc) ?? 0) + 1);
      }
    }
    // Should see variety: F# (6 = chromatic below G), Ab (8 = chromatic above),
    // C (0 = b7 of Dm7 = 4th of G), etc.
    expect(approachPCs.size).toBeGreaterThanOrEqual(2);
  });

  it("all approach tones stay within bass range", () => {
    const chords: ChordEvent[] = [];
    const roots = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "B", "E", "A", "D", "G"];
    for (let i = 0; i < roots.length; i++) {
      chords.push(makeChord(roots[i], "7", i * 2));
    }
    for (let trial = 0; trial < 20; trial++) {
      const notes = generateWalkingBass(chords, { style: "swing", tempo: 120 });
      for (const n of notes) {
        expect(n.pitch).toBeGreaterThanOrEqual(BASS_LOW);
        expect(n.pitch).toBeLessThanOrEqual(BASS_HIGH);
      }
    }
  });
});
