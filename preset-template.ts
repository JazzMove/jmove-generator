/**
 * Preset Template — copy this file to create a new community preset.
 *
 * 1. Copy this file to `presets/your-preset-name.ts`
 * 2. Fill in all fields (see inline comments)
 * 3. Run `npx tsx scripts/validate-preset.ts presets/your-preset-name.ts`
 * 4. Listen to the generated output at both min and max tempo
 * 5. Submit a PR using the preset PR template
 */

import type { StylePreset } from './src/types';

const preset: StylePreset = {
  // Unique kebab-case ID — must not conflict with built-in or other community presets
  id: 'your-preset-id',

  // Display name shown in the UI
  name: 'Your Preset Name',

  // Short description: genre, key influences, character
  // Be specific — "Afrobeat highlife with 6/8 bell pattern" not just "African music"
  description: 'Describe the style, key influences (artists/albums), and musical character',

  // Base style — determines which generator algorithms are used for bass/piano/drums.
  // Must be one of: swing, bossa, latin, ballad, funk, fusion, ecm, hardBop, coolJazz,
  //   modal, jazzWaltz, shuffleBlues, neoSoul, contemporaryJazz, mathRock, idm,
  //   holdsworth, alfaMist, metheny
  style: 'swing',

  // Optional: override individual instrument styles (omit to use the base style for all)
  // instrumentStyles: {
  //   bass: 'latin',
  //   piano: 'ecm',
  //   drums: 'fusion',
  // },

  // Style parameters
  parameters: {
    swingAmount: 50,  // 0 = straight 8ths, 50 = light swing, 100 = heavy triplet
    density: 50,      // 0 = sparse/spacious, 50 = moderate, 100 = busy/dense
  },

  // Realistic BPM range for this style — [min, max]
  tempoRange: [100, 160],
};

export default preset;
