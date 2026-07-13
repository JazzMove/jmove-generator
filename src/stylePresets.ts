import type { PracticeStyle, StylePreset } from "./types";

export type { StylePreset };

export const STYLE_PRESETS: StylePreset[] = [
  // Traditional
  { id: "classic-swing", name: "Classic Swing", description: "Standard jazz quartet feel", style: "swing", parameters: { swingAmount: 70, density: 50, strumMs: 20, creativity: 30, conversation: 35, airGaps: 15, harmonicFreedom: 20 }, tempoRange: [120, 180] },
  { id: "hard-bop", name: "Hard Bop Drive", description: "Art Blakey, Horace Silver energy", style: "hardBop", parameters: { swingAmount: 80, density: 70, strumMs: 20, creativity: 40, conversation: 40, airGaps: 10, harmonicFreedom: 30 }, tempoRange: [140, 200] },
  { id: "cool-jazz", name: "West Coast Cool", description: "Chet Baker, Dave Brubeck lightness", style: "coolJazz", parameters: { swingAmount: 50, density: 30, strumMs: 0, creativity: 25, conversation: 30, airGaps: 25, harmonicFreedom: 15 }, tempoRange: [100, 140] },
  { id: "ballad", name: "Soft Ballad", description: "Slow, spacious, tender", style: "ballad", parameters: { swingAmount: 40, density: 20, strumMs: 0, creativity: 20, conversation: 25, airGaps: 35, harmonicFreedom: 20 }, tempoRange: [50, 80] },

  // Modern
  { id: "fusion", name: "Fusion Groove", description: "Weather Report, Herbie Headhunters", style: "fusion", parameters: { swingAmount: 20, density: 80, strumMs: 8, creativity: 50, conversation: 45, airGaps: 10, harmonicFreedom: 40 }, tempoRange: [90, 140] },
  { id: "ecm", name: "ECM Space", description: "Keith Jarrett trio, Nordic clarity", style: "ecm", parameters: { swingAmount: 10, density: 15, strumMs: 0, creativity: 35, conversation: 40, airGaps: 45, harmonicFreedom: 30 }, tempoRange: [50, 90] },
  { id: "modal", name: "Miles Modal", description: "Kind of Blue, pedal points", style: "modal", parameters: { swingAmount: 40, density: 20, strumMs: 0, creativity: 30, conversation: 35, airGaps: 30, harmonicFreedom: 20 }, tempoRange: [60, 110] },

  // Latin
  { id: "bossa", name: "Bossa Nova", description: "Jobim, straight 8ths, gentle", style: "bossa", parameters: { swingAmount: 0, density: 50, strumMs: 20, creativity: 15, conversation: 20, airGaps: 10, harmonicFreedom: 15 }, tempoRange: [110, 150] },
  { id: "latin", name: "Latin Fire", description: "Afro-Cuban, cascara, clave", style: "latin", parameters: { swingAmount: 0, density: 70, strumMs: 20, creativity: 20, conversation: 25, airGaps: 5, harmonicFreedom: 15 }, tempoRange: [120, 170] },

  // Groove
  { id: "funk", name: "Funk Pocket", description: "16th hats, ghost notes, deep pocket", style: "funk", parameters: { swingAmount: 10, density: 85, strumMs: 20, creativity: 25, conversation: 30, airGaps: 5, harmonicFreedom: 10 }, tempoRange: [85, 120] },
  { id: "jazz-waltz", name: "Jazz Waltz", description: "3/4 swing, elegant", style: "jazzWaltz", parameters: { swingAmount: 60, density: 45, strumMs: 20, creativity: 30, conversation: 30, airGaps: 15, harmonicFreedom: 20 }, tempoRange: [100, 160] },
  { id: "shuffle-blues", name: "Blues Shuffle", description: "Triplet feel, classic blues", style: "shuffleBlues", parameters: { swingAmount: 90, density: 60, strumMs: 20, creativity: 20, conversation: 20, airGaps: 10, harmonicFreedom: 10 }, tempoRange: [70, 130] },

  // Experimental
  { id: "neo-soul", name: "Neo-Soul Pocket", description: "J Dilla, Robert Glasper, broken feel", style: "neoSoul", parameters: { swingAmount: 20, density: 65, strumMs: 20, creativity: 45, conversation: 40, airGaps: 20, harmonicFreedom: 35 }, tempoRange: [70, 110] },
  { id: "contemporary-jazz", name: "Contemporary Jazz", description: "Avishai Cohen, Nordic piano trio", style: "contemporaryJazz", parameters: { swingAmount: 50, density: 45, strumMs: 8, creativity: 40, conversation: 45, airGaps: 20, harmonicFreedom: 30 }, tempoRange: [80, 140] },

  // ── HOLDSWORTH: High creativity, high conversation, moderate air gaps ──
  // Allan's bands are ALL about conversation — Gary Husband and Chad Wackerman
  // react to everything, Jimmy Johnson creates melodic counterpoint.
  // Harmonic freedom is high — Allan reharmonizes constantly.
  // Air gaps moderate — not as spacious as ECM but needs breathing room for
  // the wide voicings to ring and the band to listen.
  { id: "holdsworth", name: "Holdsworth Fusion", description: "Allan Holdsworth — melodic minor harmony, non-functional movement, wide voicings", style: "holdsworth", parameters: { swingAmount: 15, density: 45, strumMs: 8, creativity: 55, conversation: 65, airGaps: 25, harmonicFreedom: 60 }, tempoRange: [90, 160] },

  { id: "alfa-mist", name: "Alfa Mist", description: "Antiphon / Structuralism / Variables — dreamy Rhodes, broken beat, chromatic mediants, East London jazz-hop", style: "alfaMist", parameters: { swingAmount: 20, density: 55, strumMs: 20, creativity: 45, conversation: 35, airGaps: 20, harmonicFreedom: 35 }, tempoRange: [80, 130] },

  // ── PAT METHENY: High air gaps, moderate creativity, high conversation ──
  // Bright Size Life trio: incredibly conversational, lots of space.
  // Pat's guitar sustains — piano (Lyle Mays later, but here it's the piano
  // representing Pat's harmonic concept) should sustain and breathe.
  // Harmonic freedom moderate-high — Pat anticipates chords but doesn't go wild.
  // Air gaps HIGH — this is the key to Metheny's sound. Space. Let things ring.
  // Creativity moderate — surprises come from the conversation, not chaos.
  { id: "metheny", name: "Pat Metheny", description: "Bright Size Life — Lydian shimmer, open voicings, Jaco melodic bass, Bob Moses brushes", style: "metheny", parameters: { swingAmount: 25, density: 35, strumMs: 8, creativity: 40, conversation: 60, airGaps: 45, harmonicFreedom: 45 }, tempoRange: [80, 140] },

  { id: "math-rock", name: "Math Rock", description: "Angular precision, odd groupings", style: "mathRock", parameters: { swingAmount: 0, density: 80, strumMs: 20, creativity: 55, conversation: 20, airGaps: 10, harmonicFreedom: 15 }, tempoRange: [120, 160] },
  { id: "idm", name: "IDM", description: "Telefon Tel Aviv, generative patterns", style: "idm", parameters: { swingAmount: 0, density: 55, strumMs: 20, creativity: 60, conversation: 15, airGaps: 30, harmonicFreedom: 20 }, tempoRange: [80, 130] },

  // Hybrids (per-instrument overrides)
  { id: "fusion-ecm", name: "Fusion/ECM", description: "Fusion groove + ECM space piano", style: "fusion", instrumentStyles: { piano: "ecm", drums: "fusion" }, parameters: { swingAmount: 15, density: 50, strumMs: 0, creativity: 45, conversation: 50, airGaps: 30, harmonicFreedom: 35 }, tempoRange: [80, 120] },
  { id: "modal-funk", name: "Modal Funk", description: "Pedal bass + funk drums", style: "modal", instrumentStyles: { drums: "funk" }, parameters: { swingAmount: 20, density: 65, strumMs: 0, creativity: 35, conversation: 30, airGaps: 10, harmonicFreedom: 20 }, tempoRange: [90, 130] },
  { id: "fusion-neosoul", name: "Fusion/Neo-Soul", description: "Snarky Puppy meets D'Angelo", style: "fusion", instrumentStyles: { piano: "neoSoul", drums: "neoSoul" }, parameters: { swingAmount: 15, density: 70, strumMs: 20, creativity: 50, conversation: 45, airGaps: 15, harmonicFreedom: 30 }, tempoRange: [85, 125] },
];

export const STYLE_CATEGORIES: Record<string, PracticeStyle[]> = {
  "Traditional": ["swing", "hardBop", "coolJazz", "ballad"],
  "Modern": ["fusion", "ecm", "modal", "contemporaryJazz"],
  "Latin": ["bossa", "latin"],
  "Groove": ["funk", "jazzWaltz", "shuffleBlues", "neoSoul"],
  "Experimental": ["holdsworth", "alfaMist", "metheny", "mathRock", "idm"],
};

export const STYLE_LABELS: Record<PracticeStyle, string> = {
  swing: "Swing",
  bossa: "Bossa Nova",
  latin: "Latin",
  ballad: "Ballad",
  funk: "Funk",
  fusion: "Fusion",
  ecm: "ECM",
  hardBop: "Hard Bop",
  coolJazz: "Cool Jazz",
  modal: "Modal",
  jazzWaltz: "Jazz Waltz",
  shuffleBlues: "Shuffle Blues",
  neoSoul: "Neo-Soul",
  contemporaryJazz: "Contemporary Jazz",
  holdsworth: "Holdsworth",
  alfaMist: "Alfa Mist",
  metheny: "Pat Metheny",
  mathRock: "Math Rock",
  idm: "IDM",
};
