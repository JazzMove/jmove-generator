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

export interface StyleParameters {
  swingAmount: number;  // 0-100: 0=straight 8ths, 50=light swing, 100=hard triplet
  density: number;      // 0-100: sparse vs busy
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
}

export interface ChordEvent {
  root: string;
  quality: string;
  time: number;
  duration: number;
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
}

// ── Drum Pattern Types ──

export interface DrumHit {
  pitch: number;
  time: number;
  duration: number;
  velocity: number;
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
