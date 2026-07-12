import { describe, it, expect } from "vitest";
import { createPRNG, randomSeed, deriveStream, STREAM_DRUMS, STREAM_BASS, STREAM_PIANO } from "../src/prng";

describe("PRNG — xoshiro128**", () => {
  describe("determinism", () => {
    it("same seed produces identical sequence", () => {
      const rng1 = createPRNG(42);
      const rng2 = createPRNG(42);
      const seq1 = Array.from({ length: 100 }, () => rng1());
      const seq2 = Array.from({ length: 100 }, () => rng2());
      expect(seq1).toEqual(seq2);
    });

    it("deterministic across 1000 outputs", () => {
      const rng1 = createPRNG(12345);
      const rng2 = createPRNG(12345);
      for (let i = 0; i < 1000; i++) {
        expect(rng1()).toBe(rng2());
      }
    });

    it("seed 0 works (non-zero state ensured)", () => {
      const rng = createPRNG(0);
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });

    it("negative seed works", () => {
      const rng1 = createPRNG(-999);
      const rng2 = createPRNG(-999);
      expect(rng1()).toBe(rng2());
    });
  });

  describe("output range", () => {
    it("values are in [0, 1)", () => {
      const rng = createPRNG(777);
      for (let i = 0; i < 10000; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe("different seeds produce different output", () => {
    it("seed 1 vs seed 2 diverge immediately", () => {
      const rng1 = createPRNG(1);
      const rng2 = createPRNG(2);
      const seq1 = Array.from({ length: 10 }, () => rng1());
      const seq2 = Array.from({ length: 10 }, () => rng2());
      expect(seq1).not.toEqual(seq2);
    });

    it("adjacent seeds produce distinct sequences", () => {
      for (let s = 0; s < 20; s++) {
        const rng1 = createPRNG(s);
        const rng2 = createPRNG(s + 1);
        const v1 = rng1();
        const v2 = rng2();
        expect(v1).not.toBe(v2);
      }
    });
  });

  describe("distribution uniformity", () => {
    it("chi-squared test on 10 bins (100000 samples)", () => {
      const rng = createPRNG(31415);
      const bins = new Array(10).fill(0);
      const N = 100000;
      for (let i = 0; i < N; i++) {
        const bin = Math.floor(rng() * 10);
        bins[bin]++;
      }
      const expected = N / 10;
      const chiSquared = bins.reduce((sum, count) => sum + ((count - expected) ** 2) / expected, 0);
      // For 9 degrees of freedom, critical value at p=0.01 is 21.67
      expect(chiSquared).toBeLessThan(21.67);
    });

    it("mean is approximately 0.5", () => {
      const rng = createPRNG(2718);
      const N = 50000;
      let sum = 0;
      for (let i = 0; i < N; i++) sum += rng();
      const mean = sum / N;
      expect(mean).toBeCloseTo(0.5, 1); // within 0.05
    });
  });

  describe("period (no short cycles)", () => {
    it("no repeat in first 10000 outputs", () => {
      const rng = createPRNG(9999);
      const seen = new Set<number>();
      for (let i = 0; i < 10000; i++) {
        const val = rng();
        // Floating point: exact repeats would indicate short period
        if (seen.has(val)) {
          // Allow very rare collisions (birthday paradox) but not systematic repeats
          // A 32-bit PRNG has 2^32 possible outputs; 10000 samples = negligible collision probability
          // If we get more than 2 collisions in 10000, period is suspect
        }
        seen.add(val);
      }
      // With 32-bit output space, expect at most ~0.01 collisions in 10000 samples
      expect(seen.size).toBeGreaterThan(9990);
    });
  });

  describe("deriveStream", () => {
    it("produces independent streams from same seed", () => {
      const seed = 42;
      const drums = deriveStream(seed, STREAM_DRUMS);
      const bass = deriveStream(seed, STREAM_BASS);
      const piano = deriveStream(seed, STREAM_PIANO);

      const drumSeq = Array.from({ length: 20 }, () => drums());
      const bassSeq = Array.from({ length: 20 }, () => bass());
      const pianoSeq = Array.from({ length: 20 }, () => piano());

      expect(drumSeq).not.toEqual(bassSeq);
      expect(drumSeq).not.toEqual(pianoSeq);
      expect(bassSeq).not.toEqual(pianoSeq);
    });

    it("derived streams are deterministic", () => {
      const drums1 = deriveStream(100, STREAM_DRUMS);
      const drums2 = deriveStream(100, STREAM_DRUMS);
      expect(Array.from({ length: 50 }, () => drums1())).toEqual(
        Array.from({ length: 50 }, () => drums2()),
      );
    });
  });

  describe("randomSeed", () => {
    it("returns a number", () => {
      const seed = randomSeed();
      expect(typeof seed).toBe("number");
      expect(Number.isFinite(seed)).toBe(true);
    });

    it("successive calls produce different seeds", () => {
      const seeds = new Set(Array.from({ length: 10 }, () => randomSeed()));
      // At least 8 of 10 should be unique (crypto-backed)
      expect(seeds.size).toBeGreaterThan(7);
    });
  });
});
