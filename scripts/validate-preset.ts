#!/usr/bin/env npx tsx
/**
 * Validate a community preset file.
 *
 * Usage:
 *   npx tsx scripts/validate-preset.ts presets/your-preset.ts
 *   npx tsx scripts/validate-preset.ts --all
 *
 * Checks:
 *   1. File exports a valid StylePreset object
 *   2. All required fields present with correct types
 *   3. ID is unique (no conflict with built-in or other community presets)
 *   4. Parameters in valid ranges
 *   5. tempoRange[0] < tempoRange[1]
 *   6. Style is a valid PracticeStyle
 *   7. Generation smoke test: produces output without errors
 */

import { readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { STYLE_PRESETS, STYLE_LABELS, generateJamSession, generateWalkingBass, generatePianoComping, generateDrumPattern, scoreChordsToEvents } from '../src/index';
import type { StylePreset, PracticeStyle } from '../src/types';

const VALID_STYLES = new Set(Object.keys(STYLE_LABELS));

interface ValidationResult {
  file: string;
  errors: string[];
  warnings: string[];
}

async function validatePreset(filePath: string): Promise<ValidationResult> {
  const result: ValidationResult = { file: filePath, errors: [], warnings: [] };

  // 1. Import the preset
  let preset: StylePreset;
  try {
    const mod = await import(resolve(filePath));
    preset = mod.default;
    if (!preset) {
      result.errors.push('File must have a default export');
      return result;
    }
  } catch (e) {
    result.errors.push(`Failed to import: ${(e as Error).message}`);
    return result;
  }

  // 2. Required fields
  if (!preset.id || typeof preset.id !== 'string') result.errors.push('Missing or invalid "id"');
  if (!preset.name || typeof preset.name !== 'string') result.errors.push('Missing or invalid "name"');
  if (!preset.description || typeof preset.description !== 'string') result.errors.push('Missing or invalid "description"');
  if (!preset.style || typeof preset.style !== 'string') result.errors.push('Missing or invalid "style"');
  if (!preset.parameters) result.errors.push('Missing "parameters"');
  if (!preset.tempoRange || !Array.isArray(preset.tempoRange)) result.errors.push('Missing or invalid "tempoRange"');

  if (result.errors.length > 0) return result;

  // 3. ID format
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(preset.id)) {
    result.errors.push(`ID "${preset.id}" must be kebab-case (e.g., "afrobeat-highlife")`);
  }

  // 4. ID uniqueness
  const builtInIds = new Set(STYLE_PRESETS.map(p => p.id));
  if (builtInIds.has(preset.id)) {
    result.errors.push(`ID "${preset.id}" conflicts with built-in preset`);
  }

  // 5. Valid style
  if (!VALID_STYLES.has(preset.style)) {
    result.errors.push(`Style "${preset.style}" is not valid. Must be one of: ${[...VALID_STYLES].join(', ')}`);
  }

  // 6. Instrument style overrides
  if (preset.instrumentStyles) {
    for (const [inst, style] of Object.entries(preset.instrumentStyles)) {
      if (!VALID_STYLES.has(style as string)) {
        result.errors.push(`instrumentStyles.${inst} "${style}" is not a valid style`);
      }
    }
  }

  // 7. Parameter ranges
  if (preset.parameters.swingAmount < 0 || preset.parameters.swingAmount > 100) {
    result.errors.push(`swingAmount ${preset.parameters.swingAmount} must be 0-100`);
  }
  if (preset.parameters.density < 0 || preset.parameters.density > 100) {
    result.errors.push(`density ${preset.parameters.density} must be 0-100`);
  }

  // 8. Tempo range
  if (preset.tempoRange[0] >= preset.tempoRange[1]) {
    result.errors.push(`tempoRange[0] (${preset.tempoRange[0]}) must be less than tempoRange[1] (${preset.tempoRange[1]})`);
  }
  if (preset.tempoRange[0] < 30 || preset.tempoRange[1] > 300) {
    result.errors.push(`tempoRange must be within 30-300 BPM`);
  }

  // 9. Description quality
  if (preset.description.length < 10) {
    result.errors.push('Description too short (min 10 chars)');
  }
  if (preset.name.length < 2) {
    result.errors.push('Name too short (min 2 chars)');
  }

  // 10. Generation smoke test
  if (result.errors.length === 0) {
    const tempo = Math.round((preset.tempoRange[0] + preset.tempoRange[1]) / 2);
    try {
      const session = generateJamSession({
        key: 'C',
        form: 'blues12',
        style: preset.style,
        tempo,
        timeSignature: [4, 4],
      });

      if (session.score.measures.length === 0) {
        result.errors.push('Generation produced empty score');
      }

      const chords = scoreChordsToEvents(session.score.measures);
      const bass = generateWalkingBass(chords, { style: preset.style, tempo });
      const piano = generatePianoComping(chords, { style: preset.style, tempo });
      const drums = generateDrumPattern({ style: preset.style, tempo, measures: 4, timeSignature: [4, 4] });

      if (bass.length === 0) result.errors.push('Walking bass produced no notes');
      if (piano.length === 0) result.errors.push('Piano comping produced no notes');
      if (drums.length === 0) result.errors.push('Drum pattern produced no hits');
    } catch (e) {
      result.errors.push(`Generation failed: ${(e as Error).message}`);
    }
  }

  // Warnings
  if (preset.tempoRange[1] - preset.tempoRange[0] < 20) {
    result.warnings.push('Narrow tempo range — consider widening for more flexibility');
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  let files: string[];
  if (args.includes('--all')) {
    const presetsDir = resolve('presets');
    try {
      const entries = await readdir(presetsDir);
      files = entries.filter(f => f.endsWith('.ts')).map(f => `presets/${f}`);
    } catch {
      console.log('No presets/ directory or no .ts files found.');
      return;
    }
  } else if (args.length === 0) {
    console.log('Usage: npx tsx scripts/validate-preset.ts <file.ts> [file2.ts ...]');
    console.log('       npx tsx scripts/validate-preset.ts --all');
    process.exit(1);
  } else {
    files = args;
  }

  if (files.length === 0) {
    console.log('No preset files to validate.');
    return;
  }

  // Check for duplicate IDs across all community presets
  const allIds = new Map<string, string>();
  let hasErrors = false;

  for (const file of files) {
    const result = await validatePreset(file);

    // Check cross-file ID uniqueness
    try {
      const mod = await import(resolve(file));
      if (mod.default?.id) {
        const existing = allIds.get(mod.default.id);
        if (existing) {
          result.errors.push(`ID "${mod.default.id}" already used by ${existing}`);
        } else {
          allIds.set(mod.default.id, file);
        }
      }
    } catch {
      // Already reported in validatePreset
    }

    const status = result.errors.length === 0 ? 'PASS' : 'FAIL';
    console.log(`\n${status}  ${basename(file)}`);

    for (const err of result.errors) {
      console.log(`  ERROR: ${err}`);
      hasErrors = true;
    }
    for (const warn of result.warnings) {
      console.log(`  WARN:  ${warn}`);
    }
  }

  console.log(`\n${files.length} preset(s) validated.`);
  if (hasErrors) process.exit(1);
}

main();
