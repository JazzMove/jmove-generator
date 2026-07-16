/**
 * Jazz Musicality Tests — validate that bass lines and piano comping
 * produce correct, idiomatic jazz output over real standard progressions.
 *
 * Tests encode well-known jazz theory rules:
 * 1. Bass notes must belong to the chord's scale or be chromatic approaches
 * 2. Piano voicings must contain correct chord tones (3rd, 7th especially)
 * 3. ii-V-I patterns must resolve correctly
 * 4. No "wrong notes" (notes outside chord + passing tones)
 *
 * Standards cover:
 * - ii-V-I in major/minor (Autumn Leaves, All The Things)
 * - Minor blues (Summertime, Blue Bossa)
 * - Rhythm changes (I Got Rhythm bridge)
 * - Modal (So What, Impressions)
 * - Ballad (Body and Soul)
 * - Latin (Girl From Ipanema, Black Orpheus)
 * - Chromatic motion (Giant Steps, Moment's Notice)
 * - Standard blues (Bb Blues, Freddie Freeloader)
 * - Turnarounds (Satin Doll, Take the A Train)
 */

import { describe, it, expect } from "vitest";
import {
  generateWalkingBass,
  generatePianoComping,
  type ChordEvent,
} from "../src/index";
type CompChordEvent = ChordEvent;

// ── Helpers ──

function makeProgression(
  chords: [string, string][],
  tempo: number,
  barsPerChord = 1,
): ChordEvent[] {
  const beatDur = 60 / tempo;
  const bar = beatDur * 4;
  return chords.map(([root, quality], i) => ({
    root,
    quality,
    time: i * barsPerChord * bar,
    duration: barsPerChord * bar,
  }));
}

// ── 20 Real Jazz Standards ──

/** 1. Summertime (Gershwin) — Am minor blues */
const summertime = () => makeProgression([
  ["A", "m7"], ["A", "m7"], ["E", "7"], ["A", "m7"],
  ["D", "m7"], ["A", "m7"], ["E", "7"], ["A", "m7"],
], 120);

/** 2. Autumn Leaves — ii-V-I in Bb major / Gm */
const autumnLeaves = () => makeProgression([
  ["C", "m7"], ["F", "7"], ["Bb", "maj7"], ["Eb", "maj7"],
  ["A", "m7b5"], ["D", "7b9"], ["G", "m7"], ["G", "m7"],
], 140);

/** 3. All The Things You Are — complex key centers */
const allTheThings = () => makeProgression([
  ["F", "m7"], ["Bb", "m7"], ["Eb", "7"], ["Ab", "maj7"],
  ["Db", "maj7"], ["G", "7"], ["C", "maj7"], ["C", "maj7"],
  ["C", "m7"], ["F", "m7"], ["Bb", "7"], ["Eb", "maj7"],
  ["Ab", "maj7"], ["D", "7"], ["G", "maj7"], ["G", "maj7"],
], 160);

/** 4. Blue Bossa — minor ii-V, Cm */
const blueBossa = () => makeProgression([
  ["C", "m7"], ["C", "m7"], ["F", "m7"], ["F", "m7"],
  ["D", "m7b5"], ["G", "7b9"], ["C", "m7"], ["C", "m7"],
  ["Eb", "m7"], ["Ab", "7"], ["Db", "maj7"], ["Db", "maj7"],
  ["D", "m7b5"], ["G", "7b9"], ["C", "m7"], ["C", "m7"],
], 130);

/** 5. Rhythm Changes bridge — dominant cycle */
const rhythmBridge = () => makeProgression([
  ["D", "7"], ["D", "7"], ["G", "7"], ["G", "7"],
  ["C", "7"], ["C", "7"], ["F", "7"], ["F", "7"],
], 200);

/** 6. So What (Miles Davis) — modal (Dorian) */
const soWhat = () => makeProgression([
  ["D", "m7"], ["D", "m7"], ["D", "m7"], ["D", "m7"],
  ["D", "m7"], ["D", "m7"], ["D", "m7"], ["D", "m7"],
  ["Eb", "m7"], ["Eb", "m7"], ["Eb", "m7"], ["Eb", "m7"],
  ["D", "m7"], ["D", "m7"], ["D", "m7"], ["D", "m7"],
], 140);

/** 7. Girl From Ipanema — bossa nova key changes */
const ipanema = () => makeProgression([
  ["F", "maj7"], ["F", "maj7"], ["G", "7"], ["G", "7"],
  ["G", "m7"], ["Gb", "7"], ["F", "maj7"], ["Gb", "7"],
], 140);

/** 8. Body and Soul — ballad, rich harmony */
const bodyAndSoul = () => makeProgression([
  ["Eb", "m7"], ["Bb", "7b9"], ["Eb", "m7"], ["Eb", "7"],
  ["Ab", "maj7"], ["D", "7"], ["Db", "maj7"], ["Gb", "7"],
], 65);

/** 9. Satin Doll (Ellington) — ii-V turnarounds */
const satinDoll = () => makeProgression([
  ["D", "m7"], ["G", "7"], ["E", "m7"], ["A", "7"],
  ["A", "m7"], ["D", "7"], ["Ab", "m7"], ["Db", "7"],
], 120);

/** 10. Take The A Train — I-II7-ii-V */
const aTrain = () => makeProgression([
  ["C", "maj7"], ["C", "maj7"], ["D", "7"], ["D", "7"],
  ["D", "m7"], ["G", "7"], ["C", "maj7"], ["C", "maj7"],
], 170);

/** 11. Giant Steps (Coltrane) — major third cycle */
const giantSteps = () => makeProgression([
  ["B", "maj7"], ["D", "7"], ["G", "maj7"], ["Bb", "7"],
  ["Eb", "maj7"], ["A", "m7"], ["D", "7"], ["G", "maj7"],
  ["Bb", "7"], ["Eb", "maj7"], ["F#", "7"], ["B", "maj7"],
], 180);

/** 12. Freddie Freeloader — Bb blues (simple dominant) */
const freddieFreeloader = () => makeProgression([
  ["Bb", "7"], ["Bb", "7"], ["Bb", "7"], ["Bb", "7"],
  ["Eb", "7"], ["Eb", "7"], ["Bb", "7"], ["Bb", "7"],
  ["F", "7"], ["Eb", "7"], ["Bb", "7"], ["F", "7"],
], 130);

/** 13. Stella By Starlight — complex chromatic motion */
const stella = () => makeProgression([
  ["E", "m7b5"], ["A", "7b9"], ["C", "m7"], ["F", "7"],
  ["F", "m7"], ["Bb", "7"], ["Eb", "maj7"], ["Ab", "7"],
  ["Bb", "maj7"], ["E", "m7b5"], ["A", "7b9"], ["D", "m7"],
], 130);

/** 14. Misty — romantic standard, Eb major */
const misty = () => makeProgression([
  ["Eb", "maj7"], ["Bb", "m7"], ["Eb", "7"], ["Ab", "maj7"],
  ["Ab", "m7"], ["Db", "7"], ["Eb", "maj7"], ["C", "m7"],
  ["F", "m7"], ["Bb", "7"], ["G", "m7"], ["C", "7b9"],
], 80);

/** 15. Black Orpheus (Manha de Carnaval) — Am bossa */
const blackOrpheus = () => makeProgression([
  ["A", "m7"], ["B", "m7b5"], ["E", "7b9"], ["A", "m7"],
  ["D", "m7"], ["G", "7"], ["C", "maj7"], ["F", "maj7"],
  ["B", "m7b5"], ["E", "7b9"], ["A", "m7"], ["A", "m7"],
], 140);

/** 16. There Will Never Be Another You — Eb standard */
const neverBeAnother = () => makeProgression([
  ["Eb", "maj7"], ["Eb", "maj7"], ["D", "m7b5"], ["G", "7b9"],
  ["C", "m7"], ["C", "m7"], ["Bb", "m7"], ["Eb", "7"],
  ["Ab", "maj7"], ["Ab", "maj7"], ["A", "m7b5"], ["D", "7b9"],
  ["Eb", "maj7"], ["C", "m7"], ["F", "m7"], ["Bb", "7"],
], 150);

/** 17. My Funny Valentine — Cm ballad */
const funnyValentine = () => makeProgression([
  ["C", "m7"], ["C", "m7"], ["Ab", "maj7"], ["Ab", "maj7"],
  ["F", "m7"], ["F", "m7"], ["D", "m7b5"], ["G", "7b9"],
  ["C", "m7"], ["Bb", "7"], ["Eb", "maj7"], ["Ab", "maj7"],
], 70);

/** 18. Solar (Miles Davis) — Cm cycling through keys */
const solar = () => makeProgression([
  ["C", "m7"], ["C", "m7"], ["G", "m7"], ["C", "7"],
  ["F", "maj7"], ["F", "maj7"], ["F", "m7"], ["Bb", "7"],
  ["Eb", "maj7"], ["Eb", "m7b5"], ["A", "7b9"], ["D", "m7"],
], 160);

/** 19. Fly Me To The Moon — C major circle of fifths */
const flyMeToMoon = () => makeProgression([
  ["A", "m7"], ["D", "m7"], ["G", "7"], ["C", "maj7"],
  ["F", "maj7"], ["B", "m7b5"], ["E", "7b9"], ["A", "m7"],
  ["D", "m7"], ["G", "7"], ["C", "maj7"], ["A", "7"],
], 130);

/** 20. Night And Day (Cole Porter) — chromatic bass motion */
const nightAndDay = () => makeProgression([
  ["Ab", "maj7"], ["Ab", "maj7"], ["G", "7"], ["G", "7"],
  ["C", "maj7"], ["C", "maj7"], ["Eb", "m7"], ["Eb", "m7"],
  ["D", "m7"], ["G", "7"], ["C", "maj7"], ["C", "maj7"],
], 150);

// ── All standards in one array for batch testing ──

const ALL_STANDARDS = [
  { name: "Summertime", chords: summertime, tempo: 120 },
  { name: "Autumn Leaves", chords: autumnLeaves, tempo: 140 },
  { name: "All The Things", chords: allTheThings, tempo: 160 },
  { name: "Blue Bossa", chords: blueBossa, tempo: 130 },
  { name: "Rhythm Changes Bridge", chords: rhythmBridge, tempo: 200 },
  { name: "So What", chords: soWhat, tempo: 140 },
  { name: "Girl From Ipanema", chords: ipanema, tempo: 140 },
  { name: "Body and Soul", chords: bodyAndSoul, tempo: 65 },
  { name: "Satin Doll", chords: satinDoll, tempo: 120 },
  { name: "Take The A Train", chords: aTrain, tempo: 170 },
  { name: "Giant Steps", chords: giantSteps, tempo: 180 },
  { name: "Freddie Freeloader", chords: freddieFreeloader, tempo: 130 },
  { name: "Stella By Starlight", chords: stella, tempo: 130 },
  { name: "Misty", chords: misty, tempo: 80 },
  { name: "Black Orpheus", chords: blackOrpheus, tempo: 140 },
  { name: "There Will Never Be...", chords: neverBeAnother, tempo: 150 },
  { name: "My Funny Valentine", chords: funnyValentine, tempo: 70 },
  { name: "Solar", chords: solar, tempo: 160 },
  { name: "Fly Me To The Moon", chords: flyMeToMoon, tempo: 130 },
  { name: "Night And Day", chords: nightAndDay, tempo: 150 },
];

// ── Theory Helpers ──

const ROOT_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11,
};

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],
};

function getScale(quality: string): number[] {
  if (quality.includes("maj7") || quality === "6" || quality === "69") return SCALES.major;
  if (quality.includes("m7b5")) return SCALES.locrian;
  if (quality.includes("dim")) return SCALES.diminished;
  if (quality.startsWith("m") && !quality.startsWith("maj")) return SCALES.dorian;
  if (quality.includes("7") || quality === "9" || quality === "13") return SCALES.mixolydian;
  return SCALES.major;
}

/** Get ALL valid pitch classes for a chord (scale + chromatic neighbors for approach). */
function getValidPitchClasses(root: string, quality: string): Set<number> {
  const rootPC = ROOT_SEMITONES[root];
  const valid = new Set<number>();
  const scale = getScale(quality);
  for (const interval of scale) valid.add((rootPC + interval) % 12);
  // Chromatic approaches to any scale tone
  for (const interval of scale) {
    valid.add((rootPC + interval + 1) % 12);
    valid.add((rootPC + interval - 1 + 12) % 12);
  }
  return valid;
}

function getChordIntervals(quality: string): number[] {
  if (quality.includes("maj7")) return [0, 4, 7, 11];
  if (quality.includes("m7b5")) return [0, 3, 6, 10];
  if (quality.includes("m7") || quality.includes("m9") || quality.includes("m11")) return [0, 3, 7, 10];
  if (quality.includes("dim7")) return [0, 3, 6, 9];
  if (quality === "m" || quality === "m6") return [0, 3, 7];
  if (quality.includes("7") || quality === "9" || quality === "13") return [0, 4, 7, 10];
  if (quality.includes("aug")) return [0, 4, 8];
  if (quality.includes("sus")) return [0, 5, 7, 10];
  return [0, 4, 7];
}

// ── Time-based note lookup (enclosures produce 5 notes/bar, so index-based [bar*4] breaks) ──

/** Find bass note closest to chord's start time (within tolerance). */
function findBeat1(notes: { pitch: number; time: number }[], chordTime: number, tolerance = 0.15): typeof notes[0] | undefined {
  let best: typeof notes[0] | undefined;
  let bestDist = tolerance;
  for (const n of notes) {
    const d = Math.abs(n.time - chordTime);
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

/** Find the last bass note before a given time (beat 4 / approach note). */
function findLastNoteBefore(notes: { pitch: number; time: number }[], nextChordTime: number, tolerance = 0.05): typeof notes[0] | undefined {
  let best: typeof notes[0] | undefined;
  for (const n of notes) {
    if (n.time < nextChordTime - tolerance) best = n;
  }
  return best;
}

/** Get all bass notes within a chord's time window. */
function getNotesInChord(notes: { pitch: number; time: number }[], chordTime: number, chordDuration: number): typeof notes {
  return notes.filter(n => n.time >= chordTime - 0.05 && n.time < chordTime + chordDuration - 0.05);
}


// ═══════════════════════════════════════════════════
// WALKING BASS TESTS
// ═══════════════════════════════════════════════════

describe("Walking Bass — beat 1 is always root or 5th (all 20 standards)", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords();
      for (let trial = 0; trial < 10; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let bar = 0; bar < chords.length; bar++) {
          const beat1 = findBeat1(notes, chords[bar].time);
          if (!beat1) continue;
          // Root or 5th specifically
          const rootPC = ROOT_SEMITONES[chords[bar].root];
          const fifthPC = (rootPC + 7) % 12;
          const pc = beat1.pitch % 12;
          expect(
            pc === rootPC || pc === fifthPC,
            `Trial ${trial} bar ${bar}: beat 1 PC=${pc}, expected root=${rootPC} or 5th=${fifthPC} (${chords[bar].root}${chords[bar].quality})`
          ).toBe(true);
        }
      }
    });
  }
});

describe("Walking Bass — wrong note rate < 10% across all standards", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}: < 10% non-scale tones`, () => {
      const chords = std.chords();
      let total = 0;
      let wrong = 0;

      for (let trial = 0; trial < 15; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let bar = 0; bar < chords.length; bar++) {
          const validPCs = getValidPitchClasses(chords[bar].root, chords[bar].quality);
          const barNotes = getNotesInChord(notes, chords[bar].time, chords[bar].duration);
          for (const note of barNotes) {
            total++;
            if (!validPCs.has(note.pitch % 12)) wrong++;
          }
        }
      }

      const rate = wrong / total;
      expect(rate, `Wrong note rate: ${(rate * 100).toFixed(1)}% (${wrong}/${total})`).toBeLessThan(0.10);
    });
  }
});

describe("Walking Bass — approach notes resolve within 5 semitones", () => {
  // Diatonic approach (whole step) + enclosure chromatic neighbors + register shift = max 5
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords();
      for (let trial = 0; trial < 10; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let bar = 0; bar < chords.length - 1; bar++) {
          const lastNote = findLastNoteBefore(notes, chords[bar + 1].time);
          const nextBeat1 = findBeat1(notes, chords[bar + 1].time);
          if (!lastNote || !nextBeat1) continue;
          const dist = Math.abs(lastNote.pitch - nextBeat1.pitch);
          expect(
            dist,
            `Trial ${trial} bar ${bar}→${bar + 1}: approach ${lastNote.pitch}→${nextBeat1.pitch} = ${dist}`
          ).toBeLessThanOrEqual(5);
        }
      }
    });
  }
});

describe("Walking Bass — no repeated adjacent pitches", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords();
      for (let trial = 0; trial < 10; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let i = 1; i < notes.length; i++) {
          expect(
            notes[i].pitch,
            `Trial ${trial} note ${i}: repeated ${notes[i].pitch}`
          ).not.toBe(notes[i - 1].pitch);
        }
      }
    });
  }
});

describe("Walking Bass — stepwise motion > 60%", () => {
  it("across all 20 standards combined", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords();
      let totalIntervals = 0;
      let stepwise = 0;

      for (let trial = 0; trial < 10; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let i = 1; i < notes.length; i++) {
          totalIntervals++;
          if (Math.abs(notes[i].pitch - notes[i - 1].pitch) <= 4) stepwise++;
        }
      }

      const rate = stepwise / totalIntervals;
      expect(
        rate,
        `${std.name}: stepwise ${(rate * 100).toFixed(1)}%`
      ).toBeGreaterThan(0.60);
    }
  });
});

describe("Walking Bass — register continuity (no jumps > 9 between bars)", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords();
      for (let trial = 0; trial < 10; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let bar = 1; bar < chords.length; bar++) {
          const prevLast = findLastNoteBefore(notes, chords[bar].time);
          const currFirst = findBeat1(notes, chords[bar].time);
          if (!prevLast || !currFirst) continue;
          const jump = Math.abs(currFirst.pitch - prevLast.pitch);
          expect(
            jump,
            `Trial ${trial} bar ${bar - 1}→${bar}: ${prevLast.pitch}→${currFirst.pitch} = ${jump}`
          ).toBeLessThanOrEqual(9);
        }
      }
    });
  }
});

describe("Walking Bass — range always E1-G3 (MIDI 28-55)", () => {
  it("across all 20 standards", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords();
      const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
      for (const n of notes) {
        expect(n.pitch, `${std.name}: out of range ${n.pitch}`).toBeGreaterThanOrEqual(28);
        expect(n.pitch, `${std.name}: out of range ${n.pitch}`).toBeLessThanOrEqual(55);
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// PIANO COMPING TESTS
// ═══════════════════════════════════════════════════

describe("Piano Comping — guide tones (3rd + 7th) present in all voicings", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords() as CompChordEvent[];
      for (let trial = 0; trial < 5; trial++) {
        const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });
        for (const chord of chords) {
          const chordNotes = notes.filter(
            n => n.time >= chord.time - 0.001 && n.time < chord.time + chord.duration - 0.001
          );
          if (chordNotes.length === 0) continue;

          const rootPC = ROOT_SEMITONES[chord.root];
          const intervals = getChordIntervals(chord.quality);
          const thirdPC = (rootPC + intervals[1]) % 12;
          const seventhPC = intervals.length >= 4 ? (rootPC + intervals[3]) % 12 : null;

          const pcs = new Set(chordNotes[0].pitches.map(p => p % 12));

          expect(
            pcs.has(thirdPC),
            `Trial ${trial}, ${chord.root}${chord.quality}: missing 3rd (PC ${thirdPC}) in [${[...pcs]}]`
          ).toBe(true);

          if (seventhPC !== null) {
            expect(
              pcs.has(seventhPC),
              `Trial ${trial}, ${chord.root}${chord.quality}: missing 7th (PC ${seventhPC}) in [${[...pcs]}]`
            ).toBe(true);
          }
        }
      }
    });
  }
});

describe("Piano Comping — no semitone clusters in voicings", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords() as CompChordEvent[];
      const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
      for (const note of notes) {
        const sorted = [...note.pitches].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
          expect(
            sorted[i] - sorted[i - 1],
            `${std.name}: semitone cluster [${sorted}]`
          ).toBeGreaterThanOrEqual(2);
        }
      }
    });
  }
});

describe("Piano Comping — voicing span ≤ 15 semitones", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords() as CompChordEvent[];
      const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
      for (const note of notes) {
        const sorted = [...note.pitches].sort((a, b) => a - b);
        const span = sorted[sorted.length - 1] - sorted[0];
        expect(span, `${std.name}: span ${span}`).toBeLessThanOrEqual(15);
      }
    });
  }
});

describe("Piano Comping — root never as lowest note (rootless voicings)", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords() as CompChordEvent[];
      for (let trial = 0; trial < 5; trial++) {
        const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });
        for (const chord of chords) {
          const chordNotes = notes.filter(
            n => n.time >= chord.time - 0.001 && n.time < chord.time + chord.duration - 0.001
          );
          if (chordNotes.length === 0) continue;

          const rootPC = ROOT_SEMITONES[chord.root];
          const sorted = [...chordNotes[0].pitches].sort((a, b) => a - b);
          expect(
            sorted[0] % 12,
            `Trial ${trial}, ${chord.root}${chord.quality}: root as lowest note`
          ).not.toBe(rootPC);
        }
      }
    });
  }
});

describe("Piano Comping — voice leading: avg motion < 4 semitones per voice", () => {
  for (const std of ALL_STANDARDS) {
    it(`${std.name}`, () => {
      const chords = std.chords() as CompChordEvent[];
      let totalMotion = 0;
      let transitions = 0;

      for (let trial = 0; trial < 5; trial++) {
        const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });
        for (let i = 1; i < notes.length; i++) {
          if (notes[i].pitches.length !== notes[i - 1].pitches.length) continue;
          const prev = [...notes[i - 1].pitches].sort((a, b) => a - b);
          const curr = [...notes[i].pitches].sort((a, b) => a - b);
          let motion = 0;
          for (let j = 0; j < prev.length; j++) motion += Math.abs(curr[j] - prev[j]);
          totalMotion += motion / prev.length;
          transitions++;
        }
      }

      if (transitions === 0) return;
      const avg = totalMotion / transitions;
      expect(avg, `${std.name}: avg motion ${avg.toFixed(2)}`).toBeLessThan(4.0);
    });
  }
});

describe("Piano Comping — ≥3 distinct pitch classes per voicing", () => {
  it("across all 20 standards", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords() as CompChordEvent[];
      // Use ballad to avoid broken voicings (which split 4-note chords into 2-note groups)
      const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });
      for (const note of notes) {
        const distinctPCs = new Set(note.pitches.map(p => p % 12));
        expect(
          distinctPCs.size,
          `${std.name}: only ${distinctPCs.size} PCs`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("Piano Comping — range within G3-C6 (MIDI 55-84)", () => {
  it("across all 20 standards", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords() as CompChordEvent[];
      const notes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
      for (const note of notes) {
        for (const p of note.pitches) {
          expect(p, `${std.name}: below range ${p}`).toBeGreaterThanOrEqual(55);
          expect(p, `${std.name}: above range ${p}`).toBeLessThanOrEqual(84);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// COMBINED COHERENCE TESTS
// ═══════════════════════════════════════════════════

describe("Combined — bass + piano harmonic agreement", () => {
  it("bass beat 1 matches chord root/5th across all standards", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords();
      for (let trial = 0; trial < 5; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let bar = 0; bar < chords.length; bar++) {
          const beat1 = findBeat1(notes, chords[bar].time);
          if (!beat1) continue;
          const rootPC = ROOT_SEMITONES[chords[bar].root];
          const fifthPC = (rootPC + 7) % 12;
          const pc = beat1.pitch % 12;
          expect(
            pc === rootPC || pc === fifthPC,
            `${std.name} bar ${bar}: bass ${pc} vs root ${rootPC}/5th ${fifthPC}`
          ).toBe(true);
        }
      }
    }
  });

  it("no dissonant tritone between bass and piano on beat 1 (unless chord has b5)", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords();
      for (let trial = 0; trial < 3; trial++) {
        const bassNotes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        const pianoNotes = generatePianoComping(
          chords as CompChordEvent[], { style: "swing", humanize: false, strum: false }
        );

        for (let bar = 0; bar < chords.length; bar++) {
          const bassBeat1 = findBeat1(bassNotes, chords[bar].time);
          if (!bassBeat1) continue;
          const pianoAtBeat = pianoNotes.filter(
            n => Math.abs(n.time - bassBeat1.time) < 0.15
          );
          if (pianoAtBeat.length === 0) continue;

          const bassPC = bassBeat1.pitch % 12;
          for (const pn of pianoAtBeat) {
            for (const p of pn.pitches) {
              const interval = Math.abs((p % 12) - bassPC);
              const norm = Math.min(interval, 12 - interval);
              if (norm === 6) {
                const q = chords[bar].quality;
                // Tritone valid for: dom7, dim, m7b5, maj7 (#11 lydian)
                const hasFlatFive = q.includes("b5") || q.includes("dim");
                const isMinor = q.startsWith("m") && !q.startsWith("maj");
                // Only flag on pure minor chords where tritone is dissonant
                if (isMinor && !hasFlatFive) {
                  expect(
                    false,
                    `${std.name} bar ${bar} (${chords[bar].root}${q}): bass-piano tritone on minor chord`
                  ).toBe(true);
                }
              }
            }
          }
        }
      }
    }
  });

  it("bass and piano register separation (piano lowest > MIDI 55 always)", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords() as CompChordEvent[];
      const pianoNotes = generatePianoComping(chords, { style: "swing", humanize: false, strum: false });
      for (const pn of pianoNotes) {
        const lowest = Math.min(...pn.pitches);
        expect(lowest, `${std.name}: piano too low ${lowest}`).toBeGreaterThanOrEqual(55);
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// SPECIFIC HARMONIC CORRECTNESS
// ═══════════════════════════════════════════════════

describe("Harmonic correctness — specific chord qualities", () => {
  it("dominant 7th always contains tritone (3rd + b7)", () => {
    const dom7Standards = ALL_STANDARDS.filter(s =>
      s.chords().some(c => c.quality === "7" || c.quality === "9" || c.quality === "13")
    );

    for (const std of dom7Standards) {
      const chords = std.chords() as CompChordEvent[];
      const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });

      for (const chord of chords) {
        if (!["7", "9", "13"].includes(chord.quality)) continue;
        const chordNotes = notes.filter(
          n => n.time >= chord.time - 0.001 && n.time < chord.time + chord.duration - 0.001
        );
        if (chordNotes.length === 0) continue;

        const rootPC = ROOT_SEMITONES[chord.root];
        const thirdPC = (rootPC + 4) % 12;
        const b7PC = (rootPC + 10) % 12;
        const pcs = new Set(chordNotes[0].pitches.map(p => p % 12));

        expect(
          pcs.has(thirdPC) && pcs.has(b7PC),
          `${std.name}: ${chord.root}${chord.quality} missing tritone (3=${thirdPC}, b7=${b7PC}) in [${[...pcs]}]`
        ).toBe(true);
      }
    }
  });

  it("minor 7th always contains b3 and b7", () => {
    const m7Standards = ALL_STANDARDS.filter(s =>
      s.chords().some(c => c.quality === "m7")
    );

    for (const std of m7Standards) {
      const chords = std.chords() as CompChordEvent[];
      const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });

      for (const chord of chords) {
        if (chord.quality !== "m7") continue;
        const chordNotes = notes.filter(
          n => n.time >= chord.time - 0.001 && n.time < chord.time + chord.duration - 0.001
        );
        if (chordNotes.length === 0) continue;

        const rootPC = ROOT_SEMITONES[chord.root];
        const b3PC = (rootPC + 3) % 12;
        const b7PC = (rootPC + 10) % 12;
        const pcs = new Set(chordNotes[0].pitches.map(p => p % 12));

        expect(pcs.has(b3PC), `${std.name}: ${chord.root}m7 missing b3`).toBe(true);
        expect(pcs.has(b7PC), `${std.name}: ${chord.root}m7 missing b7`).toBe(true);
      }
    }
  });

  it("maj7 always contains major 3rd and major 7th", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords() as CompChordEvent[];
      const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });

      for (const chord of chords) {
        if (chord.quality !== "maj7") continue;
        const chordNotes = notes.filter(
          n => n.time >= chord.time - 0.001 && n.time < chord.time + chord.duration - 0.001
        );
        if (chordNotes.length === 0) continue;

        const rootPC = ROOT_SEMITONES[chord.root];
        const thirdPC = (rootPC + 4) % 12;
        const seventhPC = (rootPC + 11) % 12;
        const pcs = new Set(chordNotes[0].pitches.map(p => p % 12));

        expect(pcs.has(thirdPC), `${std.name}: ${chord.root}maj7 missing 3`).toBe(true);
        expect(pcs.has(seventhPC), `${std.name}: ${chord.root}maj7 missing maj7`).toBe(true);
      }
    }
  });

  it("half-diminished (m7b5) always contains b3, b5, b7", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords() as CompChordEvent[];
      const notes = generatePianoComping(chords, { style: "ballad", humanize: false, strum: false });

      for (const chord of chords) {
        if (chord.quality !== "m7b5") continue;
        const chordNotes = notes.filter(
          n => n.time >= chord.time - 0.001 && n.time < chord.time + chord.duration - 0.001
        );
        if (chordNotes.length === 0) continue;

        const rootPC = ROOT_SEMITONES[chord.root];
        const b3PC = (rootPC + 3) % 12;
        const b5PC = (rootPC + 6) % 12;
        const b7PC = (rootPC + 10) % 12;
        const pcs = new Set(chordNotes[0].pitches.map(p => p % 12));

        expect(pcs.has(b3PC), `${std.name}: ${chord.root}m7b5 missing b3`).toBe(true);
        expect(pcs.has(b5PC), `${std.name}: ${chord.root}m7b5 missing b5`).toBe(true);
        expect(pcs.has(b7PC), `${std.name}: ${chord.root}m7b5 missing b7`).toBe(true);
      }
    }
  });

  it("bass never plays major 3rd on minor chord beat 1", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords();
      for (let trial = 0; trial < 10; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let bar = 0; bar < chords.length; bar++) {
          const q = chords[bar].quality;
          if (!q.startsWith("m") || q.startsWith("maj")) continue;
          const beat1 = findBeat1(notes, chords[bar].time);
          if (!beat1) continue;
          const rootPC = ROOT_SEMITONES[chords[bar].root];
          const majorThirdPC = (rootPC + 4) % 12;
          expect(
            beat1.pitch % 12,
            `${std.name} bar ${bar}: bass plays major 3rd on ${chords[bar].root}${q}`
          ).not.toBe(majorThirdPC);
        }
      }
    }
  });

  it("bass never plays minor 3rd on major/dominant chord beat 1", () => {
    for (const std of ALL_STANDARDS) {
      const chords = std.chords();
      for (let trial = 0; trial < 10; trial++) {
        const notes = generateWalkingBass(chords, { style: "swing", tempo: std.tempo });
        for (let bar = 0; bar < chords.length; bar++) {
          const q = chords[bar].quality;
          if (q.startsWith("m") && !q.startsWith("maj")) continue;
          if (q.includes("dim")) continue;
          const beat1 = findBeat1(notes, chords[bar].time);
          if (!beat1) continue;
          const rootPC = ROOT_SEMITONES[chords[bar].root];
          const minorThirdPC = (rootPC + 3) % 12;
          expect(
            beat1.pitch % 12,
            `${std.name} bar ${bar}: bass plays minor 3rd on ${chords[bar].root}${q}`
          ).not.toBe(minorThirdPC);
        }
      }
    }
  });
});
