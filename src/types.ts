/**
 * @jmove/generator — Core type definitions
 *
 * These types define the public API surface for the generator package.
 * Types that mirror JMove's internal notation types (QuantizedScore, etc.)
 * are defined here as standalone interfaces so the package has zero
 * external dependencies.
 */

// ── Practice Styles ──

export type PracticeStyle =
  | "swing" | "bossa" | "latin" | "ballad" | "funk"
  | "fusion" | "ecm" | "hardBop" | "coolJazz"
  | "modal" | "jazzWaltz" | "shuffleBlues"
  | "neoSoul" | "contemporaryJazz" | "mathRock" | "idm"
  | "holdsworth" | "alfaMist" | "metheny";

export type BassStyle = PracticeStyle;
export type PianoStyle = PracticeStyle;
export type DrumStyle = PracticeStyle;

// ── Per-Instrument Granular Controls ──

export interface DrumGranular {
  tomFrequency: number;      // 0-100: how often toms appear in grooves (0=none, 100=Elvin Jones)
  fillIntensity: number;     // 0-100: fill frequency + complexity (0=no fills, 100=Buddy Rich)
  rideWash: number;          // 0-100: ride looseness (0=tight quarters, 100=washy 16ths)
  ghostDensity: number;      // 0-100: ghost note frequency (0=clean, 100=Wackerman cascades)
  cymbalColor: number;       // 0-100: crash/splash/china variety on section hits
}

export interface PianoGranular {
  voicingDensity: number;    // 0-100: shell(2-note) → compact(3) → full(4-note) voicings
  rhythmicActivity: number;  // 0-100: sparse → dense hits per bar
  registerRange: number;     // 0-100: narrow register → wide ±2 octaves
  anticipation: number;      // 0-100: harmonic anticipation probability
  pianoRegister: number;     // 0-100: base register center — 0=low (C3-F5), 50=default (G3-C6), 100=high (D4-G6)
}

export interface BassGranular {
  chromaticApproach: number; // 0-100: diatonic-heavy → chromatic → double-chromatic
  registerWidth: number;     // 0-100: narrow → full 2-octave range
  syncopation: number;       // 0-100: straight quarters → frequent 8th/16th fills
  beatVariety: number;       // 0-100: nearest chord tone → mixed chord tones on beat 2
  bassRegister: number;      // 0-100: base register center — 0=low (B0-D3), 50=default (E1-G3), 100=high (A1-C4)
}

export interface StyleParameters {
  swingAmount: number;  // 0-100: 0=straight 8ths, 50=light swing, 100=hard triplet
  density: number;      // 0-100: sparse vs busy
  strumMs?: number;     // 0-30: piano chord strum spread in ms (0=no strum)
  // ── Musicality Parameters ──
  creativity?: number;       // 0-100: surprise frequency — drops, harmonic subs, rhythmic displacement
  conversation?: number;     // 0-100: how much instruments listen and respond to each other
  airGaps?: number;          // 0-100: intentional silence frequency — breathing room
  harmonicFreedom?: number;  // 0-100: reharmonization, passing chords, anticipation
  // ── Per-Instrument Complexity ──
  drumComplexity?: number;   // 0-100: general drum complexity (drives granular defaults)
  pianoComplexity?: number;  // 0-100: general piano complexity
  bassComplexity?: number;   // 0-100: general bass complexity
  drumGranular?: DrumGranular;
  pianoGranular?: PianoGranular;
  bassGranular?: BassGranular;
}

export interface InstrumentStyles {
  bass?: BassStyle;
  piano?: PianoStyle;
  drums?: DrumStyle;
}

// ── Score Types (subset of JMove's notation types) ──

export interface MeasureChord {
  root: string;
  quality: string;
  startTime: number;
}

export interface QuantizedNote {
  id: string;
  pitches: number[];
  vexKeys: string[];
  duration: string;
  dots: number;
  isRest: boolean;
  isTied: boolean;
  startTime: number;
  endTime: number;
  velocity: number;
  tabPositions?: TabPosition[];
  isPreview?: boolean;
}

export interface TabPosition {
  str: number;
  fret: number;
}

export interface QuantizedMeasure {
  index: number;
  notes: QuantizedNote[];
  chord?: MeasureChord;
  chords: MeasureChord[];
  timeSignature: [number, number];
  keySignature: string;
  tempo: number;
  startTime: number;
  endTime: number;
}

export interface QuantizedScore {
  measures: QuantizedMeasure[];
  keySignature: string;
  timeSignature: [number, number];
  tempo: number;
  duration: number;
  /** Original style from import source (e.g. "Medium Swing", "Bossa Nova") */
  style?: string;
}

// ── Jam Generator Types ──

export type JamKey = "C" | "Db" | "D" | "Eb" | "E" | "F" | "Gb" | "G" | "Ab" | "A" | "Bb" | "B";

export type JamForm =
  | "blues12" | "rhythm32" | "aaba32" | "modal16" | "turnaround8"
  | "abac32" | "songForm24" | "rondo20" | "clave16" | "minorBlues12"
  | "secondLine16" | "coltraneMatrix16" | "throughComposed12"
  | "pentatonic8" | "quartal16" | "fullSong" | "free";

export type SongSectionType = "intro" | "head" | "solo" | "bridge" | "interlude" | "shout" | "outro";

export interface SongSection {
  type: SongSectionType;
  label: string;
  startMeasure: number;
  endMeasure: number;
  sourceForm: JamForm;
  dynamicLevel: number;
}

export interface JamConfig {
  key: JamKey;
  form: JamForm;
  style: PracticeStyle;
  tempo: number;
  timeSignature: [number, number];
  measures?: number;
}

export interface JamResult {
  score: QuantizedScore;
  config: JamConfig;
  progressionLabel: string;
  sections?: SongSection[];
}

// ── Walking Bass Types ──

export interface BassNote {
  pitch: number;
  time: number;
  duration: number;
  velocity: number;
}

export interface WalkingBassOptions {
  style?: string;
  tempo?: number;
  swingAmount?: number;
  density?: number;
  humanize?: boolean;
  measureInfo?: { totalMeasures: number; measureDuration: number; sections?: SongSection[] };
  kickTimes?: number[];
  random?: () => number;
  bandContext?: BandContext;
  granular?: BassGranular;
}

export interface ChordEvent {
  root: string;
  quality: string;
  time: number;
  duration: number;
  /** Harmonic analysis (populated by analyzeHarmony, undefined if not analyzed) */
  analysis?: ChordAnalysis;
}

// ── Piano Comping Types ──

export interface CompNote {
  pitches: number[];
  time: number;
  duration: number;
  velocity: number;
}

export interface PianoCompingOptions {
  style?: string;
  tempo?: number;
  humanize?: boolean;
  swingAmount?: number;
  density?: number;
  strum?: boolean;
  strumMs?: number;
  measureInfo?: { totalMeasures: number; measureDuration: number; sections?: SongSection[] };
  random?: () => number;
  bandContext?: BandContext;
  granular?: PianoGranular;
}

// ── Drum Pattern Types ──

export interface DrumHit {
  pitch: number;
  time: number;
  duration: number;
  velocity: number;
}

export interface DrumState {
  variationIdx: number;
  barsOnPattern: number;
  patternHoldBars: number;
  tendency: unknown;  // CompingTendency | null, kept opaque for type boundary
}

export interface DrumPatternOptions {
  style?: string;
  tempo?: number;
  measures?: number;
  timeSignature?: [number, number];
  humanize?: boolean;
  startTime?: number;
  swingAmount?: number;
  density?: number;
  formMarkers?: number[];
  sectionMarkers?: number[];
  measureInfo?: { totalMeasures: number; measureDuration: number; sections?: SongSection[] };
  random?: () => number;
  bandContext?: BandContext;
  /** Streaming: hint that this measure should contain a fill (next measure is a boundary) */
  fillHint?: "section" | "phrase" | "setup" | false;
  /** Streaming: persisted drum state for phrase continuity across 1-measure calls */
  drumState?: DrumState;
  granular?: DrumGranular;
}

// ── Harmonic Analysis Types ──

export type HarmonicFunction = "tonic" | "predominant" | "dominant" | "chromatic";
export type CadenceType = "authentic" | "half" | "deceptive" | "plagal";

/** Per-chord harmonic analysis - populated by analyzeHarmony(). */
export interface ChordAnalysis {
  /** Scale degree relative to local key center, e.g., "I", "ii", "V", "bVII" */
  degree: string;
  /** Harmonic function category */
  function: HarmonicFunction;
  /** Local key center name (accounts for modulations), e.g., "C", "Bb" */
  keyCenter: string;
  /** This chord is a secondary dominant (V/x) */
  isSecondaryDominant: boolean;
  /** What this secondary dominant targets (degree string, e.g., "ii", "vi") */
  secondaryTarget?: string;
  /** Part of a ii-V-I (or ii-V) progression */
  isPartOfIiVI: boolean;
  /** Position within ii-V-I */
  iiViPosition?: "ii" | "V" | "I";
  /** Role in a cadence at a phrase boundary */
  cadenceRole?: "predominant" | "dominant" | "resolution";
  /** Type of cadence this chord participates in */
  cadenceType?: CadenceType;
  /** Whether this chord begins a new key center (modulation) */
  isModulationPoint: boolean;
  /** Tension level: 0 = stable/resolved, 1 = maximum tension */
  tension: number;
}

/** Full harmonic analysis of a chord progression. */
export interface HarmonicAnalysisResult {
  /** Global key center (pitch class name) */
  keyCenter: string;
  /** Key center regions (for modulating pieces like Giant Steps) */
  keyCenters: { key: string; startIndex: number; endIndex: number }[];
  /** Per-chord analysis (parallel to input ChordEvent[]) */
  chordAnalyses: ChordAnalysis[];
  /** Indices of detected ii-V-I progressions */
  iiViLocations: { ii: number; V: number; I: number }[];
  /** Average chords per measure */
  harmonicRhythm: number;
}

// ── Groove Template Types ──

export interface ElementTiming {
  bias: number;
  jitter: number;
}

export interface GrooveTemplate {
  kick: ElementTiming;
  snare: ElementTiming;
  hihat: ElementTiming;
  ride: ElementTiming;
  crash: ElementTiming;
  bass: ElementTiming;
  bassOffbeat: ElementTiming;
  piano: ElementTiming;
  pianoAnticipation: ElementTiming;
}

// ── Style Preset Types ──

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  style: PracticeStyle;
  instrumentStyles?: InstrumentStyles;
  parameters: StyleParameters;
  tempoRange: [number, number];
}

// ── Instrument Role (for swing utils) ──

export type InstrumentRole = "drums" | "bass" | "piano";

// ── Ensemble Coordination Types ──

export type RandomFn = () => number;

export type PhraseArc = "build" | "sustain" | "release" | "drop" | "climax";

export interface PhraseIntent {
  arc: PhraseArc;                         // overall energy trajectory for this phrase
  dropMeasures: number[];                 // measure indices where dynamic drops occur (ride-only / pedal bass)
  pianoRests: number[];                   // measures where piano deliberately rests
  bassRests: number[];                    // measures where bass deliberately rests (rare — usually pedal instead)
  drumsMinimal: number[];                 // measures where drums thin to ride + hi-hat only
  anticipationChance: number;             // 0-1: probability of piano anticipating next chord on beat 4-and
  passingChordChance: number;             // 0-1: probability of chromatic approach chord between changes
  motifLockBars: number;                  // how many bars piano/bass hold their current pattern
  crescendo: boolean;                     // gradual push within this phrase
  conversationLeader: "piano" | "bass" | "drums" | null; // who "speaks" — others listen/support
}

export interface PhraseMap {
  boundaries: number[];       // measure indices where phrases start
  phraseLength: number;       // current phrase length (2, 4, or 8 bars)
  intents: PhraseIntent[];    // per-phrase musical intent (parallel to boundaries)
}

export interface BandContext {
  // drums → bass
  kickTimes: number[];
  kickDensity: number;            // kicks per measure (0-8)
  hihatPattern: "8ths" | "16ths" | "quarters" | "sparse";

  // drums → piano
  drumDensity: number;            // normalized 0-1
  crashTimes: number[];           // phrase boundary markers

  // bass → piano
  bassRegister: "low" | "mid" | "high";
  bassRhythm: "walking" | "half" | "pedal" | "syncopated";
  bassTimes: number[];

  // shared
  phraseMap: PhraseMap;
  currentSection: SongSection | null;
  sectionEnergy: number;          // 0-1

  // ── Musicality / Conversation State ──
  currentPhraseIntent: PhraseIntent | null;  // active phrase's musical plan
  creativity: number;                        // 0-100 from parameters
  conversation: number;                      // 0-100 from parameters
  airGaps: number;                           // 0-100 from parameters
  harmonicFreedom: number;                   // 0-100 from parameters

  // ── Harmonic Analysis ──
  harmonicAnalysis?: HarmonicAnalysisResult;
}

export interface EnsembleOptions {
  chordEvents: ChordEvent[];
  style: PracticeStyle;
  tempo: number;
  timeSignature?: [number, number];
  measures: number;
  sections?: SongSection[];
  density?: number;               // 0-100
  swingAmount?: number;           // 0-100
  strumMs?: number;               // 0-30
  seed?: number;                  // omit = random, provide = deterministic
  instrumentStyles?: InstrumentStyles;
  measureInfo?: { totalMeasures: number; measureDuration: number; sections?: SongSection[] };
  // ── Musicality Parameters ──
  creativity?: number;            // 0-100: surprise frequency
  conversation?: number;          // 0-100: inter-instrument responsiveness
  airGaps?: number;               // 0-100: intentional silence frequency
  harmonicFreedom?: number;       // 0-100: reharmonization, passing chords
  // ── Per-Instrument Granular ──
  drumGranular?: DrumGranular;
  pianoGranular?: PianoGranular;
  bassGranular?: BassGranular;
}

export interface EnsembleResult {
  drums: DrumHit[];
  bass: BassNote[];
  piano: CompNote[];
  seed: number;                   // always returned (for replay)
  context: BandContext;
}

export interface MeasureSlice {
  measure: number;
  drums: DrumHit[];
  bass: BassNote[];
  piano: CompNote[];
  context: BandContext;
}
