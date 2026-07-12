/**
 * Groove Templates — structured micro-timing offsets per style.
 *
 * Based on GrooVAE research: real groove is NOT random jitter, it's consistent
 * per-beat displacement patterns. Each template defines bias (systematic offset)
 * and jitter (random variation width) per instrument element and beat position.
 *
 * Positive bias = behind the beat (laid back), negative = ahead (pushing).
 * Jitter is half-width of uniform random variation around the bias.
 */

import type { ElementTiming, GrooveTemplate } from "./types";

export type { ElementTiming, GrooveTemplate };

// ── Helpers ──

function t(bias: number, jitter: number): ElementTiming {
  return { bias, jitter };
}

// ── Templates ──

const GROOVE_TEMPLATES: Record<string, GrooveTemplate> = {
  // Swing: ride anchors grid, kick feathers slightly late, bass walks behind
  swing: {
    kick: t(0.003, 0.003),
    snare: t(0.000, 0.003),
    hihat: t(0.000, 0.002),
    ride: t(0.000, 0.002),
    crash: t(0.000, 0.002),
    bass: t(0.002, 0.003),
    bassOffbeat: t(0.005, 0.003),
    piano: t(0.000, 0.003),
    pianoAnticipation: t(-0.008, 0.003),
  },

  // Hard Bop: driving, drums slightly ahead, bass behind — creates tension
  hardBop: {
    kick: t(-0.003, 0.003),
    snare: t(-0.002, 0.002),
    hihat: t(-0.001, 0.002),
    ride: t(0.000, 0.002),
    crash: t(-0.002, 0.002),
    bass: t(0.004, 0.003),
    bassOffbeat: t(0.006, 0.003),
    piano: t(0.000, 0.003),
    pianoAnticipation: t(-0.008, 0.003),
  },

  // Cool Jazz: relaxed, everything slightly laid back, loose
  coolJazz: {
    kick: t(0.003, 0.003),
    snare: t(0.002, 0.003),
    hihat: t(0.001, 0.002),
    ride: t(0.001, 0.002),
    crash: t(0.001, 0.002),
    bass: t(0.003, 0.003),
    bassOffbeat: t(0.005, 0.003),
    piano: t(0.002, 0.003),
    pianoAnticipation: t(-0.006, 0.003),
  },

  // Ballad: everything laid back, piano most — tender, spacious
  ballad: {
    kick: t(0.005, 0.003),
    snare: t(0.004, 0.003),
    hihat: t(0.003, 0.002),
    ride: t(0.003, 0.002),
    crash: t(0.003, 0.002),
    bass: t(0.012, 0.003),
    bassOffbeat: t(0.012, 0.003),
    piano: t(0.008, 0.003),
    pianoAnticipation: t(-0.008, 0.003),
  },

  // Bossa Nova: tight, dead-center 8ths — precision is the feel
  bossa: {
    kick: t(0.000, 0.002),
    snare: t(0.000, 0.002),
    hihat: t(0.000, 0.001),
    ride: t(0.000, 0.001),
    crash: t(0.000, 0.001),
    bass: t(0.000, 0.002),
    bassOffbeat: t(0.000, 0.002),
    piano: t(0.000, 0.002),
    pianoAnticipation: t(0.000, 0.002),
  },

  // Latin: tight like bossa but kick has slight push for drive
  latin: {
    kick: t(-0.002, 0.002),
    snare: t(0.000, 0.002),
    hihat: t(0.000, 0.001),
    ride: t(0.000, 0.001),
    crash: t(0.000, 0.001),
    bass: t(0.000, 0.002),
    bassOffbeat: t(0.001, 0.002),
    piano: t(0.000, 0.002),
    pianoAnticipation: t(0.000, 0.002),
  },

  // Funk: locked to grid — pocket IS precision. Hi-hat dead center.
  funk: {
    kick: t(0.000, 0.002),
    snare: t(0.000, 0.002),
    hihat: t(0.000, 0.001),
    ride: t(0.000, 0.001),
    crash: t(0.000, 0.001),
    bass: t(0.001, 0.002),
    bassOffbeat: t(0.001, 0.002),
    piano: t(0.000, 0.002),
    pianoAnticipation: t(0.000, 0.002),
  },

  // Fusion: slightly behind, warm pocket — Weather Report/Headhunters
  fusion: {
    kick: t(0.002, 0.003),
    snare: t(0.001, 0.003),
    hihat: t(0.000, 0.002),
    ride: t(0.000, 0.002),
    crash: t(0.000, 0.002),
    bass: t(0.003, 0.003),
    bassOffbeat: t(0.004, 0.003),
    piano: t(0.002, 0.003),
    pianoAnticipation: t(-0.005, 0.003),
  },

  // ECM: floating, ethereal — piano most displaced, everything loose
  ecm: {
    kick: t(0.005, 0.004),
    snare: t(0.004, 0.004),
    hihat: t(0.003, 0.003),
    ride: t(0.002, 0.003),
    crash: t(0.002, 0.003),
    bass: t(0.006, 0.004),
    bassOffbeat: t(0.006, 0.004),
    piano: t(0.010, 0.004),
    pianoAnticipation: t(0.004, 0.004),
  },

  // Neo-Soul: J Dilla — kick drags late, snare pushes early, hi-hat on own grid
  neoSoul: {
    kick: t(0.010, 0.004),
    snare: t(-0.005, 0.003),
    hihat: t(0.000, 0.004),
    ride: t(0.000, 0.003),
    crash: t(0.000, 0.003),
    bass: t(0.008, 0.004),
    bassOffbeat: t(0.010, 0.004),
    piano: t(0.005, 0.004),
    pianoAnticipation: t(0.002, 0.004),
  },

  // Alfa Mist: per-element grids (Jas Kayser technique)
  // Kick drags, snare pushes, hi-hat on quintuplet displacement
  // Alfa Mist / Jas Kayser: per-element displacement grids.
  // Kick drags late (Dilla), snare pushes early, hi-hat on quintuplet displacement.
  // Wider hi-hat jitter (±6ms) reflects quintuplet grid that doesn't align with 16ths.
  alfaMist: {
    kick: t(0.010, 0.005),
    snare: t(-0.006, 0.004),
    hihat: t(0.000, 0.006),   // wider jitter for quintuplet displacement feel
    ride: t(0.000, 0.003),
    crash: t(0.000, 0.003),
    bass: t(0.006, 0.004),
    bassOffbeat: t(0.008, 0.004),
    piano: t(0.004, 0.005),   // slightly more float (Rhodes delay fills gaps)
    pianoAnticipation: t(0.000, 0.004),
  },

  // Pat Metheny: Bob Moses — behind-the-beat, warm, conversational
  metheny: {
    kick: t(0.005, 0.003),
    snare: t(0.004, 0.003),
    hihat: t(0.003, 0.002),
    ride: t(0.003, 0.002),
    crash: t(0.003, 0.002),
    bass: t(0.006, 0.003),
    bassOffbeat: t(0.008, 0.003),
    piano: t(0.005, 0.003),
    pianoAnticipation: t(0.000, 0.003),
  },

  // Holdsworth: tight pocket with conversational push/pull — Husband/Wackerman precision
  holdsworth: {
    kick: t(0.001, 0.003),         // tight kick, slight behind
    snare: t(-0.003, 0.003),       // snare pushes ahead (Husband urgency)
    hihat: t(-0.001, 0.002),       // hi-hat slightly ahead (drives time)
    ride: t(0.000, 0.002),         // ride on the grid (anchor)
    crash: t(0.000, 0.002),        // crash precise
    bass: t(0.002, 0.003),         // bass slightly behind kick (pocket)
    bassOffbeat: t(0.004, 0.003),  // offbeats laid back
    piano: t(0.001, 0.003),        // piano tight with bass
    pianoAnticipation: t(-0.004, 0.003), // anticipations push hard
  },

  // Contemporary Jazz: Avishai Cohen — warm, natural
  contemporaryJazz: {
    kick: t(0.002, 0.003),
    snare: t(0.001, 0.003),
    hihat: t(0.000, 0.002),
    ride: t(0.000, 0.002),
    crash: t(0.000, 0.002),
    bass: t(0.004, 0.003),
    bassOffbeat: t(0.006, 0.003),
    piano: t(0.003, 0.003),
    pianoAnticipation: t(-0.006, 0.003),
  },

  // Modal: Kind of Blue — meditative, slightly behind
  modal: {
    kick: t(0.004, 0.003),
    snare: t(0.003, 0.003),
    hihat: t(0.002, 0.002),
    ride: t(0.001, 0.002),
    crash: t(0.001, 0.002),
    bass: t(0.005, 0.003),
    bassOffbeat: t(0.005, 0.003),
    piano: t(0.004, 0.003),
    pianoAnticipation: t(0.000, 0.003),
  },

  // Jazz Waltz: elegant, ride-driven
  jazzWaltz: {
    kick: t(0.002, 0.003),
    snare: t(0.001, 0.003),
    hihat: t(0.000, 0.002),
    ride: t(0.000, 0.002),
    crash: t(0.000, 0.002),
    bass: t(0.003, 0.003),
    bassOffbeat: t(0.005, 0.003),
    piano: t(0.001, 0.003),
    pianoAnticipation: t(-0.006, 0.003),
  },

  // Shuffle Blues: triplet feel, slightly behind
  shuffleBlues: {
    kick: t(0.002, 0.003),
    snare: t(0.000, 0.003),
    hihat: t(0.000, 0.002),
    ride: t(0.000, 0.002),
    crash: t(0.000, 0.002),
    bass: t(0.003, 0.003),
    bassOffbeat: t(0.005, 0.003),
    piano: t(0.000, 0.003),
    pianoAnticipation: t(-0.008, 0.003),
  },

  // Math Rock: machine-tight precision
  mathRock: {
    kick: t(0.000, 0.002),
    snare: t(0.000, 0.002),
    hihat: t(0.000, 0.001),
    ride: t(0.000, 0.001),
    crash: t(0.000, 0.001),
    bass: t(0.000, 0.002),
    bassOffbeat: t(0.000, 0.002),
    piano: t(0.000, 0.002),
    pianoAnticipation: t(0.000, 0.002),
  },

  // IDM: deterministic micro-timing — intentional displacement, minimal random
  idm: {
    kick: t(0.003, 0.001),
    snare: t(-0.002, 0.001),
    hihat: t(0.001, 0.001),
    ride: t(0.001, 0.001),
    crash: t(0.000, 0.001),
    bass: t(0.002, 0.001),
    bassOffbeat: t(0.003, 0.001),
    piano: t(0.002, 0.001),
    pianoAnticipation: t(0.000, 0.001),
  },
};

// ── Public API ──

/**
 * Get groove template for style. Falls back to swing for unknown styles.
 */
export function getGrooveTemplate(style: string): GrooveTemplate {
  return GROOVE_TEMPLATES[style] ?? GROOVE_TEMPLATES.swing;
}

/**
 * Apply groove template timing to a time value.
 * Returns time + bias + random jitter from template.
 */
export function applyGroove(time: number, element: ElementTiming, random?: () => number): number {
  const rng = random ?? Math.random;
  return time + element.bias + (rng() - 0.5) * 2 * element.jitter;
}

/**
 * Map GM drum pitch to groove template element key.
 */
export function drumPitchToElement(pitch: number): keyof Pick<GrooveTemplate, "kick" | "snare" | "hihat" | "ride" | "crash"> {
  switch (pitch) {
    case 36: return "kick";
    case 38: case 37: return "snare";
    case 42: case 46: case 44: return "hihat";
    case 51: case 53: return "ride";
    case 49: return "crash";
    default: return "ride"; // toms, cowbell, etc. → ride timing
  }
}
