/**
 * Walking Bass Generator — rule-based walking bass lines from chord progressions.
 *
 * Rules (inspired by jazz walking bass pedagogy):
 *   Beat 1: chord root (or 5th for variety)
 *   Beat 2: chord tone (3rd, 5th, 7th)
 *   Beat 3: passing tone (scale-wise between beat 2 and target)
 *   Beat 4: approach tone (chromatic half-step to next root)
 *
 * Supports styles: swing (quarter notes), bossa (root-5th pattern), latin (tumbao).
 * Range: E1–G3 (MIDI 28–55).
 */

import { dynamicMultiplier } from "./swingUtils";
import { getGrooveTemplate, applyGroove, rubatoOffset } from "./grooveTemplates";
import type { BassNote, WalkingBassOptions, ChordEvent, PhraseIntent, PhraseArc } from "./types";
import {
  initBassState, restoreBassState,
  _rng, setBassTargetPitch,
  rootToMidi, clamp, closestOctave, constrainStepwise,
} from "./bassHelpers";
import {
  generateSwingMeasure, generateBossaMeasure, generateLatinMeasure,
  generateFusionMeasure, generateEcmMeasure, generateHardBopMeasure,
  generateCoolJazzMeasure, generateModalMeasure, generateJazzWaltzMeasure,
  generateShuffleBluesMeasure, generateNeoSoulMeasure,
  generateContemporaryJazzMeasure, generateMathRockMeasure,
  generateIdmMeasure, generateHoldsworthMeasure, generateAlfaMistMeasure,
  generateMethenyMeasure,
} from "./bassStyles";
import { inferTimeSignature, generateOddMeterBass } from "./bassOddMeters";

export type { BassNote, WalkingBassOptions, ChordEvent };

// ── Main Generator ──

/**
 * Generate a walking bass line from a sequence of chord events.
 * Returns MIDI note events ready for Tone.js scheduling.
 */
export function generateWalkingBass(
  chords: ChordEvent[],
  options: WalkingBassOptions = {},
): BassNote[] {
  if (chords.length === 0) return [];

  const savedState = initBassState(
    options.random ?? Math.random,
    options.granular,
    options.bandContext?.harmonicRhythm ?? 1,
    options.bandContext?.sectionEnergy ?? 0.7,
  );

  const style = options.style ?? "swing";
  const tempo = options.tempo ?? 120;
  if (tempo <= 0) { restoreBassState(savedState); throw new RangeError(`tempo must be > 0, got ${tempo}`); }
  try {
  const humanize = options.humanize ?? false;
  const beatDuration = 60 / tempo;

  const notes: BassNote[] = [];
  const beat1Indices = new Set<number>();
  let prevPitch: number | null = null;
  let prevDirection: "up" | "down" | null = null;

  // Infer time signature from chord durations if available
  const inferredTimeSig = chords.length > 0
    ? inferTimeSignature(chords[0].duration, beatDuration)
    : [4, 4] as [number, number];

  // ── Musicality: Phrase Intent Awareness ──
  const bandCtx = options.bandContext;
  const conversation = (bandCtx?.conversation ?? 30) / 100;
  const measureDuration = options.measureInfo?.measureDuration ?? (chords.length > 0 ? chords[0].duration : beatDuration * 4);

  for (let i = 0; i < chords.length; i++) {
    const chord = chords[i];
    const nextChord = i < chords.length - 1 ? chords[i + 1] : null;

    // ── Phrase Intent: Air Gaps and Drops ──
    const measureIdx = Math.floor(chord.time / measureDuration);
    const phraseIntent = bandCtx?.phraseMap?.intents?.length
      ? lookupBassIntent(measureIdx, bandCtx.phraseMap)
      : null;

    // Bass register arc: use phrase-planned target pitch as soft register bias
    setBassTargetPitch(phraseIntent?.bassTargetPitch);

    // Intent-driven bass rest: extremely rare but powerful (bass drops out)
    if (phraseIntent?.bassRests?.includes(measureIdx)) {
      continue;
    }

    // Intent-driven drop: play only a sustained pedal root (very quiet)
    if (phraseIntent?.dropMeasures?.includes(measureIdx)) {
      const dropRoot: number = rootToMidi(chord.root);
      const dropPitch: number = prevPitch !== null ? closestOctave(dropRoot, prevPitch) : dropRoot;
      const pedalNote: BassNote = {
        pitch: dropPitch,
        time: chord.time,
        duration: chord.duration * 0.9,
        velocity: 50,
      };
      beat1Indices.add(notes.length);
      notes.push(pedalNote);
      prevPitch = dropPitch;
      continue;
    }

    // Conversation: when bass is "listening" (not the leader), play sparser
    const isLeader = phraseIntent?.conversationLeader === "bass";
    const isListening = phraseIntent?.conversationLeader != null && !isLeader;

    let measureNotes: BassNote[];

    // Try odd-meter generator first (overrides style for non-standard meters).
    // Styles with rich dedicated generators keep their own patterns in odd meters.
    const STYLE_OWNS_ODD_METER = new Set(["alfaMist", "holdsworth", "metheny", "neoSoul"]);
    const useOddMeter = !STYLE_OWNS_ODD_METER.has(style);
    const oddMeterNotes = useOddMeter ? generateOddMeterBass(inferredTimeSig, chord, nextChord, beatDuration, prevPitch) : null;
    if (oddMeterNotes && !(inferredTimeSig[0] === 4 && inferredTimeSig[1] === 4) && !(inferredTimeSig[0] === 3 && inferredTimeSig[1] === 4 && style === "jazzWaltz")) {
      measureNotes = oddMeterNotes;
    } else switch (style) {
      case "bossa":
        measureNotes = generateBossaMeasure(chord, beatDuration, prevPitch);
        break;
      case "latin":
        measureNotes = generateLatinMeasure(chord, beatDuration, prevPitch);
        break;
      case "fusion":
        measureNotes = generateFusionMeasure(chord, beatDuration, prevPitch);
        break;
      case "ecm":
        measureNotes = generateEcmMeasure(chord, beatDuration);
        break;
      case "hardBop":
        measureNotes = generateHardBopMeasure(chord, nextChord, beatDuration, prevPitch, prevDirection);
        break;
      case "coolJazz":
        measureNotes = generateCoolJazzMeasure(chord, nextChord, beatDuration, prevPitch, prevDirection);
        break;
      case "modal":
        measureNotes = generateModalMeasure(chord, beatDuration);
        break;
      case "jazzWaltz":
        measureNotes = generateJazzWaltzMeasure(chord, nextChord, beatDuration, prevPitch, prevDirection);
        break;
      case "shuffleBlues":
        measureNotes = generateShuffleBluesMeasure(chord, nextChord, beatDuration, prevPitch);
        break;
      case "neoSoul":
        measureNotes = generateNeoSoulMeasure(chord, beatDuration, prevPitch);
        break;
      case "contemporaryJazz":
        measureNotes = generateContemporaryJazzMeasure(chord, nextChord, beatDuration, prevPitch);
        break;
      case "mathRock":
        measureNotes = generateMathRockMeasure(chord, beatDuration, prevPitch);
        break;
      case "idm":
        measureNotes = generateIdmMeasure(chord, beatDuration);
        break;
      case "holdsworth":
        measureNotes = generateHoldsworthMeasure(chord, beatDuration, prevPitch);
        break;
      case "alfaMist":
        measureNotes = generateAlfaMistMeasure(chord, beatDuration, prevPitch);
        break;
      case "metheny":
        measureNotes = generateMethenyMeasure(chord, beatDuration, prevPitch);
        break;
      case "swing":
      default:
        measureNotes = generateSwingMeasure(chord, nextChord, beatDuration, prevPitch, options.swingAmount, tempo, style, prevDirection, phraseIntent?.arc);
        break;
    }

    // Trim notes that overflow chord duration
    if (chord.duration > 0 && measureNotes.length > 1) {
      const chordEnd = chord.time + chord.duration;
      measureNotes = measureNotes.filter(n => n.time < chordEnd + beatDuration * 0.6);
    }

    // Fix cross-bar repeats
    if (notes.length > 0 && measureNotes.length > 0 &&
        measureNotes[0].pitch === notes[notes.length - 1].pitch) {
      const prev = notes[notes.length - 1];
      prev.pitch = clamp(prev.pitch - 1) === measureNotes[0].pitch
        ? clamp(prev.pitch + 1)
        : clamp(prev.pitch - 1);
    }

    // Enforce stepwise motion within measure
    constrainStepwise(measureNotes);

    // Style-biased humanization via groove templates
    if (humanize) {
      const template = getGrooveTemplate(style ?? "swing");
      const grooveEnergy = bandCtx?.sectionEnergy;
      const grooveArc = phraseIntent?.arc as PhraseArc | undefined;
      const bpb = chord.duration / beatDuration;
      for (let ni = 0; ni < measureNotes.length; ni++) {
        const n = measureNotes[ni];
        const isOffbeat = ni % 2 !== 0;
        const element = isOffbeat ? template.bassOffbeat : template.bass;
        n.time = applyGroove(n.time, element, _rng, grooveEnergy, grooveArc);
        n.time += rubatoOffset(style ?? "swing", ni, bpb, grooveArc);
        if (n.time < 0) n.time = 0;
        n.velocity = Math.max(40, Math.min(127, n.velocity + Math.floor((_rng() - 0.5) * 10)));
      }
    }

    // Drums-first: snap beat 1/3 toward nearest kick for tight pocket
    if (options.kickTimes && options.kickTimes.length > 0) {
      for (let ni = 0; ni < measureNotes.length; ni++) {
        if (ni % 2 !== 0) continue;
        const n = measureNotes[ni];
        let bestDist = Infinity;
        let bestKick = n.time;
        for (const kt of options.kickTimes) {
          const dist = Math.abs(n.time - kt);
          if (dist < bestDist) { bestDist = dist; bestKick = kt; }
          if (kt > n.time + 0.02) break;
        }
        if (bestDist < 0.015) n.time = bestKick;
      }
    }

    // Dynamic arc: scale velocity by chorus position
    const convMult = isLeader ? 1 + 0.20 * conversation : isListening ? 1 - 0.30 * conversation : 1.0;
    // When listening and conversation is high, drop beat 2 to half-note feel
    if (isListening && conversation > 0.5 && measureNotes.length >= 4 && _rng() < conversation * 0.4) {
      const keep = measureNotes.filter((_, idx) => idx === 0 || idx === 2);
      for (let ki = 0; ki < keep.length - 1; ki++) {
        keep[ki].duration = keep[ki + 1].time - keep[ki].time - 0.01;
      }
      measureNotes = keep;
    }
    const bassArc = phraseIntent?.arc;
    const arcMult = bassArc === "shout" ? 1.18
      : bassArc === "climax" ? 1.12
      : bassArc === "build" || bassArc === "solo" ? 1.05
      : bassArc === "release" || bassArc === "outro" || bassArc === "interlude" ? 0.9
      : bassArc === "drop" || bassArc === "breakdown" ? 0.78
      : bassArc === "intro" ? 0.92
      : 1.0;
    // Feel changes
    const bassFeel = phraseIntent?.feel ?? "normal";
    const feelMult = bassFeel === "doubleTime" ? 1.1 : bassFeel === "halfTime" ? 0.85 : 1.0;
    if (bassFeel === "halfTime" && measureNotes.length > 2) {
      const thinned = measureNotes.filter((_, idx) => idx % 2 === 0);
      for (let ti = 0; ti < thinned.length - 1; ti++) {
        thinned[ti].duration = thinned[ti + 1].time - thinned[ti].time - 0.01;
      }
      if (thinned.length > 0) thinned[thinned.length - 1].duration = beatDuration * 1.8;
      measureNotes.length = 0;
      measureNotes.push(...thinned);
    }
    if (options.measureInfo) {
      const mIdx = Math.floor(chord.time / (options.measureInfo.measureDuration || 1));
      const dynMult = dynamicMultiplier(mIdx, options.measureInfo.totalMeasures, style, options.measureInfo.sections);
      const hasSectionDynamics = options.measureInfo.sections && options.measureInfo.sections.length > 0;
      const energyMult = (options.bandContext && !hasSectionDynamics) ? (0.75 + options.bandContext.sectionEnergy * 0.25) : 1.0;
      for (const n of measureNotes) {
        n.velocity = Math.min(127, Math.max(40, Math.round(n.velocity * dynMult * energyMult * convMult * arcMult * feelMult)));
      }
    } else if (convMult !== 1.0 || arcMult !== 1.0 || feelMult !== 1.0) {
      for (const n of measureNotes) {
        n.velocity = Math.min(127, Math.max(40, Math.round(n.velocity * convMult * arcMult * feelMult)));
      }
    }

    // Track contour direction for two-bar phrasing
    if (measureNotes.length >= 2) {
      const first = measureNotes[0].pitch;
      const last = measureNotes[measureNotes.length - 1].pitch;
      prevDirection = last > first ? "up" : last < first ? "down" : prevDirection;
    }

    beat1Indices.add(notes.length);
    notes.push(...measureNotes);
    if (measureNotes.length > 0) {
      prevPitch = measureNotes[measureNotes.length - 1].pitch;
    }
  }

  // Final dedup: no repeated adjacent pitches
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 1; i < notes.length; i++) {
      if (notes[i].pitch !== notes[i - 1].pitch) continue;
      const nudgeIdx = beat1Indices.has(i) ? i - 1
        : beat1Indices.has(i - 1) ? i
        : i - 1;
      const otherIdx = nudgeIdx === i ? i - 1 : i;
      const neighbor = nudgeIdx >= 1 && nudgeIdx - 1 !== otherIdx ? notes[nudgeIdx - 1].pitch : -1;
      const neighbor2 = nudgeIdx < notes.length - 1 && nudgeIdx + 1 !== otherIdx ? notes[nudgeIdx + 1].pitch : -1;
      const down = clamp(notes[nudgeIdx].pitch - 1);
      const up = clamp(notes[nudgeIdx].pitch + 1);
      if (down !== notes[otherIdx].pitch && down !== neighbor && down !== neighbor2) {
        notes[nudgeIdx].pitch = down;
        changed = true;
      } else if (up !== notes[otherIdx].pitch && up !== neighbor && up !== neighbor2) {
        notes[nudgeIdx].pitch = up;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Monophonic enforcement
  for (let i = 0; i < notes.length - 1; i++) {
    notes[i].duration = notes[i + 1].time - notes[i].time;
  }

  return notes;
  } finally {
    restoreBassState(savedState);
  }
}

// ── Phrase Intent Lookup (bass-side) ──
function lookupBassIntent(measure: number, phraseMap: { boundaries: number[]; intents?: PhraseIntent[] }): PhraseIntent | null {
  if (!phraseMap.intents || phraseMap.intents.length === 0) return null;
  for (let i = phraseMap.boundaries.length - 1; i >= 0; i--) {
    if (measure >= phraseMap.boundaries[i]) {
      return phraseMap.intents[i] ?? null;
    }
  }
  return null;
}

/**
 * Convert QuantizedScore chord progression into ChordEvent array.
 * Convenience helper for connecting import → practice flow.
 */
export function scoreChordsToEvents(
  measures: { chords: { root: string; quality: string; startTime: number }[]; startTime: number; endTime: number }[],
): ChordEvent[] {
  const events: ChordEvent[] = [];

  for (const measure of measures) {
    if (measure.chords.length === 0) continue;

    for (let ci = 0; ci < measure.chords.length; ci++) {
      const chord = measure.chords[ci];
      const nextChord = measure.chords[ci + 1];
      const endTime = nextChord ? nextChord.startTime : measure.endTime;

      events.push({
        root: chord.root,
        quality: chord.quality,
        time: chord.startTime,
        duration: endTime - chord.startTime,
      });
    }
  }

  return events;
}
