import { describe, it, expect } from "vitest";
import { generateWalkingBass, scoreChordsToEvents, generatePianoComping, generateDrumPattern } from "../src/index";
import type { QuantizedScore } from "../src/index";

/**
 * Integration tests — verify all generators work together with a real score.
 * Simulates what PracticeEngine.load() does without Tone.js dependency.
 */

function makeScore(): QuantizedScore {
  // 8-bar ii-V-I-I loop (common jazz standard form section)
  const chordProg = [
    { root: "D", quality: "m7" },
    { root: "G", quality: "7" },
    { root: "C", quality: "maj7" },
    { root: "C", quality: "maj7" },
    { root: "F", quality: "m7" },
    { root: "Bb", quality: "7" },
    { root: "Eb", quality: "maj7" },
    { root: "Eb", quality: "maj7" },
  ];

  const tempo = 140;
  const beatDur = 60 / tempo;
  const measureDur = 4 * beatDur;

  const measures = chordProg.map((chord, i) => ({
    index: i,
    notes: [{
      id: `n-${i}`,
      pitches: [60],
      vexKeys: ["c/4"] as string[],
      duration: "w",
      dots: 0,
      isRest: false,
      isTied: false,
      startTime: i * measureDur,
      endTime: (i + 1) * measureDur,
      velocity: 80,
    }],
    chords: [{ root: chord.root, quality: chord.quality, startTime: i * measureDur }],
    chord: { root: chord.root, quality: chord.quality, startTime: i * measureDur },
    timeSignature: [4, 4] as [number, number],
    keySignature: "C",
    tempo,
    startTime: i * measureDur,
    endTime: (i + 1) * measureDur,
  }));

  return {
    measures,
    keySignature: "C",
    timeSignature: [4, 4],
    tempo,
    duration: measures.length * measureDur,
  };
}

describe("Practice Integration — generators work together", () => {
  const score = makeScore();
  const chordEvents = scoreChordsToEvents(score.measures);
  const tempo = score.tempo;

  it("scoreChordsToEvents extracts all chords from score", () => {
    expect(chordEvents.length).toBe(8);
    expect(chordEvents[0].root).toBe("D");
    expect(chordEvents[0].quality).toBe("m7");
    expect(chordEvents[7].root).toBe("Eb");
  });

  it("walking bass produces notes for every measure", () => {
    const bass = generateWalkingBass(chordEvents, { style: "swing", tempo });
    // 8 measures × 4 beats = 32 notes (enclosures may add 1 extra per measure)
    expect(bass.length).toBeGreaterThanOrEqual(32);
    expect(bass.length).toBeLessThanOrEqual(40);
  });

  it("piano comping produces notes for every chord", () => {
    const piano = generatePianoComping(chordEvents, { style: "swing", tempo, humanize: false });
    // At least 2 hits per measure × 8 = 16+
    expect(piano.length).toBeGreaterThanOrEqual(16);
  });

  it("drums produce hits for all measures", () => {
    const drums = generateDrumPattern({ style: "swing", tempo, measures: 8, humanize: false });
    // Swing: ~13 hits per measure × 8 = 100+
    expect(drums.length).toBeGreaterThan(80);
  });

  it("all parts have consistent timing range", () => {
    const bass = generateWalkingBass(chordEvents, { style: "swing", tempo });
    const piano = generatePianoComping(chordEvents, { style: "swing", tempo, humanize: false });
    const drums = generateDrumPattern({ style: "swing", tempo, measures: 8, humanize: false });

    const maxBass = Math.max(...bass.map((n) => n.time));
    const maxPiano = Math.max(...piano.map((n) => n.time));
    const maxDrums = Math.max(...drums.map((n) => n.time));

    // All should end within the score duration (+ tolerance for broken voicings / humanization)
    expect(maxBass).toBeLessThanOrEqual(score.duration + 0.1);
    expect(maxPiano).toBeLessThanOrEqual(score.duration + 0.5);
    expect(maxDrums).toBeLessThanOrEqual(score.duration + 0.1);
  });

  it("bossa style works across all generators", () => {
    const bass = generateWalkingBass(chordEvents, { style: "bossa", tempo });
    const piano = generatePianoComping(chordEvents, { style: "bossa", tempo, humanize: false });
    const drums = generateDrumPattern({ style: "bossa", tempo, measures: 8, humanize: false });

    expect(bass.length).toBeGreaterThan(0);
    expect(piano.length).toBeGreaterThan(0);
    expect(drums.length).toBeGreaterThan(0);
  });

  it("latin style works across all generators", () => {
    const bass = generateWalkingBass(chordEvents, { style: "latin", tempo });
    const piano = generatePianoComping(chordEvents, { style: "bossa", tempo, humanize: false }); // mapped to bossa for piano
    const drums = generateDrumPattern({ style: "latin", tempo, measures: 8, humanize: false });

    expect(bass.length).toBeGreaterThan(0);
    expect(piano.length).toBeGreaterThan(0);
    expect(drums.length).toBeGreaterThan(0);
  });

  it("ballad style works with slow tempo", () => {
    const slowTempo = 60;
    const bass = generateWalkingBass(chordEvents, { style: "swing", tempo: slowTempo });
    const piano = generatePianoComping(chordEvents, { style: "ballad", tempo: slowTempo, humanize: false });
    const drums = generateDrumPattern({ style: "ballad", tempo: slowTempo, measures: 8, humanize: false });

    expect(bass.length).toBeGreaterThan(0);
    expect(piano.length).toBeGreaterThan(0);
    expect(drums.length).toBeGreaterThan(0);
  });

  it("all bass notes have valid MIDI pitches", () => {
    const bass = generateWalkingBass(chordEvents, { style: "swing", tempo });
    for (const n of bass) {
      expect(n.pitch).toBeGreaterThanOrEqual(28);
      expect(n.pitch).toBeLessThanOrEqual(55);
    }
  });

  it("all piano notes have valid MIDI pitches", () => {
    const piano = generatePianoComping(chordEvents, { style: "swing", tempo, humanize: false });
    for (const n of piano) {
      for (const p of n.pitches) {
        expect(p).toBeGreaterThanOrEqual(55);
        expect(p).toBeLessThanOrEqual(84);
      }
    }
  });

  it("no timing conflicts between parts (all start at 0+)", () => {
    const bass = generateWalkingBass(chordEvents, { style: "swing", tempo });
    const piano = generatePianoComping(chordEvents, { style: "swing", tempo, humanize: false });
    const drums = generateDrumPattern({ style: "swing", tempo, measures: 8, humanize: false });

    for (const n of bass) expect(n.time).toBeGreaterThanOrEqual(0);
    for (const n of piano) expect(n.time).toBeGreaterThanOrEqual(0);
    for (const n of drums) expect(n.time).toBeGreaterThanOrEqual(0);
  });

  it("loop range slice works correctly", () => {
    // Slice measures 2–4 (indices 2,3)
    const sliced = score.measures.slice(2, 4);
    const timeOffset = sliced[0].startTime;
    const adjusted = sliced.map((m) => ({
      ...m,
      chords: m.chords.map((c) => ({ ...c, startTime: c.startTime - timeOffset })),
      startTime: m.startTime - timeOffset,
      endTime: m.endTime - timeOffset,
    }));

    const events = scoreChordsToEvents(adjusted);
    expect(events.length).toBe(2);
    expect(events[0].time).toBe(0); // starts at 0 after offset
    expect(events[0].root).toBe("C"); // 3rd chord (index 2)
    expect(events[1].root).toBe("C"); // 4th chord (index 3)
  });
});
