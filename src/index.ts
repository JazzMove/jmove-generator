/**
 * @jmove/generator — Jazz backing track generator
 *
 * Generate walking bass lines, piano comping, drum patterns,
 * and full jam sessions from chord progressions.
 *
 * @example
 * ```typescript
 * import { generateJamSession, STYLE_PRESETS } from '@jmove/generator';
 *
 * const session = generateJamSession({
 *   form: 'blues12',
 *   key: 'Bb',
 *   tempo: 140,
 *   style: 'swing',
 * });
 * ```
 *
 * @packageDocumentation
 */

// ── Types ──
export type {
  // Core style types
  PracticeStyle,
  BassStyle,
  PianoStyle,
  DrumStyle,
  StyleParameters,
  InstrumentStyles,
  InstrumentRole,

  // Score types (standalone, no external deps)
  QuantizedScore,
  QuantizedMeasure,
  QuantizedNote,
  MeasureChord,
  TabPosition,

  // Jam session types
  JamKey,
  JamForm,
  JamConfig,
  JamResult,
  SongSectionType,
  SongSection,

  // Instrument output types
  BassNote,
  WalkingBassOptions,
  ChordEvent,
  CompNote,
  PianoCompingOptions,
  DrumHit,
  DrumPatternOptions,
  DrumState,

  // Groove types
  ElementTiming,
  GrooveTemplate,

  // Preset types
  StylePreset,

  // Ensemble coordination types
  RandomFn,
  PhraseMap,
  PhraseIntent,
  PhraseArc,
  BandContext,
  EnsembleOptions,
  EnsembleResult,
  MeasureSlice,

  // Per-instrument granular types
  DrumGranular,
  PianoGranular,
  BassGranular,

  // Harmonic analysis types
  ChordAnalysis,
  HarmonicFunction,
  CadenceType,
  HarmonicAnalysisResult,
} from "./types";

// ── Jam Generator ──
export {
  generateJamSession,
  transposeProgression,
  getFormsForStyle,
  buildScoreFromChords,
  enrichQuality,
  ALL_KEYS,
  FORM_LABELS,
  FORM_MEASURE_COUNTS,
  TIME_SIGNATURE_GROUPS,
  ALL_TIME_SIGNATURES,
} from "./jamGenerator";

// ── Walking Bass ──
export { generateWalkingBass, scoreChordsToEvents } from "./walkingBass";

// ── Piano Comping ──
export { generatePianoComping } from "./pianoComping";

// ── Drum Patterns ──
export {
  generateDrumPattern,
  GM_DRUMS,
  getMeterPatternSet,
  getStylePatternSet,
  humanizeTime,
  humanizeVelocity,
  applyMicroVariation,
  interlockKickHihat,
} from "./drumPatterns";

// ── Style Presets ──
export { STYLE_PRESETS, STYLE_CATEGORIES, STYLE_LABELS } from "./stylePresets";

// ── Auto-Detect ──
export { autoDetectPreset } from "./autoDetectPreset";

// ── Groove Templates ──
export { getGrooveTemplate, applyGroove, drumPitchToElement, evolveElement, rubatoOffset } from "./grooveTemplates";

// ── Swing Utilities ──
export { tempoSwingMultiplier, instrumentSwingFactor, dynamicMultiplier, compressDynamicLevel } from "./swingUtils";

// ── Style Mapping ──
export { irealStyleToPracticeStyle } from "./styleMapping";

// ── Ensemble ──
export { generateEnsemble, generateEnsembleMeasures } from "./ensemble";

// ── Harmonic Analysis ──
export { analyzeHarmony } from "./harmonicAnalysis";

// ── Chord Quality ──
export {
  parseQuality,
  getChordIntervals,
  getQualityScale,
  classifyQuality,
  isDominant,
  isMinor,
  isDiminished,
  isHalfDiminished,
  SCALES as QUALITY_SCALES,
} from "./chordQuality";
export type { QualityFamily, ParsedQuality } from "./chordQuality";

// ── Complexity Mapping ──
export { resolveDrumGranular, resolvePianoGranular, resolveBassGranular } from "./complexityMapping";

// ── Probability Mapping ──
export {
  anticipationProb, passingChordProb, brokenVoicingProb, graceNoteProb,
  bassRootProb, enclosureProb, chromaticPassingProb,
  kickHihatInterlockProb, fillProbScale, alignmentThreshold, airGapDropProb,
} from "./probabilityMapping";

// ── PRNG ──
export { createPRNG, randomSeed, deriveStream, STREAM_DRUMS, STREAM_BASS, STREAM_PIANO } from "./prng";

// ── Version ──
// Injected at build time by tsup from package.json - never edit manually
declare const __GENERATOR_VERSION__: string;
export const GENERATOR_VERSION: string = typeof __GENERATOR_VERSION__ !== "undefined"
  ? __GENERATOR_VERSION__
  : "dev";
