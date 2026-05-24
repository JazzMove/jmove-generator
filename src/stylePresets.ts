import type { PracticeStyle, InstrumentStyles, StyleParameters, StylePreset } from "./types";

export type { StylePreset };

export const STYLE_PRESETS: StylePreset[] = [
  // Traditional
  { id: "classic-swing", name: "Classic Swing", description: "Standard jazz quartet feel", style: "swing", parameters: { swingAmount: 70, density: 50 }, tempoRange: [120, 180] },
  { id: "hard-bop", name: "Hard Bop Drive", description: "Art Blakey, Horace Silver energy", style: "hardBop", parameters: { swingAmount: 80, density: 70 }, tempoRange: [140, 200] },
  { id: "cool-jazz", name: "West Coast Cool", description: "Chet Baker, Dave Brubeck lightness", style: "coolJazz", parameters: { swingAmount: 50, density: 30 }, tempoRange: [100, 140] },
  { id: "ballad", name: "Soft Ballad", description: "Slow, spacious, tender", style: "ballad", parameters: { swingAmount: 40, density: 20 }, tempoRange: [50, 80] },

  // Modern
  { id: "fusion", name: "Fusion Groove", description: "Weather Report, Herbie Headhunters", style: "fusion", parameters: { swingAmount: 20, density: 80 }, tempoRange: [90, 140] },
  { id: "ecm", name: "ECM Space", description: "Keith Jarrett trio, Nordic clarity", style: "ecm", parameters: { swingAmount: 10, density: 15 }, tempoRange: [50, 90] },
  { id: "modal", name: "Miles Modal", description: "Kind of Blue, pedal points", style: "modal", parameters: { swingAmount: 40, density: 20 }, tempoRange: [60, 110] },

  // Latin
  { id: "bossa", name: "Bossa Nova", description: "Jobim, straight 8ths, gentle", style: "bossa", parameters: { swingAmount: 0, density: 50 }, tempoRange: [110, 150] },
  { id: "latin", name: "Latin Fire", description: "Afro-Cuban, cascara, clave", style: "latin", parameters: { swingAmount: 0, density: 70 }, tempoRange: [120, 170] },

  // Groove
  { id: "funk", name: "Funk Pocket", description: "16th hats, ghost notes, deep pocket", style: "funk", parameters: { swingAmount: 10, density: 85 }, tempoRange: [85, 120] },
  { id: "jazz-waltz", name: "Jazz Waltz", description: "3/4 swing, elegant", style: "jazzWaltz", parameters: { swingAmount: 60, density: 45 }, tempoRange: [100, 160] },
  { id: "shuffle-blues", name: "Blues Shuffle", description: "Triplet feel, classic blues", style: "shuffleBlues", parameters: { swingAmount: 90, density: 60 }, tempoRange: [70, 130] },

  // Experimental
  { id: "neo-soul", name: "Neo-Soul Pocket", description: "J Dilla, Robert Glasper, broken feel", style: "neoSoul", parameters: { swingAmount: 20, density: 65 }, tempoRange: [70, 110] },
  { id: "contemporary-jazz", name: "Contemporary Jazz", description: "Avishai Cohen, Nordic piano trio", style: "contemporaryJazz", parameters: { swingAmount: 50, density: 45 }, tempoRange: [80, 140] },
  { id: "holdsworth", name: "Holdsworth Fusion", description: "Allan Holdsworth — melodic minor harmony, non-functional movement, wide voicings", style: "holdsworth", parameters: { swingAmount: 15, density: 45 }, tempoRange: [90, 160] },
  { id: "alfa-mist", name: "Alfa Mist", description: "Antiphon / Structuralism / Variables — dreamy Rhodes, broken beat, chromatic mediants, East London jazz-hop", style: "alfaMist", parameters: { swingAmount: 20, density: 55 }, tempoRange: [80, 130] },
  { id: "metheny", name: "Pat Metheny", description: "Bright Size Life — Lydian shimmer, open voicings, Jaco melodic bass, Bob Moses brushes", style: "metheny", parameters: { swingAmount: 25, density: 35 }, tempoRange: [80, 140] },
  { id: "math-rock", name: "Math Rock", description: "Angular precision, odd groupings", style: "mathRock", parameters: { swingAmount: 0, density: 80 }, tempoRange: [120, 160] },
  { id: "idm", name: "IDM", description: "Telefon Tel Aviv, generative patterns", style: "idm", parameters: { swingAmount: 0, density: 55 }, tempoRange: [80, 130] },

  // Hybrids (per-instrument overrides)
  { id: "fusion-ecm", name: "Fusion/ECM", description: "Fusion groove + ECM space piano", style: "fusion", instrumentStyles: { piano: "ecm", drums: "fusion" }, parameters: { swingAmount: 15, density: 50 }, tempoRange: [80, 120] },
  { id: "modal-funk", name: "Modal Funk", description: "Pedal bass + funk drums", style: "modal", instrumentStyles: { drums: "funk" }, parameters: { swingAmount: 20, density: 65 }, tempoRange: [90, 130] },
  { id: "fusion-neosoul", name: "Fusion/Neo-Soul", description: "Snarky Puppy meets D'Angelo", style: "fusion", instrumentStyles: { piano: "neoSoul", drums: "neoSoul" }, parameters: { swingAmount: 15, density: 70 }, tempoRange: [85, 125] },
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
