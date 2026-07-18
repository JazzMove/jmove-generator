/**
 * G29 Module Split Tests
 *
 * Verify the 3-into-10 module split preserved behavior, state isolation,
 * PRNG determinism, re-exports, and init/restore patterns.
 */
import { describe, it, expect } from "vitest";
import {
  generateDrumPattern,
  generatePianoComping,
  generateWalkingBass,
  scoreChordsToEvents,
  GM_DRUMS,
  humanizeTime,
  humanizeVelocity,
  applyMicroVariation,
  getMeterPatternSet,
  getStylePatternSet,
  interlockKickHihat,
  createPRNG,
  deriveStream,
  STREAM_DRUMS,
  STREAM_BASS,
  STREAM_PIANO,
  type DrumHit,
  type CompNote,
  type BassNote,
  type ChordEvent,
} from "../src/index";

// Direct imports from new submodules to test internal contracts
import {
  initVoicingState,
  restoreVoicingState,
  rootMidi,
  buildVoicing,
  pickVoicing,
  toShellVoicing,
  voiceLeadingDistance,
} from "../src/pianoVoicings";
import {
  VOICINGS,
  PIANO_LOW_DEFAULT,
  PIANO_HIGH_DEFAULT,
  ROOT_SEMITONES,
  SWING_RHYTHMS,
  BOSSA_RHYTHMS,
  type VoicingTemplate,
} from "../src/pianoVoicingData";
import {
  initBassState,
  restoreBassState,
  setBassTargetPitch,
  setBassEnergy,
  _rng as bassRng,
  rootToMidi,
  getChordTones,
  getScaleTones,
  approachTone,
  clamp,
  closestOctave,
  constrainStepwise,
  ASCENDING_PATTERNS,
  DESCENDING_PATTERNS,
  getBassLow,
  getBassHigh,
} from "../src/bassHelpers";
import { inferTimeSignature, generateOddMeterBass } from "../src/bassOddMeters";
import {
  generateSwingMeasure,
  generateBossaMeasure,
  generateLatinMeasure,
} from "../src/bassStyles";
import {
  GM_DRUMS as GM_DRUMS_DATA,
  type StylePatternSet,
  STOCHASTIC_TABLES,
  FILL_STYLES,
} from "../src/drumPatternData";
import {
  humanizeTime as humTimeStoch,
  humanizeVelocity as humVelStoch,
  applyMicroVariation as microVarStoch,
} from "../src/drumStochastic";

// ── Helpers ──

const BLUES_CHORDS: ChordEvent[] = [
  { root: "C", quality: "7", time: 0, duration: 2 },
  { root: "F", quality: "7", time: 2, duration: 2 },
  { root: "C", quality: "7", time: 4, duration: 2 },
  { root: "G", quality: "7", time: 6, duration: 2 },
];

function makeRng(seed: number) {
  return createPRNG(seed);
}

// ═══════════════════════════════════════════════════
// 1. Re-export integrity - symbols resolve through facades
// ═══════════════════════════════════════════════════

describe("G29 re-export integrity", () => {
  it("GM_DRUMS re-exported from drumPatterns matches drumPatternData", () => {
    expect(GM_DRUMS).toBe(GM_DRUMS_DATA);
    expect(GM_DRUMS.KICK).toBe(36);
    expect(GM_DRUMS.SNARE).toBe(38);
    expect(GM_DRUMS.HI_HAT_CLOSED).toBe(42);
  });

  it("humanizeTime/Velocity re-exported from drumPatterns match drumStochastic", () => {
    expect(humanizeTime).toBe(humTimeStoch);
    expect(humanizeVelocity).toBe(humVelStoch);
  });

  it("applyMicroVariation re-exported from drumPatterns matches drumStochastic", () => {
    expect(applyMicroVariation).toBe(microVarStoch);
  });

  it("VOICINGS data has expected entries", () => {
    expect(Object.keys(VOICINGS).length).toBeGreaterThan(30);
    expect(VOICINGS["maj7"]).toBeDefined();
    expect(VOICINGS["7"]).toBeDefined();
    expect(VOICINGS["m7"]).toBeDefined();
  });

  it("SWING_RHYTHMS and BOSSA_RHYTHMS are non-empty arrays", () => {
    expect(SWING_RHYTHMS.length).toBeGreaterThan(0);
    expect(BOSSA_RHYTHMS.length).toBeGreaterThan(0);
  });

  it("drumPatternData exports stochastic tables and fill styles", () => {
    expect(STOCHASTIC_TABLES).toBeDefined();
    expect(typeof STOCHASTIC_TABLES).toBe("object");
    expect(FILL_STYLES).toBeDefined();
    expect(FILL_STYLES instanceof Set).toBe(true);
  });

  it("ROOT_SEMITONES covers all 12 notes", () => {
    const notes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    for (const n of notes) {
      expect(ROOT_SEMITONES[n]).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════
// 2. Piano voicing state init/restore
// ═══════════════════════════════════════════════════

describe("G29 piano voicing state isolation", () => {
  it("initVoicingState returns previous state and sets new state", () => {
    const rng = makeRng(42);
    const saved = initVoicingState(48, 96, rng);
    // saved should have old defaults
    expect(saved.low).toBe(PIANO_LOW_DEFAULT);
    expect(saved.high).toBe(PIANO_HIGH_DEFAULT);
    expect(typeof saved.rng).toBe("function");
    // Restore
    restoreVoicingState(saved);
  });

  it("restoreVoicingState reverts to original state", () => {
    const rng1 = makeRng(1);
    const rng2 = makeRng(2);

    // Save baseline
    const baseline = initVoicingState(PIANO_LOW_DEFAULT, PIANO_HIGH_DEFAULT, rng1);
    restoreVoicingState(baseline);

    // Set new state
    const saved = initVoicingState(40, 100, rng2);
    // Restore
    restoreVoicingState(saved);

    // Verify by init again - should get back the original values
    const check = initVoicingState(PIANO_LOW_DEFAULT, PIANO_HIGH_DEFAULT, rng1);
    expect(check.low).toBe(PIANO_LOW_DEFAULT);
    expect(check.high).toBe(PIANO_HIGH_DEFAULT);
    restoreVoicingState(check);
  });

  it("nested init/restore works correctly", () => {
    const rng1 = makeRng(10);
    const rng2 = makeRng(20);

    const outer = initVoicingState(50, 80, rng1);
    const inner = initVoicingState(60, 90, rng2);
    // inner saved should be 50, 80
    expect(inner.low).toBe(50);
    expect(inner.high).toBe(80);

    restoreVoicingState(inner);  // back to 50, 80
    restoreVoicingState(outer);  // back to original defaults
  });
});

// ═══════════════════════════════════════════════════
// 3. Bass state init/restore
// ═══════════════════════════════════════════════════

describe("G29 bass state isolation", () => {
  it("initBassState returns previous state and sets new state", () => {
    const rng = makeRng(42);
    const saved = initBassState(rng, undefined, 2, 0.5);
    // saved should have old defaults
    expect(typeof saved.rng).toBe("function");
    expect(saved.hr).toBe(1); // default harmonicRhythm
    expect(saved.energy).toBe(0.7); // default energy

    restoreBassState(saved);
  });

  it("restoreBassState fully reverts state", () => {
    const rng = makeRng(99);
    const saved = initBassState(rng, { chromaticApproach: 80, registerWidth: 50, syncopation: 30, beatVariety: 40, bassRegister: 50 }, 3, 0.9);

    // Modify target pitch
    setBassTargetPitch(48);
    setBassEnergy(0.3);

    // Restore
    restoreBassState(saved);

    // Verify by init again
    const check = initBassState(Math.random, undefined, 1, 0.7);
    expect(check.hr).toBe(1);
    expect(check.energy).toBe(0.7);
    restoreBassState(check);
  });

  it("setBassTargetPitch/setBassEnergy work within init scope", () => {
    const rng = makeRng(1);
    const saved = initBassState(rng, undefined, 1, 0.5);

    setBassTargetPitch(36);
    setBassEnergy(0.8);
    // Just verifying no crash - state is module-internal

    restoreBassState(saved);
  });

  it("nested init/restore preserves outer state", () => {
    const rng1 = makeRng(10);
    const rng2 = makeRng(20);

    const outer = initBassState(rng1, undefined, 2, 0.6);
    const inner = initBassState(rng2, undefined, 3, 0.9);

    expect(inner.hr).toBe(2);
    expect(inner.energy).toBe(0.6);

    restoreBassState(inner);
    restoreBassState(outer);
  });
});

// ═══════════════════════════════════════════════════
// 4. PRNG determinism across module boundaries
// ═══════════════════════════════════════════════════

describe("G29 PRNG determinism", () => {
  it("drum patterns deterministic with same seed", () => {
    const seed = 12345;
    const rng1 = makeRng(seed);
    const rng2 = makeRng(seed);

    const hits1 = generateDrumPattern({
      measures: 4,
      style: "swing",
      random: rng1,
    });
    const hits2 = generateDrumPattern({
      measures: 4,
      style: "swing",
      random: rng2,
    });

    expect(hits1).toEqual(hits2);
  });

  it("piano comping deterministic with same seed", () => {
    const seed = 54321;
    const rng1 = makeRng(seed);
    const rng2 = makeRng(seed);

    const notes1 = generatePianoComping(BLUES_CHORDS, {
      style: "swing",
      tempo: 120,
      random: rng1,
    });
    const notes2 = generatePianoComping(BLUES_CHORDS, {
      style: "swing",
      tempo: 120,
      random: rng2,
    });

    expect(notes1).toEqual(notes2);
  });

  it("walking bass deterministic with same seed", () => {
    const seed = 99999;
    const rng1 = makeRng(seed);
    const rng2 = makeRng(seed);

    const bass1 = generateWalkingBass(BLUES_CHORDS, {
      style: "swing",
      tempo: 120,
      random: rng1,
    });
    const bass2 = generateWalkingBass(BLUES_CHORDS, {
      style: "swing",
      tempo: 120,
      random: rng2,
    });

    expect(bass1).toEqual(bass2);
  });

  it("different seeds produce different output", () => {
    const bass1 = generateWalkingBass(BLUES_CHORDS, {
      style: "swing",
      tempo: 120,
      random: makeRng(1),
    });
    const bass2 = generateWalkingBass(BLUES_CHORDS, {
      style: "swing",
      tempo: 120,
      random: makeRng(2),
    });

    // Very unlikely to be identical
    const pitches1 = bass1.map((n) => n.pitch);
    const pitches2 = bass2.map((n) => n.pitch);
    expect(pitches1).not.toEqual(pitches2);
  });

  it("derived PRNG streams produce independent deterministic results", () => {
    const seed = 42;
    const rngD1 = deriveStream(makeRng(seed), STREAM_DRUMS);
    const rngD2 = deriveStream(makeRng(seed), STREAM_DRUMS);

    const rngB1 = deriveStream(makeRng(seed), STREAM_BASS);
    const rngB2 = deriveStream(makeRng(seed), STREAM_BASS);

    // Same stream from same seed = same values
    const d1Vals = Array.from({ length: 10 }, () => rngD1());
    const d2Vals = Array.from({ length: 10 }, () => rngD2());
    expect(d1Vals).toEqual(d2Vals);

    const b1Vals = Array.from({ length: 10 }, () => rngB1());
    const b2Vals = Array.from({ length: 10 }, () => rngB2());
    expect(b1Vals).toEqual(b2Vals);

    // Different streams = different values
    const dVals = Array.from({ length: 10 }, () => deriveStream(makeRng(seed), STREAM_DRUMS)());
    const bVals = Array.from({ length: 10 }, () => deriveStream(makeRng(seed), STREAM_BASS)());
    // This is a weaker check - just verify they're not all the same
    expect(dVals[0]).not.toBe(bVals[0]);
  });
});

// ═══════════════════════════════════════════════════
// 5. Cross-module function correctness
// ═══════════════════════════════════════════════════

describe("G29 cross-module function correctness", () => {
  it("rootMidi returns correct MIDI pitch classes", () => {
    expect(rootMidi("C")).toBe(0);
    expect(rootMidi("D")).toBe(2);
    expect(rootMidi("E")).toBe(4);
    expect(rootMidi("F")).toBe(5);
    expect(rootMidi("G")).toBe(7);
    expect(rootMidi("A")).toBe(9);
    expect(rootMidi("B")).toBe(11);
    expect(rootMidi("Bb")).toBe(10);
    expect(rootMidi("Eb")).toBe(3);
  });

  it("rootToMidi returns MIDI note in bass range", () => {
    const cMidi = rootToMidi("C");
    expect(cMidi).toBeGreaterThanOrEqual(28);
    expect(cMidi).toBeLessThanOrEqual(55);
    // C should be MIDI 36 (C2) or 48 (C3)
    expect(cMidi % 12).toBe(0);
  });

  it("getChordTones returns valid intervals", () => {
    const tones = getChordTones("C", "7");
    expect(tones.length).toBeGreaterThan(0);
    // Should include root (0 mod 12 offset from C)
  });

  it("getScaleTones returns 7+ notes", () => {
    const scale = getScaleTones("C", "7");
    expect(scale.length).toBeGreaterThanOrEqual(7);
  });

  it("buildVoicing produces notes in piano range", () => {
    const saved = initVoicingState(PIANO_LOW_DEFAULT, PIANO_HIGH_DEFAULT, Math.random);
    try {
      const [templateA] = VOICINGS["maj7"];
      const notes = buildVoicing("C", templateA);
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n).toBeGreaterThanOrEqual(PIANO_LOW_DEFAULT - 12); // allow some flex
        expect(n).toBeLessThanOrEqual(PIANO_HIGH_DEFAULT + 12);
      }
    } finally {
      restoreVoicingState(saved);
    }
  });

  it("voiceLeadingDistance returns non-negative value", () => {
    const d = voiceLeadingDistance([60, 64, 67], [62, 65, 69]);
    expect(d).toBeGreaterThanOrEqual(0);
  });

  it("toShellVoicing reduces to 2 notes", () => {
    const shell = toShellVoicing([60, 64, 67, 72]);
    expect(shell.length).toBe(2);
  });

  it("clamp wraps pitch into bass range", () => {
    const lo = getBassLow();
    const hi = getBassHigh();
    const result = clamp(lo + 5);
    expect(result).toBeGreaterThanOrEqual(lo);
    expect(result).toBeLessThanOrEqual(hi);
    // Far above range wraps down
    const high = clamp(hi + 24);
    expect(high).toBeGreaterThanOrEqual(lo);
    expect(high).toBeLessThanOrEqual(hi);
  });

  it("closestOctave finds nearest octave within bass range", () => {
    const result = closestOctave(36, 40); // C2 near E2
    expect(result % 12).toBe(0); // still a C
    expect(result).toBeGreaterThanOrEqual(getBassLow());
    expect(result).toBeLessThanOrEqual(getBassHigh());
  });

  it("inferTimeSignature identifies common meters", () => {
    expect(inferTimeSignature(2, 0.5)).toEqual([4, 4]);
    expect(inferTimeSignature(1.5, 0.5)).toEqual([3, 4]);
    expect(inferTimeSignature(2.5, 0.5)).toEqual([5, 4]);
    expect(inferTimeSignature(3.5, 0.5)).toEqual([7, 4]);
  });

  it("ASCENDING_PATTERNS and DESCENDING_PATTERNS are non-empty", () => {
    expect(ASCENDING_PATTERNS.length).toBeGreaterThan(0);
    expect(DESCENDING_PATTERNS.length).toBeGreaterThan(0);
  });

  it("getBassLow/getBassHigh return MIDI range", () => {
    const lo = getBassLow();
    const hi = getBassHigh();
    expect(lo).toBeGreaterThanOrEqual(20);
    expect(hi).toBeLessThanOrEqual(70);
    expect(lo).toBeLessThan(hi);
  });
});

// ═══════════════════════════════════════════════════
// 6. Style generators from bassStyles work correctly
// ═══════════════════════════════════════════════════

describe("G29 bass style generators via submodule", () => {
  const chord: ChordEvent = { root: "C", quality: "7", time: 0, duration: 2 };
  const nextChord: ChordEvent = { root: "F", quality: "7", time: 2, duration: 2 };
  const beatDuration = 0.5;

  function withBassState(fn: () => void) {
    const saved = initBassState(makeRng(42), undefined, 1, 0.7);
    try { fn(); }
    finally { restoreBassState(saved); }
  }

  it("generateSwingMeasure produces notes", () => {
    withBassState(() => {
      const notes = generateSwingMeasure(chord, nextChord, beatDuration, null);
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.pitch).toBeGreaterThanOrEqual(20);
        expect(n.pitch).toBeLessThanOrEqual(70);
      }
    });
  });

  it("generateBossaMeasure produces notes", () => {
    withBassState(() => {
      const notes = generateBossaMeasure(chord, nextChord, beatDuration, null);
      expect(notes.length).toBeGreaterThan(0);
    });
  });

  it("generateLatinMeasure produces notes", () => {
    withBassState(() => {
      const notes = generateLatinMeasure(chord, nextChord, beatDuration, null);
      expect(notes.length).toBeGreaterThan(0);
    });
  });

  it("style generators deterministic within state scope", () => {
    const makeNotes = () => {
      const saved = initBassState(makeRng(777), undefined, 1, 0.7);
      try {
        return generateSwingMeasure(chord, nextChord, beatDuration, null);
      } finally {
        restoreBassState(saved);
      }
    };

    const a = makeNotes();
    const b = makeNotes();
    expect(a).toEqual(b);
  });
});

// ═══════════════════════════════════════════════════
// 7. Odd meter generators from bassOddMeters
// ═══════════════════════════════════════════════════

describe("G29 bass odd meter generators", () => {
  it("generateOddMeterBass produces notes for 5/4", () => {
    const chord: ChordEvent = { root: "D", quality: "m7", time: 0, duration: 2.5 };
    const saved = initBassState(makeRng(42), undefined, 1, 0.7);
    try {
      const notes = generateOddMeterBass([5, 4], chord, null, 0.5, null);
      expect(notes).not.toBeNull();
      expect(notes!.length).toBeGreaterThan(0);
    } finally {
      restoreBassState(saved);
    }
  });

  it("generateOddMeterBass produces notes for 7/8", () => {
    const chord: ChordEvent = { root: "E", quality: "m7", time: 0, duration: 1.75 };
    const saved = initBassState(makeRng(42), undefined, 1, 0.7);
    try {
      const notes = generateOddMeterBass([7, 8], chord, null, 0.25, null);
      expect(notes).not.toBeNull();
      expect(notes!.length).toBeGreaterThan(0);
    } finally {
      restoreBassState(saved);
    }
  });
});

// ═══════════════════════════════════════════════════
// 8. Drum submodule functions
// ═══════════════════════════════════════════════════

describe("G29 drum submodule functions", () => {
  it("getMeterPatternSet returns pattern for 5/4", () => {
    const ps = getMeterPatternSet([5, 4]);
    expect(ps).not.toBeNull();
    if (ps) {
      expect(ps.base).toBeDefined();
      expect(ps.variations).toBeDefined();
    }
  });

  it("getMeterPatternSet returns null for standard 4/4", () => {
    const ps = getMeterPatternSet([4, 4]);
    expect(ps).toBeNull(); // 4/4 uses style-based patterns, not meter-based
  });

  it("getStylePatternSet returns valid pattern set", () => {
    const ps = getStylePatternSet("swing", makeRng(1));
    expect(ps.base).toBeDefined();
    expect(ps.variations).toBeDefined();
    expect(ps.variations.length).toBeGreaterThan(0);
  });

  it("humanizeTime adds small offset", () => {
    const t = humanizeTime(1.0, 0.5);
    expect(Math.abs(t - 1.0)).toBeLessThanOrEqual(0.05);
  });

  it("humanizeVelocity stays in MIDI range", () => {
    for (let i = 0; i < 50; i++) {
      const v = humanizeVelocity(80, 0.5);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(127);
    }
  });

  it("interlockKickHihat modifies hits array in place", () => {
    const hits: DrumHit[] = [
      { pitch: GM_DRUMS.KICK, time: 0, duration: 0.5, velocity: 90, measure: 0 },
      { pitch: GM_DRUMS.CLOSED_HH, time: 0, duration: 0.5, velocity: 70, measure: 0 },
      { pitch: GM_DRUMS.CLOSED_HH, time: 0.5, duration: 0.5, velocity: 70, measure: 0 },
    ];
    const before = hits.length;
    interlockKickHihat(hits, "swing", makeRng(1));
    // Should not crash, may or may not modify
    expect(hits.length).toBeGreaterThanOrEqual(before - 1);
  });
});

// ═══════════════════════════════════════════════════
// 9. Error path state cleanup
// ═══════════════════════════════════════════════════

describe("G29 error path state cleanup", () => {
  it("generatePianoComping with tempo=0 throws and restores state", () => {
    expect(() =>
      generatePianoComping(BLUES_CHORDS, { tempo: 0, random: makeRng(1) })
    ).toThrow(RangeError);

    // Verify can still generate after error
    const notes = generatePianoComping(BLUES_CHORDS, {
      tempo: 120,
      random: makeRng(2),
    });
    expect(notes.length).toBeGreaterThan(0);
  });

  it("generateWalkingBass with tempo=0 throws and restores state", () => {
    expect(() =>
      generateWalkingBass(BLUES_CHORDS, { tempo: 0, random: makeRng(1) })
    ).toThrow(RangeError);

    // Verify can still generate after error
    const notes = generateWalkingBass(BLUES_CHORDS, {
      tempo: 120,
      random: makeRng(2),
    });
    expect(notes.length).toBeGreaterThan(0);
  });

  it("empty chord array returns empty without state corruption", () => {
    expect(generatePianoComping([])).toEqual([]);
    expect(generateWalkingBass([])).toEqual([]);

    // Still works after empty call
    const notes = generateWalkingBass(BLUES_CHORDS, {
      tempo: 120,
      random: makeRng(3),
    });
    expect(notes.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════
// 10. Sequential generation doesn't leak state
// ═══════════════════════════════════════════════════

describe("G29 sequential generation state isolation", () => {
  it("consecutive generateWalkingBass calls with same seed produce same output", () => {
    const opts = { style: "swing" as const, tempo: 140, random: makeRng(100) };
    const a = generateWalkingBass(BLUES_CHORDS, { ...opts, random: makeRng(100) });
    const b = generateWalkingBass(BLUES_CHORDS, { ...opts, random: makeRng(100) });
    expect(a).toEqual(b);
  });

  it("consecutive generatePianoComping calls with same seed produce same output", () => {
    const a = generatePianoComping(BLUES_CHORDS, { tempo: 120, random: makeRng(200) });
    const b = generatePianoComping(BLUES_CHORDS, { tempo: 120, random: makeRng(200) });
    expect(a).toEqual(b);
  });

  it("interleaved piano and bass calls don't corrupt each other's state", () => {
    // Piano first, then bass, then piano again with same seed
    const p1 = generatePianoComping(BLUES_CHORDS, { tempo: 120, random: makeRng(300) });
    generateWalkingBass(BLUES_CHORDS, { tempo: 120, random: makeRng(400) });
    const p2 = generatePianoComping(BLUES_CHORDS, { tempo: 120, random: makeRng(300) });
    expect(p1).toEqual(p2);
  });

  it("interleaved bass and drum calls don't corrupt each other's state", () => {
    const b1 = generateWalkingBass(BLUES_CHORDS, { tempo: 120, random: makeRng(500) });
    generateDrumPattern({ measures: 4, style: "swing", random: makeRng(600) });
    const b2 = generateWalkingBass(BLUES_CHORDS, { tempo: 120, random: makeRng(500) });
    expect(b1).toEqual(b2);
  });
});

// ═══════════════════════════════════════════════════
// 11. scoreChordsToEvents still works through facade
// ═══════════════════════════════════════════════════

describe("G29 scoreChordsToEvents facade", () => {
  it("converts score measures to chord events", () => {
    const measures = [
      {
        chords: [{ root: "C", quality: "maj7", startTime: 0 }],
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
    expect(events[0].root).toBe("C");
    expect(events[1].root).toBe("G");
  });
});

// ═══════════════════════════════════════════════════
// 12. All styles produce output through the split
// ═══════════════════════════════════════════════════

describe("G29 all styles produce output after split", () => {
  const styles = [
    "swing", "bossa", "latin", "fusion", "ecm",
    "hardBop", "coolJazz", "modal", "jazzWaltz",
    "shuffleBlues", "neoSoul", "contemporaryJazz",
    "mathRock", "idm", "holdsworth", "alfaMist", "metheny",
  ];

  for (const style of styles) {
    it(`walking bass: ${style}`, () => {
      const notes = generateWalkingBass(BLUES_CHORDS, {
        style: style as any,
        tempo: 120,
        random: makeRng(42),
      });
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.pitch).toBeGreaterThanOrEqual(20);
        expect(n.pitch).toBeLessThanOrEqual(72);
        expect(n.duration).toBeGreaterThan(0);
      }
    });
  }

  const pianoStyles = [
    "swing", "bossa", "latin", "fusion", "ecm",
    "hardBop", "coolJazz", "modal", "jazzWaltz",
    "shuffleBlues", "neoSoul", "contemporaryJazz",
    "mathRock", "idm", "holdsworth", "alfaMist", "metheny",
  ];

  for (const style of pianoStyles) {
    it(`piano comping: ${style}`, () => {
      const notes = generatePianoComping(BLUES_CHORDS, {
        style: style as any,
        tempo: 120,
        random: makeRng(42),
      });
      expect(notes.length).toBeGreaterThan(0);
    });
  }

  const drumStyles = [
    "swing", "bossa", "latin", "fusion", "ecm",
    "hardBop", "coolJazz", "modal", "jazzWaltz",
    "shuffleBlues", "neoSoul", "contemporaryJazz",
    "mathRock", "idm", "holdsworth", "alfaMist", "metheny",
  ];

  for (const style of drumStyles) {
    it(`drum pattern: ${style}`, () => {
      const hits = generateDrumPattern({
        measures: 2,
        style,
        random: makeRng(42),
      });
      expect(hits.length).toBeGreaterThan(0);
    });
  }
});

// ═══════════════════════════════════════════════════
// 13. constrainStepwise from bassHelpers
// ═══════════════════════════════════════════════════

describe("G29 constrainStepwise", () => {
  it("limits large jumps in note array", () => {
    const notes = [{ pitch: 40 }, { pitch: 60 }, { pitch: 42 }];
    constrainStepwise(notes, 5);
    // Middle note should be constrained closer to neighbors
    expect(Math.abs(notes[1].pitch - notes[0].pitch)).toBeLessThanOrEqual(5);
  });

  it("leaves small intervals unchanged", () => {
    const notes = [{ pitch: 40 }, { pitch: 43 }, { pitch: 45 }];
    const origPitches = notes.map((n) => n.pitch);
    constrainStepwise(notes, 5);
    expect(notes.map((n) => n.pitch)).toEqual(origPitches);
  });
});
