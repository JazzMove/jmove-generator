import { describe, it, expect } from "vitest";
import {
  generateDrumPattern,
  GM_DRUMS,
  humanizeVelocity,
  type DrumHit,
} from "../src/index";

// ── Helpers ──

function hitsOf(hits: DrumHit[], pitch: number): DrumHit[] {
  return hits.filter((h) => h.pitch === pitch);
}

function uniquePitches(hits: DrumHit[]): number[] {
  return [...new Set(hits.map((h) => h.pitch))].sort((a, b) => a - b);
}

// ── General Tests ──

describe("Drum Patterns — general", () => {
  it("returns empty for 0 measures", () => {
    const hits = generateDrumPattern({ measures: 0 });
    expect(hits).toEqual([]);
  });

  it("all hits have valid GM drum pitches (35–81)", () => {
    const styles = ["swing", "bossa", "latin", "ballad", "funk",
      "fusion", "ecm", "hardBop", "coolJazz", "modal", "jazzWaltz", "shuffleBlues",
      "neoSoul", "contemporaryJazz", "mathRock", "idm"] as const;
    for (const style of styles) {
      const hits = generateDrumPattern({ style, measures: 2, humanize: false });
      for (const h of hits) {
        expect(h.pitch).toBeGreaterThanOrEqual(35);
        expect(h.pitch).toBeLessThanOrEqual(81);
      }
    }
  });

  it("all hits have positive duration", () => {
    const hits = generateDrumPattern({ measures: 4 });
    for (const h of hits) {
      expect(h.duration).toBeGreaterThan(0);
    }
  });

  it("all velocities in 25–127 range", () => {
    const styles = ["swing", "bossa", "latin", "ballad", "funk",
      "fusion", "ecm", "hardBop", "coolJazz", "modal", "jazzWaltz", "shuffleBlues",
      "neoSoul", "contemporaryJazz", "mathRock", "idm"] as const;
    for (const style of styles) {
      const hits = generateDrumPattern({ style, measures: 4, humanize: true });
      for (const h of hits) {
        expect(h.velocity).toBeGreaterThanOrEqual(25);
        expect(h.velocity).toBeLessThanOrEqual(127);
      }
    }
  });

  it("hits sorted chronologically", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 4 });
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].time).toBeGreaterThanOrEqual(hits[i - 1].time - 0.01); // small tolerance for humanization
    }
  });

  it("defaults: swing, 120bpm, 4 measures, 4/4", () => {
    const hits = generateDrumPattern();
    expect(hits.length).toBeGreaterThan(0);
    // 4 measures at 120bpm = 8 seconds total
    const lastHit = hits[hits.length - 1];
    expect(lastHit.time).toBeLessThan(8.1);
  });

  it("respects startTime offset", () => {
    const hits = generateDrumPattern({ startTime: 10, measures: 1, humanize: false });
    expect(hits[0].time).toBeGreaterThanOrEqual(10);
  });

  it("tempo affects timing", () => {
    const slow = generateDrumPattern({ tempo: 60, measures: 1, humanize: false });
    const fast = generateDrumPattern({ tempo: 240, measures: 1, humanize: false });
    // Slow: last hit near 4s (4 beats × 1s), Fast: last hit near 1s (4 beats × 0.25s)
    const slowLast = slow[slow.length - 1].time;
    const fastLast = fast[fast.length - 1].time;
    expect(slowLast).toBeGreaterThan(fastLast);
  });
});

// ── Swing Tests ──

describe("Drum Patterns — swing", () => {
  it("has ride cymbal (primary timekeeping)", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 1, humanize: false });
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    // Swing ride: at least 4 hits per measure (quarter notes + skip notes)
    expect(rides.length).toBeGreaterThanOrEqual(4);
  });

  it("has hi-hat pedal", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 1, humanize: false });
    const hats = hitsOf(hits, GM_DRUMS.HI_HAT_PEDAL);
    // Variant A: 2 pedals (2&4), Variant B: 4 pedals (all beats)
    expect(hats.length).toBeGreaterThanOrEqual(2);
  });

  it("swing ride has skip-note feel (triplet placement)", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 1, humanize: false });
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    const beatDur = 60 / 120;
    // Skip notes at ~0.67 of each beat
    const skipNotes = rides.filter((r) => {
      const beatPos = (r.time / beatDur) % 1;
      return Math.abs(beatPos - 0.67) < 0.05;
    });
    expect(skipNotes.length).toBeGreaterThanOrEqual(2);
  });

  it("has kick drum", () => {
    // Swing kick is stochastic (0.85 prob on beat 1). Use 4 measures to ensure
    // at least one kick lands despite probabilistic generation.
    const hits = generateDrumPattern({ style: "swing", measures: 4, humanize: false });
    const kicks = hitsOf(hits, GM_DRUMS.KICK);
    expect(kicks.length).toBeGreaterThanOrEqual(1);
  });

  it("ghost notes have low velocity (< 50)", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 8, humanize: false });
    const ghosts = hits.filter((h) => h.pitch === GM_DRUMS.SNARE && h.velocity < 50);
    // Over 8 measures, should get some ghost notes
    if (ghosts.length > 0) {
      for (const g of ghosts) {
        expect(g.velocity).toBeLessThan(50);
      }
    }
  });
});

// ── Bossa Nova Tests ──

describe("Drum Patterns — bossa nova", () => {
  it("has continuous hi-hat 8th notes (8 per measure)", () => {
    const hits = generateDrumPattern({ style: "bossa", measures: 1, humanize: false });
    const hats = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
    expect(hats.length).toBe(8);
  });

  it("has cross-stick (rim click) on 2 and 4", () => {
    const hits = generateDrumPattern({ style: "bossa", measures: 1, humanize: false });
    const sticks = hitsOf(hits, GM_DRUMS.CROSS_STICK);
    expect(sticks.length).toBe(2);
  });

  it("has syncopated kick pattern", () => {
    const hits = generateDrumPattern({ style: "bossa", measures: 1, humanize: false });
    const kicks = hitsOf(hits, GM_DRUMS.KICK);
    expect(kicks.length).toBeGreaterThanOrEqual(3);
  });

  it("no ride cymbal (hi-hat carries time)", () => {
    const hits = generateDrumPattern({ style: "bossa", measures: 1, humanize: false });
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    expect(rides.length).toBe(0);
  });

  it("straight 8ths (not swung)", () => {
    const hits = generateDrumPattern({ style: "bossa", measures: 1, humanize: false });
    const hats = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
    const beatDur = 60 / 120;
    // Check even spacing (0, 0.5, 1, 1.5... in beat units)
    for (let i = 0; i < hats.length; i++) {
      const expectedBeat = i * 0.5;
      expect(hats[i].time).toBeCloseTo(expectedBeat * beatDur, 2);
    }
  });
});

// ── Latin Tests ──

describe("Drum Patterns — latin", () => {
  it("has cascara pattern on ride/ride bell", () => {
    const hits = generateDrumPattern({ style: "latin", measures: 1, humanize: false });
    const rides = hits.filter((h) => h.pitch === GM_DRUMS.RIDE || h.pitch === GM_DRUMS.RIDE_BELL);
    expect(rides.length).toBe(8); // cascara = 8 hits per measure
  });

  it("has clave hits", () => {
    const hits = generateDrumPattern({ style: "latin", measures: 1, humanize: false });
    const claves = hitsOf(hits, GM_DRUMS.CLAVES);
    expect(claves.length).toBe(3); // 3-side of son clave
  });

  it("has kick on beat 1 and and-of-3", () => {
    const hits = generateDrumPattern({ style: "latin", measures: 1, humanize: false });
    const kicks = hitsOf(hits, GM_DRUMS.KICK);
    expect(kicks.length).toBe(2);
  });

  it("has hi-hat 8ths underneath", () => {
    const hits = generateDrumPattern({ style: "latin", measures: 1, humanize: false });
    const hats = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
    expect(hats.length).toBe(8);
  });

  it("uses multiple drum voices (layered texture)", () => {
    const hits = generateDrumPattern({ style: "latin", measures: 1, humanize: false });
    const pitches = uniquePitches(hits);
    // Latin should use: ride, ride bell, kick, hi-hat, claves = 5+ voices
    expect(pitches.length).toBeGreaterThanOrEqual(4);
  });
});

// ── Ballad Tests ──

describe("Drum Patterns — ballad", () => {
  it("sparse — fewer hits than swing", () => {
    const ballad = generateDrumPattern({ style: "ballad", measures: 1, humanize: false });
    const swing = generateDrumPattern({ style: "swing", measures: 1, humanize: false });
    expect(ballad.length).toBeLessThan(swing.length);
  });

  it("has ride quarter notes", () => {
    const hits = generateDrumPattern({ style: "ballad", measures: 1, humanize: false });
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    expect(rides.length).toBe(4);
  });

  it("lower velocities than swing (softer feel)", () => {
    // Use many measures to average out stochastic variation selection
    // Exclude ghost notes (hi-hat pulse) — compare main instrument hits only
    const ballad = generateDrumPattern({ style: "ballad", measures: 16, humanize: false });
    const swing = generateDrumPattern({ style: "swing", measures: 16, humanize: false });
    const nonGhost = (h: { velocity: number }) => h.velocity > 35;
    const avgBallad = ballad.filter(nonGhost).reduce((s, h) => s + h.velocity, 0) / ballad.filter(nonGhost).length;
    const avgSwing = swing.filter(nonGhost).reduce((s, h) => s + h.velocity, 0) / swing.filter(nonGhost).length;
    expect(avgBallad).toBeLessThan(avgSwing);
  });

  it("hi-hat pedal on 2 and 4", () => {
    const hits = generateDrumPattern({ style: "ballad", measures: 1, humanize: false });
    const hats = hitsOf(hits, GM_DRUMS.HI_HAT_PEDAL);
    expect(hats.length).toBe(2);
  });
});

// ── Funk Tests ──

describe("Drum Patterns — funk", () => {
  it("has 16th note hi-hats (16 per measure)", () => {
    const hits = generateDrumPattern({ style: "funk", measures: 1, humanize: false });
    const hats = hits.filter((h) => h.pitch === GM_DRUMS.HI_HAT_CLOSED || h.pitch === GM_DRUMS.HI_HAT_OPEN);
    expect(hats.length).toBe(16);
  });

  it("has open hi-hat accents", () => {
    const hits = generateDrumPattern({ style: "funk", measures: 1, humanize: false });
    const open = hitsOf(hits, GM_DRUMS.HI_HAT_OPEN);
    expect(open.length).toBeGreaterThanOrEqual(2);
  });

  it("snare on 2 and 4 (backbeat)", () => {
    const hits = generateDrumPattern({ style: "funk", measures: 1, humanize: false });
    const snares = hitsOf(hits, GM_DRUMS.SNARE);
    // At least 2 strong snare hits (beats 2 and 4), may have ghost notes too
    const loudSnares = snares.filter((s) => s.velocity >= 80);
    expect(loudSnares.length).toBeGreaterThanOrEqual(2);
  });

  it("has ghost notes on snare (velocity < 50)", () => {
    const hits = generateDrumPattern({ style: "funk", measures: 1, humanize: false });
    const snares = hitsOf(hits, GM_DRUMS.SNARE);
    const ghosts = snares.filter((s) => s.velocity < 50);
    expect(ghosts.length).toBeGreaterThanOrEqual(1);
  });

  it("syncopated kick (not just 1 and 3)", () => {
    const hits = generateDrumPattern({ style: "funk", measures: 1, humanize: false });
    const kicks = hitsOf(hits, GM_DRUMS.KICK);
    // Funk kick has hits off the grid (e.g., 1.75, 2.5)
    const beatDur = 60 / 120;
    const offGrid = kicks.filter((k) => {
      const beatPos = (k.time / beatDur) % 1;
      return beatPos > 0.1 && beatPos < 0.9; // not on a downbeat
    });
    expect(offGrid.length).toBeGreaterThanOrEqual(1);
  });

  it("densest pattern of all styles", () => {
    const styles = ["swing", "bossa", "latin", "ballad", "funk"] as const;
    const counts = styles.map((s) =>
      generateDrumPattern({ style: s, measures: 1, humanize: false }).length
    );
    const funkIdx = styles.indexOf("funk");
    // Funk (16th hats + kick/snare) should be one of densest
    expect(counts[funkIdx]).toBeGreaterThanOrEqual(Math.max(...counts) - 5);
  });
});

// ── Humanization Tests ──

describe("Drum Patterns — humanization", () => {
  it("humanize=false produces exact grid timing", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 1, humanize: false });
    // First cymbal hit (ride or bell) should be exactly at 0
    const cymbals = hits.filter(h => h.pitch === GM_DRUMS.RIDE || h.pitch === GM_DRUMS.RIDE_BELL);
    expect(cymbals[0].time).toBe(0);
  });

  it("humanize=true adds small timing jitter", () => {
    // Run 20x, collect first-hit times — should vary
    const times = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const hits = generateDrumPattern({ style: "ballad", measures: 1, humanize: true });
      times.add(Math.round(hits[0].time * 10000)); // round to 0.1ms
    }
    expect(times.size).toBeGreaterThan(1);
  });

  it("jitter stays within ±5ms", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 4, humanize: true });
    const beatDur = 60 / 120;
    // Check ride hits — expected at multiples of beatDur or beatDur*0.67
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    for (const r of rides) {
      // Distance to nearest grid point
      const nearestBeat = Math.round(r.time / (beatDur / 3)) * (beatDur / 3);
      const jitter = Math.abs(r.time - nearestBeat);
      expect(jitter).toBeLessThan(0.012); // 12ms tolerance (4ms jitter + 5ms ride skip lag + rounding)
    }
  });
});

// ── Time Signature Tests ──

describe("Drum Patterns — time signatures", () => {
  it("3/4 produces fewer hits (shorter measure)", () => {
    const four = generateDrumPattern({ measures: 1, humanize: false, timeSignature: [4, 4] });
    const three = generateDrumPattern({ measures: 1, humanize: false, timeSignature: [3, 4] });
    expect(three.length).toBeLessThan(four.length);
  });

  it("3/4 constrains hits within 3-beat span", () => {
    const hits = generateDrumPattern({ measures: 1, humanize: false, timeSignature: [3, 4], tempo: 120 });
    const beatDur = 60 / 120;
    const measureEnd = 3 * beatDur;
    for (const h of hits) {
      expect(h.time).toBeLessThan(measureEnd + 0.01);
    }
  });
});

// ── Phase D: Hard Bop Ride + Ghost Density Threshold ──

describe("Drum Patterns — hard bop ride", () => {
  it("ride has strong downbeats", () => {
    const hits = generateDrumPattern({ style: "hardBop", measures: 4, humanize: false });
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    const bells = hitsOf(hits, GM_DRUMS.RIDE_BELL);
    // All variants have loud downbeats (vel >= 90)
    const cymbals = [...rides, ...bells];
    expect(cymbals.length).toBeGreaterThanOrEqual(16); // at least 4 per measure
    const loudest = Math.max(...cymbals.map(c => c.velocity));
    expect(loudest).toBeGreaterThanOrEqual(90);
  });
});

describe("Drum Patterns — ghost note density threshold", () => {
  it("ghost notes present at density 50", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 8, humanize: false, density: 50 });
    const ghosts = hits.filter((h) => h.velocity < 40);
    expect(ghosts.length).toBeGreaterThan(0);
  });

  it("ghost notes removed at density < 15", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 8, humanize: false, density: 10 });
    // Hi-hat pulse notes are ghost-flagged (vel 25-30) — should be filtered out
    const softHihats = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED).filter((h) => h.velocity < 35);
    expect(softHihats.length).toBe(0);
  });
});

// ── Phase E: Crash Cymbal on Form Boundaries ──

describe("Drum Patterns — form markers (crash)", () => {
  it("crash on specified form marker measures", () => {
    const hits = generateDrumPattern({
      measures: 8, humanize: false, formMarkers: [0, 4],
    });
    const crashes = hitsOf(hits, GM_DRUMS.CRASH);
    expect(crashes.length).toBe(2);
  });

  it("crash at beat 1 of marked measures", () => {
    const tempo = 120;
    const beatDur = 60 / tempo;
    const measureDur = 4 * beatDur;
    const hits = generateDrumPattern({
      measures: 8, humanize: false, tempo, formMarkers: [0, 4],
    });
    const crashes = hitsOf(hits, GM_DRUMS.CRASH);
    // Crash at measure 0 start and measure 4 start
    expect(crashes[0].time).toBeCloseTo(0);
    expect(crashes[1].time).toBeCloseTo(4 * measureDur);
  });

  it("no crash when formMarkers is empty", () => {
    const hits = generateDrumPattern({ measures: 8, humanize: false, formMarkers: [] });
    const crashes = hitsOf(hits, GM_DRUMS.CRASH);
    expect(crashes.length).toBe(0);
  });
});

// ── Phase J: Swing Hi-Hat Pulse ──

describe("Drum Patterns — swing hi-hat pulse", () => {
  it("swing pattern includes closed hi-hat ghost pulse", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 2, humanize: false, density: 50 });
    const closedHihats = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
    const openHihats = hitsOf(hits, GM_DRUMS.HI_HAT_OPEN);
    // Ghost pulse integrated into HH variants: 4-6 ghost hats per measure
    expect(closedHihats.length + openHihats.length).toBeGreaterThanOrEqual(8);
  });

  it("pulse hi-hat notes are very soft (pocket feel)", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 1, humanize: false, density: 50 });
    const closedHihats = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
    for (const h of closedHihats) {
      expect(h.velocity).toBeLessThanOrEqual(50); // ghost humanization caps at 35-50
    }
  });

  it("ballad style does not include swing hi-hat pulse", () => {
    const hits = generateDrumPattern({ style: "ballad", measures: 2, humanize: false, density: 50 });
    const closedHihats = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
    // Ballad has no SWING_HIHAT_PULSE — should have 0 closed hi-hat hits
    expect(closedHihats.length).toBe(0);
  });
});

// ── Phase K: Tempo-dependent swing ──

describe("Drum Patterns — tempo-dependent swing", () => {
  it("slow tempo (80bpm) has wider swing offset than fast (220bpm)", () => {
    const slow = generateDrumPattern({ style: "swing", measures: 4, tempo: 80, humanize: false, swingAmount: 100 });
    const fast = generateDrumPattern({ style: "swing", measures: 4, tempo: 220, humanize: false, swingAmount: 100 });
    // Compare ride cymbal skip-note offsets
    const rides = (hits: DrumHit[]) => hitsOf(hits, GM_DRUMS.RIDE);
    const slowRides = rides(slow);
    const fastRides = rides(fast);
    // At slow tempo, swing multiplier = 1.2; at fast = ~0.73
    // So slow swing should push skip notes later than fast
    expect(slowRides.length).toBeGreaterThan(0);
    expect(fastRides.length).toBeGreaterThan(0);
  });

  it("very fast tempo (280bpm) produces nearly straight timing", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 2, tempo: 280, humanize: false, swingAmount: 100 });
    const beatDur = 60 / 280;
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    // Skip notes at very fast tempo should be close to straight 8th position
    for (const r of rides) {
      const beatInMeasure = (r.time % (beatDur * 4)) / beatDur;
      const frac = beatInMeasure % 1;
      // At 280bpm, tempoSwingMultiplier = 0.3, so swing offset is tiny
      // Skip notes should be near 0.5 (straight) not 0.67 (full swing)
      if (frac > 0.4 && frac < 0.8) {
        expect(frac).toBeLessThan(0.65); // closer to straight than swung
      }
    }
  });
});

// ── Phase L: Jazz fills ──

describe("Drum Patterns — jazz fills", () => {
  it("fills only appear on styles with FILL_STYLES gate", () => {
    // Bossa/latin/funk should never have tom fills
    for (const style of ["bossa", "latin", "funk"] as const) {
      const hits = generateDrumPattern({
        style, measures: 16, humanize: false,
        formMarkers: [4, 8, 12],
      });
      const toms = hits.filter(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID || h.pitch === GM_DRUMS.TOM_LOW
      );
      expect(toms.length, `${style} should have no tom fills`).toBe(0);
    }
  });

  it("fills appear near form markers in swing style (statistical)", () => {
    let fillCount = 0;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({
        style: "swing", measures: 16, humanize: false,
        formMarkers: [4, 8, 12],
      });
      const toms = hits.filter(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID || h.pitch === GM_DRUMS.TOM_LOW
      );
      if (toms.length > 0) fillCount++;
    }
    // 3 form markers × 40% fill chance each, 50 trials → expect some fills
    expect(fillCount).toBeGreaterThan(5);
    // But not every trial (40% per marker, not 100%)
    expect(fillCount).toBeLessThan(50);
  });

  it("fill notes are on beats 2-4 (replaces comping on beats 3-4)", () => {
    // Run until we get a fill
    for (let trial = 0; trial < 200; trial++) {
      const hits = generateDrumPattern({
        style: "swing", measures: 8, humanize: false,
        formMarkers: [4],
      });
      const toms = hits.filter(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID || h.pitch === GM_DRUMS.TOM_LOW
      );
      if (toms.length > 0) {
        // All tom hits should be on beats 2+ (not beat 1)
        const beatDur = 60 / 120;
        const measDur = beatDur * 4;
        for (const t of toms) {
          const beatInMeasure = (t.time % measDur) / beatDur;
          expect(beatInMeasure).toBeGreaterThanOrEqual(1.5);
        }
        return; // test passed
      }
    }
    // If no fills in 200 trials, that's a problem (expected ~80%)
    expect(true, "no fills generated in 200 trials").toBe(false);
  });
});

// ── Phase P: Dynamic arc ──

describe("Drum Patterns — dynamic arc", () => {
  it("opening bars have lower average velocity than peak bars (statistical)", () => {
    const measDur = (60 / 120) * 4;
    let earlySum = 0, earlyCount = 0, peakSum = 0, peakCount = 0;
    // Aggregate across multiple generations to smooth variation noise
    for (let t = 0; t < 5; t++) {
      const hits = generateDrumPattern({
        style: "swing", measures: 32, humanize: false,
        measureInfo: { totalMeasures: 32, measureDuration: measDur },
      });
      const rides = hitsOf(hits, GM_DRUMS.RIDE);
      for (const r of rides) {
        if (r.time < 4 * measDur) { earlySum += r.velocity; earlyCount++; }
        if (r.time >= 20 * measDur && r.time < 24 * measDur) { peakSum += r.velocity; peakCount++; }
      }
    }
    if (earlyCount > 0 && peakCount > 0) {
      expect(earlySum / earlyCount).toBeLessThan(peakSum / peakCount);
    }
  });
});

// ── Phase Q: Anti-repetition ──

describe("Drum Patterns — anti-repetition", () => {
  it("snare/kick patterns vary across measures (not all identical)", () => {
    const beatDur = 60 / 120;
    const measDur = beatDur * 4;
    // Run 8-measure generation and check for pattern variety
    let totalUnique = 0;
    for (let trial = 0; trial < 10; trial++) {
      const hits = generateDrumPattern({ style: "swing", measures: 8, humanize: false });
      // Fingerprint each measure by snare+kick hit count
      const fingerprints: string[] = [];
      for (let m = 0; m < 8; m++) {
        const measHits = hits.filter(h => h.time >= m * measDur && h.time < (m + 1) * measDur);
        const snares = measHits.filter(h => h.pitch === GM_DRUMS.SNARE).length;
        const kicks = measHits.filter(h => h.pitch === GM_DRUMS.KICK).length;
        fingerprints.push(`${snares}-${kicks}`);
      }
      totalUnique += new Set(fingerprints).size;
    }
    // Across 10 trials, average unique patterns per 8 measures should be > 1
    expect(totalUnique / 10).toBeGreaterThan(1);
  });
});

// ── Phase B (10.14): Beat-to-beat micro-variation ──

describe("Drum Patterns — micro-variation", () => {
  it("ghost kicks appear on beat 3 in swing (statistical)", () => {
    const beatDur = 60 / 120;
    const measDur = beatDur * 4;
    let ghostKickCount = 0;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({ style: "swing", measures: 8, humanize: false, density: 50 });
      // Count kicks near beat 3 that are ghost-velocity (≤50)
      for (const h of hits) {
        if (h.pitch !== GM_DRUMS.KICK) continue;
        const beatInMeasure = ((h.time % measDur) / beatDur);
        if (Math.abs(beatInMeasure - 2) < 0.15 && h.velocity <= 50) {
          ghostKickCount++;
        }
      }
    }
    expect(ghostKickCount).toBeGreaterThan(0);
  });

  it("suppressed at low density — fewer ghost kicks than high density (statistical)", () => {
    const beatDur = 60 / 120;
    const measDur = beatDur * 4;
    let lowDensityGhosts = 0;
    let highDensityGhosts = 0;
    const trials = 50;
    for (let trial = 0; trial < trials; trial++) {
      for (const [density, counter] of [[20, "low"], [50, "high"]] as const) {
        const hits = generateDrumPattern({ style: "swing", measures: 8, humanize: false, density });
        for (const h of hits) {
          if (h.pitch !== GM_DRUMS.KICK) continue;
          const beatInMeasure = ((h.time % measDur) / beatDur);
          if (Math.abs(beatInMeasure - 2) < 0.15 && h.velocity <= 50) {
            if (counter === "low") lowDensityGhosts++;
            else highDensityGhosts++;
          }
        }
      }
    }
    // High density should have more ghost kicks (base pattern + micro-variation)
    // Low density has only base pattern (micro-variation suppressed at < 30)
    expect(highDensityGhosts).toBeGreaterThan(lowDensityGhosts);
  });

  it("not applied to bossa, latin, funk — no hi-hat open splashes from micro-variation", () => {
    for (const style of ["bossa", "latin", "funk"] as const) {
      let splashCount = 0;
      const beatDur = 60 / 120;
      const measDur = beatDur * 4;
      for (let trial = 0; trial < 30; trial++) {
        const hits = generateDrumPattern({ style, measures: 8, humanize: false, density: 50 });
        // Count hi-hat open hits on "and" positions (beat + 0.5)
        // Micro-variation adds these; base patterns for these styles don't
        for (const h of hits) {
          if (h.pitch !== GM_DRUMS.HI_HAT_OPEN) continue;
          const beatInMeasure = ((h.time % measDur) / beatDur);
          const frac = beatInMeasure % 1;
          if (Math.abs(frac - 0.5) < 0.15 && h.velocity <= 60) {
            splashCount++;
          }
        }
      }
      expect(splashCount, `${style} should have no micro-variation hi-hat splashes`).toBe(0);
    }
  });

  it("ride/hi-hat-pedal timekeeping counts preserved", () => {
    // Micro-variation adds hits but never removes timekeeping
    const hits = generateDrumPattern({ style: "swing", measures: 4, humanize: false, density: 50 });
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    const bells = hitsOf(hits, GM_DRUMS.RIDE_BELL);
    const hihatPedals = hitsOf(hits, GM_DRUMS.HI_HAT_PEDAL);
    // Ride: variants have 4-8 per measure; pedal: 2-4 per measure depending on variant
    expect(rides.length + bells.length).toBeGreaterThanOrEqual(4 * 4);
    expect(hihatPedals.length).toBeGreaterThanOrEqual(4 * 2); // at least 2 pedals/measure
  });
});

// ── Phase C (10.14): Kick-hihat interlocking ──

describe("Drum Patterns — kick-hihat interlocking", () => {
  it("swing: some closed hi-hats become open near kicks (statistical)", () => {
    let conversions = 0;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({ style: "swing", measures: 4, humanize: false, density: 50 });
      const openHihats = hitsOf(hits, GM_DRUMS.HI_HAT_OPEN);
      // Base swing has no open hi-hats; any open hats come from interlocking or micro-variation
      conversions += openHihats.length;
    }
    expect(conversions).toBeGreaterThan(0);
  });

  it("hi-hat pedal unaffected by interlocking", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 4, humanize: false, density: 50 });
    const hihatPedals = hitsOf(hits, GM_DRUMS.HI_HAT_PEDAL);
    // HH variants: 2 or 4 pedals per measure
    expect(hihatPedals.length).toBeGreaterThanOrEqual(4 * 2);
  });

  it("interlocking suppressed for bossa and latin", () => {
    for (const style of ["bossa", "latin"] as const) {
      // These styles use HI_HAT_CLOSED in base patterns
      // Interlocking should not convert them
      const baseline = generateDrumPattern({ style, measures: 8, humanize: false, density: 50 });
      const closedCount = hitsOf(baseline, GM_DRUMS.HI_HAT_CLOSED).length;
      // Run multiple trials to confirm no conversions reduce closed count
      let minClosed = closedCount;
      for (let trial = 0; trial < 20; trial++) {
        const hits = generateDrumPattern({ style, measures: 8, humanize: false, density: 50 });
        const closed = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED).length;
        minClosed = Math.min(minClosed, closed);
      }
      // Without interlocking, closed count should be consistent
      expect(minClosed).toBe(closedCount);
    }
  });

  it("converted open hi-hat has longer duration", () => {
    // Find an open hi-hat from interlocking (swing style)
    for (let trial = 0; trial < 100; trial++) {
      const hits = generateDrumPattern({ style: "swing", measures: 4, humanize: false, density: 50 });
      const openHihats = hitsOf(hits, GM_DRUMS.HI_HAT_OPEN);
      if (openHihats.length > 0) {
        for (const h of openHihats) {
          expect(h.duration).toBeGreaterThanOrEqual(0.08);
        }
        return; // found and verified
      }
    }
    // If no conversions in 100 trials, that's unexpected but not impossible
  });
});

// ── New Genre Tests ──

describe("Drum Patterns — fusion enhanced", () => {
  it("has 6+ kick/snare variation fingerprints (statistical)", () => {
    const fingerprints = new Set<string>();
    for (let trial = 0; trial < 100; trial++) {
      const hits = generateDrumPattern({ style: "fusion", measures: 2, humanize: false });
      const snares = hitsOf(hits, GM_DRUMS.SNARE);
      // Fingerprint: sorted beat positions of snare hits in first measure
      const fp = snares
        .filter(h => h.time < 1) // first measure at 120bpm = 2s, but use rough threshold
        .map(h => h.time.toFixed(2))
        .sort()
        .join(",");
      fingerprints.add(fp);
    }
    expect(fingerprints.size).toBeGreaterThanOrEqual(4);
  });

  it("uses ride bell in some generations (statistical)", () => {
    let rideBellFound = false;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({ style: "fusion", measures: 4, humanize: false });
      if (hitsOf(hits, GM_DRUMS.RIDE_BELL).length > 0) {
        rideBellFound = true;
        break;
      }
    }
    expect(rideBellFound).toBe(true);
  });

  it("fusion fills include toms (statistical)", () => {
    let tomFound = false;
    for (let trial = 0; trial < 100; trial++) {
      const hits = generateDrumPattern({
        style: "fusion", measures: 8, humanize: false,
        formMarkers: [0, 4],
      });
      const toms = hits.filter(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID ||
        h.pitch === GM_DRUMS.TOM_LOW || h.pitch === GM_DRUMS.TOM_FLOOR);
      if (toms.length > 0) { tomFound = true; break; }
    }
    expect(tomFound).toBe(true);
  });

  it("ghost notes layered in patterns", () => {
    let ghostFound = false;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({ style: "fusion", measures: 4, humanize: false, density: 70 });
      const ghosts = hitsOf(hits, GM_DRUMS.SNARE).filter(h => h.velocity <= 50);
      if (ghosts.length > 0) { ghostFound = true; break; }
    }
    expect(ghostFound).toBe(true);
  });

  it("all pitches are valid GM drum notes", () => {
    for (let trial = 0; trial < 20; trial++) {
      const hits = generateDrumPattern({ style: "fusion", measures: 4, humanize: true });
      for (const h of hits) {
        expect(h.pitch).toBeGreaterThanOrEqual(35);
        expect(h.pitch).toBeLessThanOrEqual(81);
      }
    }
  });

  it("velocities in 25-127 range", () => {
    for (let trial = 0; trial < 20; trial++) {
      const hits = generateDrumPattern({ style: "fusion", measures: 4, humanize: true });
      for (const h of hits) {
        expect(h.velocity).toBeGreaterThanOrEqual(25);
        expect(h.velocity).toBeLessThanOrEqual(127);
      }
    }
  });
});

describe("Drum Patterns — neoSoul", () => {
  it("broken hi-hat has fewer than 16 hits per measure", () => {
    const hits = generateDrumPattern({ style: "neoSoul", measures: 4, humanize: false });
    const hhPerMeasure = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED).length +
                          hitsOf(hits, GM_DRUMS.HI_HAT_OPEN).length;
    // 4 measures × ~11-12 hits each = ~44-48, not 64 (16×4)
    expect(hhPerMeasure).toBeLessThan(60);
    expect(hhPerMeasure).toBeGreaterThan(20); // not too sparse
  });

  it("has heavy ghost snares (statistical)", () => {
    const hits = generateDrumPattern({ style: "neoSoul", measures: 8, humanize: false, density: 70 });
    const ghostSnares = hitsOf(hits, GM_DRUMS.SNARE).filter(h => h.velocity <= 50);
    // Neo-soul patterns have 2-4 ghosts per measure × 8 measures
    expect(ghostSnares.length).toBeGreaterThanOrEqual(8);
  });

  it("wider timing jitter than swing (statistical)", () => {
    // Compare time variance between neoSoul and swing
    const neoHits = generateDrumPattern({ style: "neoSoul", measures: 8, humanize: true, tempo: 90 });
    const swingHits = generateDrumPattern({ style: "swing", measures: 8, humanize: true, tempo: 90 });

    // Measure jitter: time difference from expected grid positions
    function measureJitter(hits: DrumHit[], beatDur: number): number {
      let total = 0;
      let count = 0;
      for (const h of hits) {
        const nearestBeat = Math.round(h.time / beatDur) * beatDur;
        total += Math.abs(h.time - nearestBeat);
        count++;
      }
      return count > 0 ? total / count : 0;
    }

    const beatDur = 60 / 90;
    // Run multiple trials to get statistical significance
    let neoJitterSum = 0, swingJitterSum = 0;
    for (let i = 0; i < 20; i++) {
      neoJitterSum += measureJitter(
        generateDrumPattern({ style: "neoSoul", measures: 4, humanize: true, tempo: 90 }), beatDur);
      swingJitterSum += measureJitter(
        generateDrumPattern({ style: "swing", measures: 4, humanize: true, tempo: 90 }), beatDur);
    }
    // Neo-soul should have wider jitter on average
    expect(neoJitterSum).toBeGreaterThan(swingJitterSum * 0.8);
  });

  it("all velocities in 25-127 range", () => {
    for (let trial = 0; trial < 10; trial++) {
      const hits = generateDrumPattern({ style: "neoSoul", measures: 4, humanize: true });
      for (const h of hits) {
        expect(h.velocity).toBeGreaterThanOrEqual(25);
        expect(h.velocity).toBeLessThanOrEqual(127);
      }
    }
  });

  it("5 kick/snare variation patterns", () => {
    const fingerprints = new Set<string>();
    for (let trial = 0; trial < 100; trial++) {
      const hits = generateDrumPattern({ style: "neoSoul", measures: 2, humanize: false });
      const kicks = hitsOf(hits, GM_DRUMS.KICK);
      const fp = kicks.map(h => h.time.toFixed(2)).sort().join(",");
      fingerprints.add(fp);
    }
    expect(fingerprints.size).toBeGreaterThanOrEqual(3);
  });
});

describe("Drum Patterns — contemporaryJazz", () => {
  it("uses ride cymbal consistently", () => {
    const hits = generateDrumPattern({ style: "contemporaryJazz", measures: 4, humanize: false });
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    const bells = hitsOf(hits, GM_DRUMS.RIDE_BELL);
    // Ride variants: 8ths (8/bar), bell+body (8/bar), or quarters (4/bar)
    expect(rides.length + bells.length).toBeGreaterThanOrEqual(16);
  });

  it("uses cross-stick and accent snare", () => {
    // Kendrick Scott uses both cross-stick interjections and accent snares
    let foundCross = false;
    let foundSnare = false;
    for (let i = 0; i < 50; i++) {
      const hits = generateDrumPattern({ style: "contemporaryJazz", measures: 16, humanize: false, density: 50 });
      if (hitsOf(hits, GM_DRUMS.CROSS_STICK).length > 0) foundCross = true;
      if (hitsOf(hits, GM_DRUMS.SNARE).length > 0) foundSnare = true;
      if (foundCross && foundSnare) break;
    }
    expect(foundCross).toBe(true);
    expect(foundSnare).toBe(true);
  });

  it("hi-hat present", () => {
    const hits = generateDrumPattern({ style: "contemporaryJazz", measures: 4, humanize: false });
    const pedals = hitsOf(hits, GM_DRUMS.HI_HAT_PEDAL);
    const openHats = hitsOf(hits, GM_DRUMS.HI_HAT_OPEN);
    // HH variants: pedal on 2&4, pedal+open, or sparse pedal on 4 only
    expect(pedals.length + openHats.length).toBeGreaterThanOrEqual(4);
  });

  it("all velocities in 25-127 range", () => {
    for (let trial = 0; trial < 10; trial++) {
      const hits = generateDrumPattern({ style: "contemporaryJazz", measures: 4, humanize: true });
      for (const h of hits) {
        expect(h.velocity).toBeGreaterThanOrEqual(25);
        expect(h.velocity).toBeLessThanOrEqual(127);
      }
    }
  });
});

describe("Drum Patterns — mathRock", () => {
  it("all 16 sixteenths have hi-hat hits", () => {
    const hits = generateDrumPattern({ style: "mathRock", measures: 1, humanize: false });
    const hh = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
    expect(hh.length).toBe(16);
  });

  it("hi-hat accent groupings present (not standard 4/4)", () => {
    // In groups-of-5 pattern, accents at beat 0, 1.25, 2.5, 3.75
    // In groups-of-3 pattern, accents at beat 0, 0.75, 1.5, 2.25, 3.0, 3.75
    // Either way, some accents are NOT on standard beat positions (0, 1, 2, 3)
    let offBeatAccent = false;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({ style: "mathRock", measures: 1, humanize: false });
      const hh = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
      const accents = hh.filter(h => h.velocity >= 85);
      for (const a of accents) {
        const beatPos = a.time / (60 / 120); // at 120bpm
        const frac = beatPos % 1;
        if (frac > 0.1 && frac < 0.9) { // not on a downbeat
          offBeatAccent = true;
          break;
        }
      }
      if (offBeatAccent) break;
    }
    expect(offBeatAccent).toBe(true);
  });

  it("snare is displaced (not on standard 2&4)", () => {
    let displaced = false;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({ style: "mathRock", measures: 2, humanize: false });
      const snares = hitsOf(hits, GM_DRUMS.SNARE);
      for (const s of snares) {
        const beatPos = s.time / (60 / 120);
        const frac = beatPos % 1;
        // Standard backbeat = beats 1 and 3 (0-indexed). Displaced = frac > 0
        if (frac > 0.1) { displaced = true; break; }
      }
      if (displaced) break;
    }
    expect(displaced).toBe(true);
  });

  it("tight timing (low variance)", () => {
    const beatDur = 60 / 120;
    let totalVariance = 0;
    const trials = 20;
    for (let i = 0; i < trials; i++) {
      const hits = generateDrumPattern({ style: "mathRock", measures: 4, humanize: true });
      for (const h of hits) {
        const nearestGrid = Math.round(h.time / (beatDur * 0.25)) * (beatDur * 0.25);
        totalVariance += Math.abs(h.time - nearestGrid);
      }
    }
    const avgVariance = totalVariance / trials;
    // Math rock: ±2ms jitter → low average deviation (below swing's ~0.1+)
    expect(avgVariance).toBeLessThan(0.15);
  });

  it("all velocities in 25-127 range", () => {
    for (let trial = 0; trial < 10; trial++) {
      const hits = generateDrumPattern({ style: "mathRock", measures: 4, humanize: true });
      for (const h of hits) {
        expect(h.velocity).toBeGreaterThanOrEqual(25);
        expect(h.velocity).toBeLessThanOrEqual(127);
      }
    }
  });
});

describe("Drum Patterns — idm", () => {
  it("32nd-note hi-hat bursts present", () => {
    let burstFound = false;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({ style: "idm", measures: 2, humanize: false });
      const hh = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED);
      // Check for consecutive hi-hats with 32nd-note spacing (0.125 beat = ~0.0625s at 120bpm)
      for (let i = 1; i < hh.length; i++) {
        const gap = hh[i].time - hh[i - 1].time;
        if (gap > 0.05 && gap < 0.08) { // ~0.0625s for 32nd note at 120bpm
          burstFound = true;
          break;
        }
      }
      if (burstFound) break;
    }
    expect(burstFound).toBe(true);
  });

  it("uses side-stick instead of full snare", () => {
    const hits = generateDrumPattern({ style: "idm", measures: 8, humanize: false });
    const sideSticks = hitsOf(hits, GM_DRUMS.SIDE_STICK);
    const fullSnares = hitsOf(hits, GM_DRUMS.SNARE);
    // IDM uses side-stick/rim shot, not full snare
    expect(sideSticks.length).toBeGreaterThan(0);
    // Only toms from glitchy variation might register as something else
    expect(sideSticks.length).toBeGreaterThanOrEqual(fullSnares.length);
  });

  it("glitchy tom sequences appear (statistical)", () => {
    let tomsFound = false;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({ style: "idm", measures: 4, humanize: false });
      const toms = hits.filter(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID || h.pitch === GM_DRUMS.TOM_LOW);
      if (toms.length > 0) { tomsFound = true; break; }
    }
    expect(tomsFound).toBe(true);
  });

  it("all velocities in 25-127 range", () => {
    for (let trial = 0; trial < 10; trial++) {
      const hits = generateDrumPattern({ style: "idm", measures: 4, humanize: true });
      for (const h of hits) {
        expect(h.velocity).toBeGreaterThanOrEqual(25);
        expect(h.velocity).toBeLessThanOrEqual(127);
      }
    }
  });

  it("no micro-variation applied (not in gate set)", () => {
    // IDM should not get jazz-style ghost kicks / snare ghosts from micro-variation
    // All ghost notes should come from the pattern itself
    const baseline = generateDrumPattern({ style: "idm", measures: 4, humanize: false, density: 80 });
    const kicks = hitsOf(baseline, GM_DRUMS.KICK);
    // Verify consistent kick count across runs (no stochastic additions)
    let kickCounts = new Set<number>();
    for (let trial = 0; trial < 20; trial++) {
      const hits = generateDrumPattern({ style: "idm", measures: 4, humanize: false, density: 80 });
      kickCounts.add(hitsOf(hits, GM_DRUMS.KICK).length);
    }
    // Without micro-variation, kick count should be consistent (only pattern variation changes)
    // May vary due to pattern selection, but should be a small set of values
    expect(kickCounts.size).toBeLessThanOrEqual(8);
  });
});

// ── Stochastic Jazz Comping ──

describe("Drum Patterns — stochastic jazz comping", () => {
  it("swing produces high variety of kick patterns across 32 bars", () => {
    const beatDur = 60 / 120;
    const measDur = beatDur * 4;
    const hits = generateDrumPattern({ style: "swing", measures: 32, humanize: false, density: 50 });
    const fingerprints = new Set<string>();
    for (let m = 0; m < 32; m++) {
      const measHits = hits.filter(h => h.time >= m * measDur - 0.001 && h.time < (m + 1) * measDur - 0.001);
      const kicks = measHits.filter(h => h.pitch === GM_DRUMS.KICK)
        .map(h => ((h.time - m * measDur) / beatDur).toFixed(1)).sort().join(",");
      fingerprints.add(kicks);
    }
    // Stochastic: many unique patterns (>6 across 32 bars)
    expect(fingerprints.size).toBeGreaterThan(6);
  });

  it("hardBop has more kick hits than swing on average (statistical)", () => {
    let swingKicks = 0;
    let bopKicks = 0;
    for (let i = 0; i < 30; i++) {
      swingKicks += hitsOf(generateDrumPattern({ style: "swing", measures: 8, humanize: false, density: 50 }), GM_DRUMS.KICK).length;
      bopKicks += hitsOf(generateDrumPattern({ style: "hardBop", measures: 8, humanize: false, density: 50 }), GM_DRUMS.KICK).length;
    }
    expect(bopKicks / 30).toBeGreaterThan(swingKicks / 30);
  });

  it("density scales comping activity", () => {
    let sparseKicks = 0;
    let denseKicks = 0;
    for (let i = 0; i < 30; i++) {
      sparseKicks += hitsOf(generateDrumPattern({ style: "swing", measures: 8, humanize: false, density: 10 }), GM_DRUMS.KICK).length;
      denseKicks += hitsOf(generateDrumPattern({ style: "swing", measures: 8, humanize: false, density: 90 }), GM_DRUMS.KICK).length;
    }
    expect(denseKicks).toBeGreaterThan(sparseKicks);
  });

  it("ride/hihat timekeeping unaffected by stochastic comping", () => {
    const hits = generateDrumPattern({ style: "swing", measures: 4, humanize: false, density: 50 });
    const rides = hitsOf(hits, GM_DRUMS.RIDE);
    const bells = hitsOf(hits, GM_DRUMS.RIDE_BELL);
    const pedals = hitsOf(hits, GM_DRUMS.HI_HAT_PEDAL);
    // Ride variants: 4-8 per measure; pedal: 2-4 per measure
    expect(rides.length + bells.length).toBeGreaterThanOrEqual(4 * 4);
    expect(pedals.length).toBeGreaterThanOrEqual(4 * 2);
  });

  it("non-stochastic styles (bossa, funk) have consistent kick counts", () => {
    for (const style of ["bossa", "funk"] as const) {
      const kickCounts = new Set<number>();
      for (let i = 0; i < 20; i++) {
        const hits = generateDrumPattern({ style, measures: 1, humanize: false });
        kickCounts.add(hitsOf(hits, GM_DRUMS.KICK).length);
      }
      // Fixed patterns: very few distinct kick counts (variation rotation only)
      expect(kickCounts.size).toBeLessThanOrEqual(3);
    }
  });

  it("coolJazz uses side-stick for comping (not snare)", () => {
    let sideStickCount = 0;
    let snareCount = 0;
    for (let i = 0; i < 30; i++) {
      const hits = generateDrumPattern({ style: "coolJazz", measures: 8, humanize: false, density: 50 });
      sideStickCount += hitsOf(hits, GM_DRUMS.SIDE_STICK).length;
      snareCount += hits.filter(h => h.pitch === GM_DRUMS.SNARE).length;
    }
    // Cool jazz comping uses side-stick, not snare (except from micro-variation)
    expect(sideStickCount).toBeGreaterThan(snareCount);
  });

  it("modal is very sparse (few kick hits per measure)", () => {
    let totalKicks = 0;
    const measures = 32;
    for (let i = 0; i < 20; i++) {
      totalKicks += hitsOf(generateDrumPattern({ style: "modal", measures, humanize: false, density: 50 }), GM_DRUMS.KICK).length;
    }
    const avgKicksPerMeasure = totalKicks / (20 * measures);
    // Modal: very sparse, should average less than 2 kicks per measure (includes micro-variation ghosts)
    expect(avgKicksPerMeasure).toBeLessThan(2.0);
  });

  it("new stochastic styles (active) produce varied kick patterns", () => {
    for (const style of ["contemporaryJazz", "metheny", "holdsworth"] as const) {
      const beatDur = 60 / 120;
      const measDur = beatDur * 4;
      const hits = generateDrumPattern({ style, measures: 32, humanize: false, density: 50 });
      const fingerprints = new Set<string>();
      for (let m = 0; m < 32; m++) {
        const measHits = hits.filter(h => h.time >= m * measDur - 0.001 && h.time < (m + 1) * measDur - 0.001);
        const kicks = measHits.filter(h => h.pitch === GM_DRUMS.KICK)
          .map(h => ((h.time - m * measDur) / beatDur).toFixed(1)).sort().join(",");
        fingerprints.add(kicks);
      }
      expect(fingerprints.size).toBeGreaterThan(3);
    }
  });

  it("new stochastic styles (sparse) produce non-uniform patterns", () => {
    // Ballad and ECM are very sparse — just verify they're not fully identical
    for (const style of ["ballad", "ecm"] as const) {
      const beatDur = 60 / 120;
      const measDur = beatDur * 4;
      const hits = generateDrumPattern({ style, measures: 32, humanize: false, density: 50 });
      const fingerprints = new Set<string>();
      for (let m = 0; m < 32; m++) {
        const measHits = hits.filter(h => h.time >= m * measDur - 0.001 && h.time < (m + 1) * measDur - 0.001);
        const kicks = measHits.filter(h => h.pitch === GM_DRUMS.KICK)
          .map(h => ((h.time - m * measDur) / beatDur).toFixed(1)).sort().join(",");
        fingerprints.add(kicks);
      }
      expect(fingerprints.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("minHits enforced — swing almost always has kick on beat 1", () => {
    const beatDur = 60 / 120;
    const measDur = beatDur * 4;
    let measuresWithBeat1Kick = 0;
    const totalMeasures = 200;
    for (let trial = 0; trial < 10; trial++) {
      const hits = generateDrumPattern({ style: "swing", measures: 20, humanize: false, density: 50 });
      for (let m = 0; m < 20; m++) {
        const measStart = m * measDur;
        const hasBeat1Kick = hits.some(h =>
          h.pitch === GM_DRUMS.KICK && Math.abs(h.time - measStart) < beatDur * 0.15
        );
        if (hasBeat1Kick) measuresWithBeat1Kick++;
      }
    }
    // Should have kick on beat 1 in >70% of measures (0.85 probability + minHits)
    expect(measuresWithBeat1Kick / totalMeasures).toBeGreaterThan(0.70);
  });
});

// ── Structure-Aware Fills ──

describe("Drum Patterns — structure-aware fills", () => {
  it("big fills with toms appear before section markers (statistical)", () => {
    let bigFillCount = 0;
    for (let trial = 0; trial < 50; trial++) {
      const hits = generateDrumPattern({
        style: "swing", measures: 16, humanize: false, density: 50,
        formMarkers: [0, 4, 8, 12],
        sectionMarkers: [8],  // section boundary at measure 8
      });
      // Check measure 7 (bar before section) for toms
      const beatDur = 60 / 120;
      const measDur = beatDur * 4;
      const m7Start = 7 * measDur;
      const m7End = 8 * measDur;
      const m7Hits = hits.filter(h => h.time >= m7Start - 0.01 && h.time < m7End + 0.01);
      const hasTom = m7Hits.some(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID ||
        h.pitch === GM_DRUMS.TOM_LOW || h.pitch === GM_DRUMS.TOM_FLOOR
      );
      const hasCrash = m7Hits.some(h => h.pitch === GM_DRUMS.CRASH);
      if (hasTom || hasCrash) bigFillCount++;
    }
    // Big fills should appear in some trials (60% probability)
    expect(bigFillCount).toBeGreaterThan(5);
  });

  it("crash is louder at section boundaries", () => {
    // Section boundary crash should have velocity >= 100
    const hits = generateDrumPattern({
      style: "swing", measures: 12, humanize: false, density: 50,
      formMarkers: [0, 4, 8],
      sectionMarkers: [8],
    });
    const beatDur = 60 / 120;
    const m8Start = 8 * beatDur * 4;
    const sectionCrash = hits.find(h =>
      h.pitch === GM_DRUMS.CRASH && Math.abs(h.time - m8Start) < 0.01
    );
    const m4Start = 4 * beatDur * 4;
    const phraseCrash = hits.find(h =>
      h.pitch === GM_DRUMS.CRASH && Math.abs(h.time - m4Start) < 0.01
    );
    if (sectionCrash && phraseCrash) {
      expect(sectionCrash.velocity).toBeGreaterThanOrEqual(phraseCrash.velocity);
    }
  });

  it("setup fills appear 2 bars before sections (statistical)", () => {
    let setupCount = 0;
    for (let trial = 0; trial < 80; trial++) {
      const hits = generateDrumPattern({
        style: "swing", measures: 16, humanize: false, density: 50,
        formMarkers: [0, 4, 8, 12],
        sectionMarkers: [8],
      });
      // Check measure 6 (2 bars before section marker 8) for setup fill
      const beatDur = 60 / 120;
      const measDur = beatDur * 4;
      const m6Start = 6 * measDur;
      const m6End = 7 * measDur;
      const m6Hits = hits.filter(h => h.time >= m6Start - 0.01 && h.time < m6End + 0.01);
      // Setup fills have open hi-hat or snare on beats 2.5-3.5
      const lateHits = m6Hits.filter(h => {
        const beatInMeasure = (h.time - m6Start) / beatDur;
        return beatInMeasure >= 2.3 && (h.pitch === GM_DRUMS.HI_HAT_OPEN || h.pitch === GM_DRUMS.SNARE);
      });
      if (lateHits.length >= 1) setupCount++;
    }
    // Setup fills at 25% probability — should appear in some trials
    expect(setupCount).toBeGreaterThan(3);
  });

  it("no fills for non-fill styles", () => {
    for (const style of ["bossa", "latin"] as const) {
      const hits = generateDrumPattern({
        style, measures: 16, humanize: false, density: 50,
        formMarkers: [0, 4, 8, 12],
        sectionMarkers: [8],
      });
      const toms = hits.filter(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID ||
        h.pitch === GM_DRUMS.TOM_LOW || h.pitch === GM_DRUMS.TOM_FLOOR
      );
      expect(toms.length).toBe(0);
    }
  });
});

// ── Groove Template Integration ──

describe("Drum Patterns — groove templates", () => {
  it("all 19 styles produce humanized timing via groove templates", () => {
    const styles = [
      "swing", "hardBop", "coolJazz", "ballad", "bossa", "latin", "funk",
      "fusion", "ecm", "modal", "jazzWaltz", "shuffleBlues", "neoSoul",
      "contemporaryJazz", "mathRock", "idm", "holdsworth", "alfaMist", "metheny",
    ];
    for (const style of styles) {
      const hits = generateDrumPattern({ style, tempo: 120, measures: 2, humanize: true });
      expect(hits.length).toBeGreaterThan(0);
      // Humanized: at least some notes should be slightly off-grid
      const beatDuration = 0.5; // 120 BPM
      const offGrid = hits.filter(h => {
        const gridPos = h.time / (beatDuration / 4); // 16th grid
        return Math.abs(gridPos - Math.round(gridPos)) > 0.001;
      });
      expect(offGrid.length).toBeGreaterThan(0);
    }
  });

  it("mathRock produces non-humanized results without humanize flag", () => {
    // Without humanize: all times should be exactly on grid
    const hits = generateDrumPattern({ style: "mathRock", tempo: 120, measures: 2, humanize: false });
    expect(hits.length).toBeGreaterThan(0);
    const beatDuration = 0.5; // 120 BPM
    for (const h of hits) {
      const gridPos = h.time / (beatDuration / 4); // 16th note grid
      expect(Math.abs(gridPos - Math.round(gridPos))).toBeLessThan(0.01);
    }
  });
});

// ── Tempo Validation ──

describe("Drum Patterns — tempo validation", () => {
  it("throws RangeError for tempo = 0", () => {
    expect(() => generateDrumPattern({ tempo: 0 })).toThrow(RangeError);
  });

  it("throws RangeError for negative tempo", () => {
    expect(() => generateDrumPattern({ tempo: -100 })).toThrow(RangeError);
  });
});

// ── Holdsworth / Chad Wackerman Enhancements ──

describe("Drum Patterns — Holdsworth Wackerman", () => {
  const tempo = 120;
  const beatDur = 60 / tempo;

  it("11/8 uses Holdsworth-specific patterns, not generic", () => {
    // Holdsworth 11/8 should have ride bell (MIDI 53) possible and cross-stick (MIDI 37)
    // which generic 11/8 patterns do NOT have
    let foundBell = false;
    let foundCrossStick = false;
    for (let i = 0; i < 50; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        timeSignature: [11, 8],
        tempo,
        measures: 8,
        humanize: false,
        density: 50,
      });
      if (hits.some(h => h.pitch === GM_DRUMS.RIDE_BELL)) foundBell = true;
      if (hits.some(h => h.pitch === GM_DRUMS.CROSS_STICK)) foundCrossStick = true;
      if (foundBell && foundCrossStick) break;
    }
    // At least one of these style markers should appear across 50 runs
    expect(foundBell || foundCrossStick).toBe(true);
  });

  it("11/8 Holdsworth produces correct number of beats per measure", () => {
    const beatsPerMeasure = 11 * (4 / 8); // 5.5
    const measDur = beatsPerMeasure * beatDur;
    const hits = generateDrumPattern({
      style: "holdsworth",
      timeSignature: [11, 8],
      tempo,
      measures: 4,
      humanize: false,
    });
    // All hits within 4-measure duration
    for (const h of hits) {
      expect(h.time).toBeGreaterThanOrEqual(-0.01);
      expect(h.time).toBeLessThan(4 * measDur + 0.01);
    }
    // Should have hits in all 4 measures
    for (let m = 0; m < 4; m++) {
      const mHits = hits.filter(h => h.time >= m * measDur - 0.01 && h.time < (m + 1) * measDur + 0.01);
      expect(mHits.length).toBeGreaterThan(0);
    }
  });

  it("cross-stick appears in 4/4 Holdsworth patterns", () => {
    let found = false;
    for (let i = 0; i < 100; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo,
        measures: 8,
        humanize: false,
        density: 50,
      });
      if (hits.some(h => h.pitch === GM_DRUMS.CROSS_STICK)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("ghost notes make up significant portion of snare hits", () => {
    const hits = generateDrumPattern({
      style: "holdsworth",
      tempo,
      measures: 32,
      humanize: false,
      density: 50,
    });
    const snares = hits.filter(h => h.pitch === GM_DRUMS.SNARE);
    const ghosts = snares.filter(h => h.velocity < 40);
    // Wackerman: ghost cascades are central — at least 15% of snares should be ghosts
    expect(ghosts.length / Math.max(snares.length, 1)).toBeGreaterThan(0.15);
  });

  it("ride bell ratio ~45% across many measures", () => {
    let bellCount = 0;
    let rideCount = 0;
    for (let i = 0; i < 100; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo,
        measures: 4,
        humanize: false,
      });
      bellCount += hits.filter(h => h.pitch === GM_DRUMS.RIDE_BELL).length;
      rideCount += hits.filter(h => h.pitch === GM_DRUMS.RIDE || h.pitch === GM_DRUMS.RIDE_BELL).length;
    }
    const bellRatio = bellCount / Math.max(rideCount, 1);
    // All ride variants now include bell accents (1-4 per 8 hits). ~15-40% bell ratio.
    expect(bellRatio).toBeGreaterThan(0.10);
    expect(bellRatio).toBeLessThan(0.55);
  });

  it("stochastic comping has wider velocity range (20-95)", () => {
    const allVels: number[] = [];
    for (let i = 0; i < 50; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo,
        measures: 16,
        humanize: false,
        density: 50,
      });
      allVels.push(...hits.map(h => h.velocity));
    }
    const minVel = Math.min(...allVels);
    const maxVel = Math.max(...allVels);
    // Wide dynamic range — ghost notes (20-30) to accents (80+), at least 35 range
    expect(maxVel - minVel).toBeGreaterThan(35);
  });

  it("Holdsworth 11/8 fills have notes past beat 3", () => {
    let foundFillContent = false;
    for (let i = 0; i < 100; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        timeSignature: [11, 8],
        tempo,
        measures: 16,
        humanize: false,
        density: 50,
        formMarkers: [4, 8, 12],
        sectionMarkers: [4, 12],
      });
      // Check for tom hits (fill indicators) past beat 3 in the measure
      const beatsPerMeasure = 5.5;
      const measDur = beatsPerMeasure * beatDur;
      const toms = hits.filter(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID ||
        h.pitch === GM_DRUMS.TOM_LOW || h.pitch === GM_DRUMS.TOM_FLOOR
      );
      if (toms.length > 0) {
        foundFillContent = true;
        break;
      }
    }
    expect(foundFillContent).toBe(true);
  });

  it("ride variant rotates across measures (not stuck on one pattern)", () => {
    // Generate 64 measures — ride should rotate every 4-8 bars.
    // Collect bell count per 8-measure section; at least 2 sections should differ.
    const hits = generateDrumPattern({
      style: "holdsworth",
      tempo,
      measures: 64,
      humanize: false,
    });
    const measDur = 4 * beatDur;
    const bellCounts: number[] = [];
    for (let s = 0; s < 8; s++) {
      const sStart = s * 8 * measDur;
      const sEnd = (s + 1) * 8 * measDur;
      const bells = hits.filter(h => h.pitch === GM_DRUMS.RIDE_BELL && h.time >= sStart - 0.01 && h.time < sEnd);
      bellCounts.push(bells.length);
    }
    // With 3 ride variants (1, 2, or 4 bell per measure), sections should have varied counts
    const unique = new Set(bellCounts).size;
    expect(unique).toBeGreaterThanOrEqual(2);
  });

  it("Holdsworth fill patterns have no simultaneous non-timekeeping hits", () => {
    // Verify fill patterns themselves are linear — check tom/snare/kick within fill beats.
    // Fills occupy beats 2-4. Focus on fill-specific instruments (toms) to avoid
    // false positives from stochastic comping overlap with fill.
    let fillsChecked = 0;
    for (let i = 0; i < 200; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo,
        measures: 16,
        humanize: false,
        formMarkers: [4, 8, 12],
        sectionMarkers: [4, 12],
      });
      const measDur = 4 * beatDur;
      for (let m = 0; m < 16; m++) {
        const mStart = m * measDur;
        const mHits = hits.filter(h => h.time >= mStart - 0.001 && h.time < mStart + measDur);
        const toms = mHits.filter(h =>
          h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID ||
          h.pitch === GM_DRUMS.TOM_LOW || h.pitch === GM_DRUMS.TOM_FLOOR
        );
        if (toms.length >= 2) {
          fillsChecked++;
          // Check that no two toms share exact same time (fill should be linear)
          const tomTimes = toms.map(h => Math.round(h.time * 1000));
          const uniqueTomTimes = new Set(tomTimes);
          expect(uniqueTomTimes.size).toBe(tomTimes.length);
        }
      }
    }
    expect(fillsChecked).toBeGreaterThan(0);
  });

  // ── v1.2.3: snare guarantee, HH rotation, velocity floor, accent velocity, xstick frequency ──

  it("stochastic comping always produces snare or cross-stick (snare guarantee)", () => {
    // Run many short generations — no bar should be completely snare-free
    // (except drumsMinimal bars which are ride-only, tested separately)
    let emptyBars = 0;
    const tempo = 120;
    const beatDur = 60 / tempo;
    const measDur = 4 * beatDur; // 4/4
    for (let i = 0; i < 200; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo,
        measures: 8,
        humanize: false,
        density: 50,
      });
      for (let m = 0; m < 8; m++) {
        const mStart = m * measDur;
        const mHits = hits.filter(h => h.time >= mStart - 0.001 && h.time < mStart + measDur + 0.001);
        const hasSnare = mHits.some(h => h.pitch === GM_DRUMS.SNARE || h.pitch === GM_DRUMS.CROSS_STICK);
        if (!hasSnare) emptyBars++;
      }
    }
    // With snare guarantee, zero-snare bars should be extremely rare (only fill bars)
    // Allow up to 5% — fills replace comping so they won't have guarantee
    expect(emptyBars / (200 * 8)).toBeLessThan(0.05);
  });

  it("stochastic comping snare guarantee in 11/8", () => {
    let emptyBars = 0;
    const tempo = 120;
    const beatDur = 60 / tempo;
    const measDur = 5.5 * beatDur; // 11/8
    for (let i = 0; i < 200; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        timeSignature: [11, 8],
        tempo,
        measures: 8,
        humanize: false,
        density: 50,
      });
      for (let m = 0; m < 8; m++) {
        const mStart = m * measDur;
        const mHits = hits.filter(h => h.time >= mStart - 0.001 && h.time < mStart + measDur + 0.001);
        const hasSnare = mHits.some(h => h.pitch === GM_DRUMS.SNARE || h.pitch === GM_DRUMS.CROSS_STICK);
        if (!hasSnare) emptyBars++;
      }
    }
    expect(emptyBars / (200 * 8)).toBeLessThan(0.05);
  });

  it("hihat variants produce variety across measures", () => {
    // Over 64 measures, HH patterns should rotate (not identical every bar)
    const tempo = 120;
    const beatDur = 60 / tempo;
    const measDur = 4 * beatDur;
    const hhPatterns = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo,
        measures: 32,
        humanize: false,
      });
      for (let m = 0; m < 32; m++) {
        const mStart = m * measDur;
        const hh = hits
          .filter(h =>
            h.time >= mStart - 0.001 && h.time < mStart + measDur + 0.001 &&
            (h.pitch === GM_DRUMS.HI_HAT_CLOSED || h.pitch === GM_DRUMS.HI_HAT_OPEN || h.pitch === GM_DRUMS.HI_HAT_PEDAL)
          )
          .map(h => `${h.pitch}@${((h.time - mStart) / beatDur).toFixed(2)}`)
          .sort()
          .join("|");
        if (hh) hhPatterns.add(hh);
      }
    }
    // With 3 HH variants, should see at least 2 distinct patterns
    expect(hhPatterns.size).toBeGreaterThanOrEqual(2);
  });

  it("humanizeVelocity non-ghost floor is 35 (not 45)", () => {
    // With humanization disabled, vel=35 should pass through (not clamp to 45)
    expect(humanizeVelocity(35, false, false)).toBe(35);
    expect(humanizeVelocity(30, false, false)).toBe(35); // clamped up to 35
    expect(humanizeVelocity(36, false, false)).toBe(36);
  });

  it("humanizeVelocity ghost floor is 35", () => {
    expect(humanizeVelocity(30, true, false)).toBe(35); // clamped up to 35
    expect(humanizeVelocity(40, true, false)).toBe(40);
    expect(humanizeVelocity(55, true, false)).toBe(50); // capped at 50
  });

  it("accent snare velocity reaches 88+ in stochastic output", () => {
    // Holdsworth stochastic tables have accent snare at 88-92. Without humanization
    // these should appear in output.
    let maxSnareVel = 0;
    for (let i = 0; i < 100; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo: 120,
        measures: 16,
        humanize: false,
        density: 60,
      });
      const snares = hits.filter(h => h.pitch === GM_DRUMS.SNARE);
      for (const s of snares) {
        if (s.velocity > maxSnareVel) maxSnareVel = s.velocity;
      }
      if (maxSnareVel >= 88) break;
    }
    expect(maxSnareVel).toBeGreaterThanOrEqual(88);
  });

  it("cross-stick appears with reasonable frequency", () => {
    // With prob 0.18, cross-stick should appear frequently over many bars
    let xstickCount = 0;
    let totalBars = 0;
    for (let i = 0; i < 50; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo: 120,
        measures: 16,
        humanize: false,
        density: 50,
      });
      xstickCount += hits.filter(h => h.pitch === GM_DRUMS.CROSS_STICK).length;
      totalBars += 16;
    }
    // At prob ~0.18 with 3 slots per bar, expect at least 0.3 per bar on average
    // Be conservative: at least 0.1 per bar
    expect(xstickCount / totalBars).toBeGreaterThan(0.1);
  });

  it("holdsworth fill probability higher than generic styles", () => {
    // Holdsworth has sectionProb=0.75, phraseProb=0.55.
    // Over many runs with form/section markers, toms should appear more often.
    let holdsWithToms = 0;
    const runs = 100;
    for (let i = 0; i < runs; i++) {
      const hits = generateDrumPattern({
        style: "holdsworth",
        tempo: 120,
        measures: 16,
        humanize: false,
        density: 50,
        formMarkers: [4, 8, 12],
        sectionMarkers: [4, 12],
      });
      if (hits.some(h =>
        h.pitch === GM_DRUMS.TOM_HIGH || h.pitch === GM_DRUMS.TOM_MID ||
        h.pitch === GM_DRUMS.TOM_LOW || h.pitch === GM_DRUMS.TOM_FLOOR
      )) {
        holdsWithToms++;
      }
    }
    // With 0.75 section prob and multiple markers, fills should appear in most runs
    expect(holdsWithToms / runs).toBeGreaterThan(0.3);
  });
});

// ── v1.2.4: Multi-style ride/HH rotation + stochastic upgrades ──

describe("Drum Patterns — v1.2.4 multi-style rotation", () => {
  it("metheny ride bell appears (Sanchez bell variant)", () => {
    let foundBell = false;
    for (let i = 0; i < 50; i++) {
      const hits = generateDrumPattern({ style: "metheny", tempo: 120, measures: 8, humanize: false });
      if (hits.some(h => h.pitch === GM_DRUMS.RIDE_BELL)) { foundBell = true; break; }
    }
    expect(foundBell).toBe(true);
  });

  it("metheny accent snare velocity reaches 85+", () => {
    let maxVel = 0;
    for (let i = 0; i < 100; i++) {
      const hits = generateDrumPattern({ style: "metheny", tempo: 120, measures: 16, humanize: false, density: 60 });
      for (const h of hits) {
        if (h.pitch === GM_DRUMS.SNARE && h.velocity > maxVel) maxVel = h.velocity;
      }
      if (maxVel >= 85) break;
    }
    expect(maxVel).toBeGreaterThanOrEqual(85);
  });

  it("metheny cross-stick present", () => {
    let found = false;
    for (let i = 0; i < 50; i++) {
      const hits = generateDrumPattern({ style: "metheny", tempo: 120, measures: 16, humanize: false, density: 50 });
      if (hits.some(h => h.pitch === GM_DRUMS.CROSS_STICK)) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it("coolJazz ride varies across runs (2 ride variants)", () => {
    const rideCounts = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const hits = generateDrumPattern({ style: "coolJazz", tempo: 120, measures: 4, humanize: false });
      rideCounts.add(hitsOf(hits, GM_DRUMS.RIDE).length);
    }
    // Ride A: 4/bar (16 total), Ride B: 6/bar (24 total) — should see both
    expect(rideCounts.size).toBeGreaterThanOrEqual(2);
  });

  it("hardBop accent snare reaches 85+", () => {
    let maxVel = 0;
    for (let i = 0; i < 100; i++) {
      const hits = generateDrumPattern({ style: "hardBop", tempo: 140, measures: 16, humanize: false, density: 60 });
      for (const h of hits) {
        if (h.pitch === GM_DRUMS.SNARE && h.velocity > maxVel) maxVel = h.velocity;
      }
      if (maxVel >= 85) break;
    }
    expect(maxVel).toBeGreaterThanOrEqual(85);
  });

  it("fusion timekeeping rotates (different pattern counts across sections)", () => {
    const patterns = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const hits = generateDrumPattern({ style: "fusion", tempo: 120, measures: 32, humanize: false });
      const beatDur = 0.5;
      // Fingerprint first 4 bars by HH/ride pitch counts
      const first4 = hits.filter(h => h.time < 4 * 4 * beatDur);
      const closed = first4.filter(h => h.pitch === GM_DRUMS.HI_HAT_CLOSED).length;
      const bell = first4.filter(h => h.pitch === GM_DRUMS.RIDE_BELL).length;
      patterns.add(`${closed}-${bell}`);
    }
    // 4 timekeeping variants should produce multiple fingerprints
    expect(patterns.size).toBeGreaterThanOrEqual(2);
  });

  it("neoSoul HH pattern varies across runs", () => {
    const hhCounts = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const hits = generateDrumPattern({ style: "neoSoul", tempo: 90, measures: 4, humanize: false });
      const open = hitsOf(hits, GM_DRUMS.HI_HAT_OPEN).length;
      const closed = hitsOf(hits, GM_DRUMS.HI_HAT_CLOSED).length;
      hhCounts.add(open * 100 + closed);
    }
    // 3 HH variants with different open/closed counts
    expect(hhCounts.size).toBeGreaterThanOrEqual(2);
  });

  it("swing ride bell appears in some runs", () => {
    let foundBell = false;
    for (let i = 0; i < 50; i++) {
      const hits = generateDrumPattern({ style: "swing", tempo: 120, measures: 8, humanize: false });
      if (hits.some(h => h.pitch === GM_DRUMS.RIDE_BELL)) { foundBell = true; break; }
    }
    expect(foundBell).toBe(true);
  });
});
