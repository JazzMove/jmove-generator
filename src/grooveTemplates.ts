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

import type { ElementTiming, GrooveTemplate, PhraseArc } from "./types";

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
 * Evolve a groove element based on musical context.
 * Real musicians tighten up during builds, loosen during releases,
 * and push ahead when energy rises.
 *
 * Returns a new ElementTiming with modified bias and jitter.
 */
export function evolveElement(element: ElementTiming, energy: number, arc?: PhraseArc | null): ElementTiming {
  let biasShift = 0;
  let jitterScale = 1.0;

  // Energy: high energy = tighter (less jitter), low energy = looser
  // Maps energy [0.3, 1.0] to jitter scale [1.2, 0.8]
  jitterScale *= 1.2 - 0.4 * Math.max(0.3, Math.min(1.0, energy));

  // Arc-driven evolution
  switch (arc) {
    case "build":
      biasShift = -0.001;    // push ahead 1ms (forward momentum)
      jitterScale *= 0.85;   // tighten up (focused playing)
      break;
    case "climax":
      biasShift = -0.0005;   // slight push (driving)
      jitterScale *= 0.75;   // tightest (locked in)
      break;
    case "release":
      biasShift = 0.001;     // lay back 1ms (relaxing)
      jitterScale *= 1.25;   // loosen (breathing room)
      break;
    case "drop":
      biasShift = 0.002;     // significantly behind (floating)
      jitterScale *= 1.4;    // loosest (spacious)
      break;
    // sustain: no change (neutral playing)
  }

  return {
    bias: element.bias + biasShift,
    jitter: element.jitter * jitterScale,
  };
}

/**
 * Apply groove template timing to a time value.
 * Returns time + bias + jitter from template.
 * Uses triangular distribution (peaked at center) instead of uniform -
 * most hits cluster near intended position, with rare larger displacements.
 * This matches real musician timing distributions (GrooVAE research).
 *
 * Optional energy/arc params enable dynamic groove evolution (G4) -
 * groove tightens during builds and loosens during releases.
 */
export function applyGroove(
  time: number,
  element: ElementTiming,
  random?: () => number,
  energy?: number,
  arc?: PhraseArc | null,
): number {
  const rng = random ?? Math.random;
  const u = rng();
  // Triangular distribution: peaked at 0, range [-1, 1]
  const tri = u < 0.5 ? Math.sqrt(2 * u) - 1 : 1 - Math.sqrt(2 * (1 - u));
  // Evolve groove when energy/arc context is available
  const evolved = energy !== undefined ? evolveElement(element, energy, arc) : element;
  return time + evolved.bias + tri * evolved.jitter;
}

/**
 * Compute rubato (tempo micro-variation) offset for a beat position.
 * Returns time offset in seconds. Positive = behind, negative = ahead.
 * Fully deterministic (no RNG) - groove templates handle random jitter.
 *
 * Ballads: stretch beat 4, compress beat 1 (breathing rubato).
 * Builds: slight accelerando (push ahead).
 * Endings/releases: ritardando (pull back).
 */
export function rubatoOffset(
  style: string,
  beatInMeasure: number,
  beatsPerMeasure: number,
  arc?: PhraseArc | null,
): number {
  let offset = 0;

  // Ballad rubato: stretch beat 4 (lingering), compress beat 1 (forward pull)
  if (style === "ballad" || style === "ecm") {
    const beatPct = beatsPerMeasure > 0 ? beatInMeasure / beatsPerMeasure : 0;
    if (beatPct > 0.75) {
      offset += 0.004; // beat 4: stretch 4ms (tender lingering)
    } else if (beatPct < 0.25 && beatPct > 0) {
      offset -= 0.002; // beat 1 area (not beat 0): compress 2ms
    }
  }

  // Arc-driven tempo feel
  if (arc === "build") {
    offset -= 0.001; // slight accelerando: 1ms ahead
  } else if (arc === "release") {
    offset += 0.002; // ritardando: 2ms behind
  } else if (arc === "drop") {
    offset += 0.003; // significant slowdown: 3ms behind
  }

  return offset;
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
