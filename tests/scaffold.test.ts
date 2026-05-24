import { describe, it, expect } from 'vitest';
import {
  generateJamSession,
  generateWalkingBass,
  generatePianoComping,
  generateDrumPattern,
  scoreChordsToEvents,
  STYLE_PRESETS,
  STYLE_CATEGORIES,
  STYLE_LABELS,
  ALL_KEYS,
  FORM_LABELS,
  FORM_MEASURE_COUNTS,
  GM_DRUMS,
  getGrooveTemplate,
  tempoSwingMultiplier,
  autoDetectPreset,
  irealStyleToPracticeStyle,
} from '../src/index';
import type {
  JamConfig,
  JamResult,
  BassNote,
  CompNote,
  DrumHit,
  StylePreset,
  PracticeStyle,
  QuantizedScore,
} from '../src/index';

describe('@jmove/generator', () => {
  describe('exports', () => {
    it('exports all generator functions', () => {
      expect(typeof generateJamSession).toBe('function');
      expect(typeof generateWalkingBass).toBe('function');
      expect(typeof generatePianoComping).toBe('function');
      expect(typeof generateDrumPattern).toBe('function');
      expect(typeof scoreChordsToEvents).toBe('function');
      expect(typeof autoDetectPreset).toBe('function');
      expect(typeof irealStyleToPracticeStyle).toBe('function');
    });

    it('exports constants', () => {
      expect(STYLE_PRESETS.length).toBeGreaterThan(0);
      expect(ALL_KEYS).toHaveLength(12);
      expect(Object.keys(FORM_LABELS).length).toBeGreaterThan(10);
      expect(GM_DRUMS.KICK).toBe(36);
      expect(GM_DRUMS.SNARE).toBe(38);
    });

    it('exports utility functions', () => {
      expect(typeof getGrooveTemplate).toBe('function');
      expect(typeof tempoSwingMultiplier).toBe('function');
    });
  });

  describe('generateJamSession', () => {
    it('generates a blues12 session', () => {
      const config: JamConfig = {
        key: 'Bb',
        form: 'blues12',
        style: 'swing',
        tempo: 140,
        timeSignature: [4, 4],
      };
      const result: JamResult = generateJamSession(config);
      expect(result.score.measures).toHaveLength(12);
      expect(result.config).toEqual(config);
      expect(result.progressionLabel).toBeTruthy();
    });

    it('generates a rhythm32 session', () => {
      const result = generateJamSession({
        key: 'C',
        form: 'rhythm32',
        style: 'hardBop',
        tempo: 180,
        timeSignature: [4, 4],
      });
      expect(result.score.measures).toHaveLength(32);
    });

    it('generates fullSong with sections', () => {
      const result = generateJamSession({
        key: 'F',
        form: 'fullSong',
        style: 'fusion',
        tempo: 120,
        timeSignature: [4, 4],
      });
      expect(result.sections).toBeDefined();
      expect(result.sections!.length).toBeGreaterThan(0);
      expect(result.score.measures.length).toBeGreaterThan(0);
    });
  });

  describe('generateWalkingBass', () => {
    it('generates bass notes from chord events', () => {
      const chords = scoreChordsToEvents([
        { chords: [{ root: 'C', quality: 'maj7', startTime: 0 }], startTime: 0, endTime: 2 },
        { chords: [{ root: 'F', quality: '7', startTime: 2 }], startTime: 2, endTime: 4 },
      ]);
      const notes: BassNote[] = generateWalkingBass(chords, { style: 'swing', tempo: 120 });
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0].pitch).toBeGreaterThanOrEqual(28); // E1
      expect(notes[0].pitch).toBeLessThanOrEqual(55);    // G3
    });
  });

  describe('generatePianoComping', () => {
    it('generates piano voicings from chord events', () => {
      const chords = [
        { root: 'D', quality: 'm7', time: 0, duration: 2 },
        { root: 'G', quality: '7', time: 2, duration: 2 },
      ];
      const notes: CompNote[] = generatePianoComping(chords, { style: 'swing', tempo: 120 });
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0].pitches.length).toBeGreaterThan(0);
    });
  });

  describe('generateDrumPattern', () => {
    it('generates drum hits', () => {
      const hits: DrumHit[] = generateDrumPattern({
        style: 'swing',
        tempo: 140,
        measures: 4,
        timeSignature: [4, 4],
      });
      expect(hits.length).toBeGreaterThan(0);
      const pitches = new Set(hits.map(h => h.pitch));
      expect(pitches.has(GM_DRUMS.RIDE)).toBe(true); // swing = ride cymbal
    });

    it('generates bossa drum pattern', () => {
      const hits = generateDrumPattern({
        style: 'bossa',
        tempo: 130,
        measures: 4,
        timeSignature: [4, 4],
      });
      expect(hits.length).toBeGreaterThan(0);
    });
  });

  describe('style presets', () => {
    it('all presets have valid structure', () => {
      for (const preset of STYLE_PRESETS) {
        expect(preset.id).toBeTruthy();
        expect(preset.name).toBeTruthy();
        expect(preset.description).toBeTruthy();
        expect(preset.parameters.swingAmount).toBeGreaterThanOrEqual(0);
        expect(preset.parameters.swingAmount).toBeLessThanOrEqual(100);
        expect(preset.parameters.density).toBeGreaterThanOrEqual(0);
        expect(preset.parameters.density).toBeLessThanOrEqual(100);
        expect(preset.tempoRange[0]).toBeLessThan(preset.tempoRange[1]);
      }
    });

    it('all preset IDs are unique', () => {
      const ids = STYLE_PRESETS.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all preset styles have labels', () => {
      const stylesWithLabels = new Set(Object.keys(STYLE_LABELS));
      for (const preset of STYLE_PRESETS) {
        expect(stylesWithLabels.has(preset.style)).toBe(true);
      }
    });

    it('all categories reference valid styles', () => {
      const validStyles = new Set(Object.keys(STYLE_LABELS));
      for (const [, styles] of Object.entries(STYLE_CATEGORIES)) {
        for (const style of styles) {
          expect(validStyles.has(style)).toBe(true);
        }
      }
    });
  });

  describe('groove templates', () => {
    it('returns template for all styles', () => {
      const styles = Object.keys(STYLE_LABELS);
      for (const style of styles) {
        const template = getGrooveTemplate(style);
        expect(template).toBeDefined();
        expect(template.kick).toBeDefined();
        expect(template.snare).toBeDefined();
        expect(template.ride).toBeDefined();
        expect(template.bass).toBeDefined();
        expect(template.piano).toBeDefined();
      }
    });

    it('falls back to swing for unknown style', () => {
      const template = getGrooveTemplate('nonexistent');
      expect(template).toEqual(getGrooveTemplate('swing'));
    });
  });

  describe('swing utils', () => {
    it('tempoSwingMultiplier scales with tempo', () => {
      expect(tempoSwingMultiplier(60)).toBe(1.5);   // slow = heavy swing
      expect(tempoSwingMultiplier(140)).toBe(1.0);   // medium = normal
      expect(tempoSwingMultiplier(280)).toBeLessThan(0.5); // fast = nearly straight
    });
  });

  describe('autoDetectPreset', () => {
    it('detects blues from dominant 7th chords', () => {
      const score: QuantizedScore = {
        measures: Array.from({ length: 12 }, (_, i) => ({
          index: i,
          notes: [],
          chords: [{ root: i < 4 ? 'Bb' : i < 6 ? 'Eb' : 'Bb', quality: '7', startTime: i * 2 }],
          timeSignature: [4, 4] as [number, number],
          keySignature: 'Bb',
          tempo: 120,
          startTime: i * 2,
          endTime: (i + 1) * 2,
        })),
        keySignature: 'Bb',
        timeSignature: [4, 4],
        tempo: 120,
        duration: 24,
      };
      const preset = autoDetectPreset(score);
      expect(preset.style).toBe('shuffleBlues');
    });
  });

  describe('style mapping', () => {
    it('maps iReal styles to practice styles', () => {
      expect(irealStyleToPracticeStyle('Medium Swing')).toBe('swing');
      expect(irealStyleToPracticeStyle('Bossa Nova')).toBe('bossa');
      expect(irealStyleToPracticeStyle('Ballad')).toBe('ballad');
      expect(irealStyleToPracticeStyle('Even 8ths')).toBe('funk');
      expect(irealStyleToPracticeStyle(undefined)).toBe('swing');
    });
  });
});
