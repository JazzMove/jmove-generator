/**
 * Seedable PRNG — xoshiro128** (128-bit state, 32-bit output).
 *
 * Zero dependencies. Provides deterministic random sequences for
 * reproducible ensemble generation. Each instrument gets an independent
 * stream derived from the master seed to prevent cross-instrument coupling.
 */

export type RandomFn = () => number;

/**
 * Create a seeded PRNG returning values in [0, 1).
 * Uses xoshiro128** algorithm — fast, high quality, 2^128-1 period.
 */
export function createPRNG(seed: number): RandomFn {
  // SplitMix32 to initialize 4 state words from a single seed
  let s = seed | 0;
  const next32 = (): number => {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };

  let s0 = next32();
  let s1 = next32();
  let s2 = next32();
  let s3 = next32();

  // Ensure non-zero state
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;

  return (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;

    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);

    return result / 4294967296; // 2^32
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * Generate a random seed from available entropy.
 * Uses crypto.getRandomValues when available, falls back to Date.now().
 */
export function randomSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
  return (Date.now() * 2654435761) >>> 0; // Knuth multiplicative hash
}

/**
 * Derive an independent PRNG stream from a master seed.
 * XORs the seed with a unique instrument constant to ensure independence.
 */
export function deriveStream(masterSeed: number, streamId: number): RandomFn {
  return createPRNG((masterSeed ^ streamId) >>> 0);
}

// Stream IDs for each instrument (ASCII-inspired constants)
export const STREAM_DRUMS = 0x44524D53; // "DRMS"
export const STREAM_BASS = 0x42415353;  // "BASS"
export const STREAM_PIANO = 0x50494E4F; // "PINO"
