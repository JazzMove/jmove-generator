/**
 * Ensemble Coordination Layer — coordinated multi-instrument generation.
 *
 * Generates drums, bass, and piano as a coordinated ensemble rather than
 * independent parts. Instruments inform each other: kick pattern shapes bass
 * timing, bass register guides piano voicing placement, drum density
 * modulates piano rhythmic activity.
 *
 * Features:
 *   - Deterministic via seedable PRNG (replay any "good take")
 *   - Phrase-aware generation (2/4/8-bar motifs with build/release arcs)
 *   - Section-driven dynamics (intro sparse, solo laid-back, shout dense)
 *   - Built-in alignment (no post-hoc kick↔bass snapping needed)
 *   - Measure-by-measure iterator for streaming/incremental use
 */

import { generateDrumPattern } from "./drumPatterns";
import { generateWalkingBass } from "./walkingBass";
import { generatePianoComping } from "./pianoComping";
import { createPRNG, randomSeed, deriveStream, STREAM_DRUMS, STREAM_BASS, STREAM_PIANO } from "./prng";
import type {
  BandContext,
  PhraseMap,
  EnsembleOptions,
  EnsembleResult,
  MeasureSlice,
  SongSection,
  DrumHit,
  DrumState,
  BassNote,
  CompNote,
} from "./types";

// ── Phrase Map Computation ──

function computePhraseMap(options: EnsembleOptions, masterRng: () => number): PhraseMap {
  const { measures, sections } = options;

  // Determine phrase length from sections or default
  let phraseLength: number;
  if (sections && sections.length > 1) {
    // Average section length determines phrase granularity
    const avgLen = sections.reduce((sum, s) => sum + (s.endMeasure - s.startMeasure), 0) / sections.length;
    phraseLength = avgLen <= 4 ? 2 : avgLen <= 8 ? 4 : 8;
  } else {
    phraseLength = measures <= 8 ? 2 : measures <= 16 ? 4 : 4;
  }

  // Compute boundaries
  const boundaries: number[] = [];
  if (sections && sections.length > 0) {
    // Section starts are always phrase boundaries
    for (const sec of sections) {
      if (!boundaries.includes(sec.startMeasure)) {
        boundaries.push(sec.startMeasure);
      }
    }
    // Subdivide long sections into phrases
    for (const sec of sections) {
      const len = sec.endMeasure - sec.startMeasure;
      if (len > phraseLength) {
        for (let m = sec.startMeasure + phraseLength; m < sec.endMeasure; m += phraseLength) {
          if (!boundaries.includes(m)) boundaries.push(m);
        }
      }
    }
  } else {
    // No sections: regular phrase grid
    for (let m = 0; m < measures; m += phraseLength) {
      boundaries.push(m);
    }
  }

  boundaries.sort((a, b) => a - b);

  // Generate motif seeds for each phrase
  const motifSeeds: number[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    motifSeeds.push(Math.floor(masterRng() * 0xFFFFFFFF));
  }

  return { boundaries, phraseLength, motifSeeds };
}

// ── Context Initialization ──

function initContext(phraseMap: PhraseMap): BandContext {
  return {
    kickTimes: [],
    kickDensity: 0,
    hihatPattern: "8ths",
    drumDensity: 0,
    crashTimes: [],
    bassRegister: "mid",
    bassRhythm: "walking",
    bassTimes: [],
    phraseMap,
    currentSection: null,
    sectionEnergy: 0.7,
  };
}

// ── Context Extraction from Generated Parts ──

function extractDrumContext(
  context: BandContext,
  drumHits: DrumHit[],
  measures: number,
): void {
  // Extract kick times
  context.kickTimes = drumHits
    .filter(h => h.pitch === 36) // GM_DRUMS.KICK
    .map(h => h.time)
    .sort((a, b) => a - b);

  // Kick density (per measure)
  context.kickDensity = measures > 0 ? context.kickTimes.length / measures : 0;

  // Crash times (phrase boundary markers)
  context.crashTimes = drumHits
    .filter(h => h.pitch === 49) // GM_DRUMS.CRASH
    .map(h => h.time)
    .sort((a, b) => a - b);

  // Detect hi-hat pattern density
  const hihatHits = drumHits.filter(h => h.pitch === 42 || h.pitch === 44 || h.pitch === 46);
  const hhPerMeasure = measures > 0 ? hihatHits.length / measures : 0;
  if (hhPerMeasure >= 12) context.hihatPattern = "16ths";
  else if (hhPerMeasure >= 6) context.hihatPattern = "8ths";
  else if (hhPerMeasure >= 3) context.hihatPattern = "quarters";
  else context.hihatPattern = "sparse";

  // Total drum density (normalized 0-1, based on typical range 20-80 hits/measure)
  const totalHitsPerMeasure = measures > 0 ? drumHits.length / measures : 0;
  context.drumDensity = Math.min(1, Math.max(0, (totalHitsPerMeasure - 5) / 40));
}

function extractBassContext(context: BandContext, bassNotes: BassNote[], measureDur: number): void {
  context.bassTimes = bassNotes.map(n => n.time).sort((a, b) => a - b);

  // Determine register
  if (bassNotes.length > 0) {
    const avgPitch = bassNotes.reduce((sum, n) => sum + n.pitch, 0) / bassNotes.length;
    context.bassRegister = avgPitch < 36 ? "low" : avgPitch > 45 ? "high" : "mid";
  }

  // Determine rhythm pattern
  if (bassNotes.length === 0) {
    context.bassRhythm = "pedal";
  } else if (measureDur > 0) {
    const notesPerMeasure = bassNotes.length / (bassNotes[bassNotes.length - 1].time / measureDur + 1);
    if (notesPerMeasure >= 3.5) context.bassRhythm = "walking";
    else if (notesPerMeasure >= 2) context.bassRhythm = "half";
    else context.bassRhythm = "pedal";
  }
}

// ── Section Energy ──

function getSectionEnergy(measure: number, sections?: SongSection[]): { section: SongSection | null; energy: number } {
  if (!sections || sections.length === 0) {
    return { section: null, energy: 0.7 };
  }

  for (const sec of sections) {
    if (measure >= sec.startMeasure && measure < sec.endMeasure) {
      return { section: sec, energy: Math.max(0.3, Math.min(1.0, sec.dynamicLevel)) };
    }
  }

  return { section: null, energy: 0.7 };
}

// ── Density Scaling by Section Energy ──

function scaleDensity(baseDensity: number, sectionEnergy: number): number {
  // Scale density by section energy: intro (0.3) → 58% of base, shout (1.0) → 100% of base
  const scale = sectionEnergy * 0.6 + 0.4;
  return Math.round(Math.min(100, Math.max(0, baseDensity * scale)));
}

// ── Built-in Alignment (replaces post-hoc snapping) ──

function alignBassToKicks(bassNotes: BassNote[], kickTimes: number[]): void {
  if (kickTimes.length === 0) return;
  for (let i = 0; i < bassNotes.length; i++) {
    // Only align downbeat notes (beat 1 and 3 positions)
    if (i % 2 !== 0) continue;
    const n = bassNotes[i];
    let bestDist = Infinity;
    let bestKick = n.time;
    for (const kt of kickTimes) {
      const dist = Math.abs(n.time - kt);
      if (dist < bestDist) { bestDist = dist; bestKick = kt; }
      if (kt > n.time + 0.02) break;
    }
    if (bestDist < 0.015) n.time = bestKick;
  }
}

function alignPianoToBass(pianoNotes: CompNote[], bassTimes: number[]): void {
  if (bassTimes.length === 0) return;
  for (const pn of pianoNotes) {
    let closest = bassTimes[0];
    let minDist = Math.abs(pn.time - closest);
    for (const bt of bassTimes) {
      const dist = Math.abs(pn.time - bt);
      if (dist < minDist) { closest = bt; minDist = dist; }
      if (bt > pn.time + 0.015) break;
    }
    // Snap within 15ms, but preserve intentional anticipations (>40ms before bass)
    if (minDist < 0.015 && !(pn.time < closest - 0.04)) {
      pn.time = closest;
    }
  }
}

// ── Main Ensemble Generator ──

/**
 * Generate a coordinated ensemble (drums + bass + piano) from chord events.
 *
 * Instruments are generated in order with coordination:
 * 1. Drums → kick/density context
 * 2. Bass → informed by kick pattern, generates register/rhythm context
 * 3. Piano → informed by bass register + drum density
 *
 * @param options - Ensemble configuration including chords, style, tempo, seed
 * @returns Coordinated ensemble result with seed for replay
 */
export function generateEnsemble(options: EnsembleOptions): EnsembleResult {
  const seed = options.seed ?? randomSeed();
  const masterRng = createPRNG(seed);

  const drumRng = deriveStream(seed, STREAM_DRUMS);
  const bassRng = deriveStream(seed, STREAM_BASS);
  const pianoRng = deriveStream(seed, STREAM_PIANO);

  const timeSignature = options.timeSignature ?? [4, 4];
  const tempo = options.tempo;
  const beatDuration = 60 / tempo;
  const beatsPerMeasure = timeSignature[0] * (4 / timeSignature[1]);
  const measureDuration = beatsPerMeasure * beatDuration;
  const density = options.density ?? 50;
  const swingAmount = options.swingAmount ?? 100;

  // Compute phrase structure
  const phraseMap = computePhraseMap(options, masterRng);
  const context = initContext(phraseMap);

  // Determine section energy for density scaling.
  // Batch path: compute weighted average energy across all measures so that
  // density scaling reflects the overall piece dynamics, not just measure 0.
  // Individual generators also receive sections via measureInfo and apply
  // per-measure dynamicMultiplier internally for fine-grained velocity arcs.
  let energy: number;
  if (options.sections && options.sections.length > 0) {
    let totalWeight = 0;
    let weightedEnergy = 0;
    for (const sec of options.sections) {
      const len = Math.max(1, sec.endMeasure - sec.startMeasure);
      const secEnergy = Math.max(0.3, Math.min(1.0, sec.dynamicLevel));
      weightedEnergy += secEnergy * len;
      totalWeight += len;
    }
    energy = totalWeight > 0 ? weightedEnergy / totalWeight : 0.7;
    // Set context to first section for initial bandContext state
    const { section } = getSectionEnergy(0, options.sections);
    context.currentSection = section;
  } else {
    energy = 0.7;
    context.currentSection = null;
  }
  context.sectionEnergy = energy;

  // Per-instrument style resolution
  const drumStyle = options.instrumentStyles?.drums ?? options.style;
  const bassStyle = options.instrumentStyles?.bass ?? options.style;
  const pianoStyle = options.instrumentStyles?.piano ?? options.style;

  const measureInfo = options.measureInfo ?? {
    totalMeasures: options.measures,
    measureDuration,
    sections: options.sections,
  };

  // ── Step 1: Generate Drums ──
  const scaledDrumDensity = scaleDensity(density, energy);
  const formMarkers = phraseMap.boundaries.filter(b => b > 0);
  const sectionMarkers = options.sections?.map(s => s.startMeasure).filter(m => m > 0) ?? [];

  const drumHits = generateDrumPattern({
    style: drumStyle,
    tempo,
    measures: options.measures,
    timeSignature,
    humanize: true,
    swingAmount,
    density: scaledDrumDensity,
    formMarkers,
    sectionMarkers,
    measureInfo,
    random: drumRng,
    bandContext: context,
  });

  // Extract drum context for bass coordination
  extractDrumContext(context, drumHits, options.measures);

  // ── Step 2: Generate Bass (informed by kick pattern) ──
  const scaledBassDensity = scaleDensity(density, energy);
  const bassNotes = generateWalkingBass(options.chordEvents, {
    style: bassStyle,
    tempo,
    swingAmount,
    density: scaledBassDensity,
    humanize: true,
    measureInfo,
    kickTimes: context.kickTimes,
    random: bassRng,
    bandContext: context,
  });

  // Built-in alignment: snap bass to nearest kick
  alignBassToKicks(bassNotes, context.kickTimes);

  // Extract bass context for piano coordination
  extractBassContext(context, bassNotes, measureDuration);

  // ── Step 3: Generate Piano (informed by bass register + drum density) ──
  const scaledPianoDensity = scaleDensity(density, energy);
  // Reduce piano density when drums are dense (avoid mud)
  const pianoAdjustedDensity = context.drumDensity > 0.7
    ? Math.round(scaledPianoDensity * 0.8)
    : scaledPianoDensity;

  const pianoNotes = generatePianoComping(options.chordEvents, {
    style: pianoStyle,
    tempo,
    swingAmount,
    density: pianoAdjustedDensity,
    strumMs: options.strumMs,
    measureInfo,
    random: pianoRng,
    bandContext: context,
  });

  // Built-in alignment: snap piano to nearest bass note
  alignPianoToBass(pianoNotes, context.bassTimes);

  return {
    drums: drumHits,
    bass: bassNotes,
    piano: pianoNotes,
    seed,
    context,
  };
}

// ── Streaming Iterator ──

/**
 * Generate ensemble measure-by-measure as an iterator.
 * Enables incremental generation without full upfront computation.
 *
 * Each yielded MeasureSlice contains the drum hits, bass notes, and piano
 * notes for that measure, plus the current BandContext state.
 */
export function* generateEnsembleMeasures(options: EnsembleOptions): Generator<MeasureSlice, void, undefined> {
  const seed = options.seed ?? randomSeed();
  const masterRng = createPRNG(seed);

  const drumRng = deriveStream(seed, STREAM_DRUMS);
  const bassRng = deriveStream(seed, STREAM_BASS);
  const pianoRng = deriveStream(seed, STREAM_PIANO);

  const timeSignature = options.timeSignature ?? [4, 4];
  const tempo = options.tempo;
  const beatDuration = 60 / tempo;
  const beatsPerMeasure = timeSignature[0] * (4 / timeSignature[1]);
  const measureDuration = beatsPerMeasure * beatDuration;
  const density = options.density ?? 50;
  const swingAmount = options.swingAmount ?? 100;

  const phraseMap = computePhraseMap(options, masterRng);
  const context = initContext(phraseMap);

  const drumStyle = options.instrumentStyles?.drums ?? options.style;
  const bassStyle = options.instrumentStyles?.bass ?? options.style;
  const pianoStyle = options.instrumentStyles?.piano ?? options.style;

  let totalDrumHits = 0; // Running count for drumDensity calculation

  // Persistent drum state for phrase continuity across 1-measure calls.
  // Sentinel values (variationIdx=-1, patternHoldBars=-1, tendency=null) tell
  // generateDrumPattern to initialize these via its own rng on the first call,
  // keeping PRNG consumption identical to the batch path.
  const drumState: DrumState = {
    variationIdx: -1,
    barsOnPattern: 0,
    patternHoldBars: -1,
    tendency: null,
  };

  for (let m = 0; m < options.measures; m++) {
    const measureStart = m * measureDuration;
    const measureEnd = (m + 1) * measureDuration;

    // Update section context
    const { section, energy } = getSectionEnergy(m, options.sections);
    context.currentSection = section;
    context.sectionEnergy = energy;

    // Determine form/section markers for this measure
    const formMarkers = phraseMap.boundaries.includes(m) ? [0] : [];
    const sectionMarkers = options.sections?.some(s => s.startMeasure === m) ? [0] : [];

    // Compute fill hint by looking ahead: does next measure start a section or phrase?
    const nextM = m + 1;
    const nextNextM = m + 2;
    let fillHint: "section" | "phrase" | "setup" | false = false;
    if (m > 0) {  // never fill on measure 0
      if (options.sections?.some(s => s.startMeasure === nextM)) {
        fillHint = "section";
      } else if (phraseMap.boundaries.includes(nextM)) {
        fillHint = "phrase";
      } else if (options.sections?.some(s => s.startMeasure === nextNextM)) {
        fillHint = "setup";
      }
    }

    const measureInfo = {
      totalMeasures: options.measures,
      measureDuration,
      sections: options.sections,
    };

    // Generate one measure of drums
    const scaledDensity = scaleDensity(density, energy);
    const drumSlice = generateDrumPattern({
      style: drumStyle,
      tempo,
      measures: 1,
      timeSignature,
      humanize: true,
      startTime: measureStart,
      swingAmount,
      density: scaledDensity,
      formMarkers,
      sectionMarkers,
      measureInfo,
      random: drumRng,
      bandContext: context,
      fillHint,
      drumState,
    });

    // Extract drum context from this measure
    const measureKicks = drumSlice.filter(h => h.pitch === 36).map(h => h.time).sort((a, b) => a - b);
    context.kickTimes.push(...measureKicks);
    // Update running drum density from total accumulated hits
    totalDrumHits += drumSlice.length;
    const measuresGenerated = m + 1;
    const hitsPerMeasure = totalDrumHits / measuresGenerated;
    context.drumDensity = Math.min(1, Math.max(0, (hitsPerMeasure - 5) / 40));

    // Generate bass for this measure's chords
    const measureChords = options.chordEvents.filter(
      c => c.time >= measureStart - 0.001 && c.time < measureEnd,
    );
    const bassSlice = measureChords.length > 0
      ? generateWalkingBass(measureChords, {
          style: bassStyle,
          tempo,
          swingAmount,
          density: scaledDensity,
          humanize: true,
          measureInfo,
          kickTimes: measureKicks,
          random: bassRng,
          bandContext: context,
        })
      : [];

    // Align bass to kicks
    alignBassToKicks(bassSlice, measureKicks);

    // Update bass context (register + rhythm + times)
    const newBassTimes = bassSlice.map(n => n.time);
    context.bassTimes.push(...newBassTimes);
    if (bassSlice.length > 0) {
      const avgPitch = bassSlice.reduce((sum, n) => sum + n.pitch, 0) / bassSlice.length;
      context.bassRegister = avgPitch < 36 ? "low" : avgPitch > 45 ? "high" : "mid";
    }

    // Generate piano for this measure's chords
    const pianoAdjustedDensity = context.drumDensity > 0.7
      ? Math.round(scaledDensity * 0.8)
      : scaledDensity;

    const pianoSlice = measureChords.length > 0
      ? generatePianoComping(measureChords, {
          style: pianoStyle,
          tempo,
          swingAmount,
          density: pianoAdjustedDensity,
          strumMs: options.strumMs,
          measureInfo,
          random: pianoRng,
          bandContext: context,
        })
      : [];

    // Align piano to bass
    alignPianoToBass(pianoSlice, newBassTimes);

    yield {
      measure: m,
      drums: drumSlice,
      bass: bassSlice,
      piano: pianoSlice,
      context: { ...context },
    };
  }
}
