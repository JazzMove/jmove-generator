/**
 * Gospel Funk — community preset example
 *
 * Cory Henry, Snarky Puppy gospel influence — churchy organ/piano feel
 * with deep funk pocket. Lots of syncopation, medium-high density,
 * subtle swing from the gospel tradition.
 */

import type { StylePreset } from '../src/types';

const preset: StylePreset = {
  id: 'gospel-funk',
  name: 'Gospel Funk',
  description: 'Cory Henry, Snarky Puppy gospel influence — churchy comping over deep funk pocket with syncopated hits',
  style: 'funk',
  instrumentStyles: {
    piano: 'neoSoul',
    drums: 'funk',
  },
  parameters: {
    swingAmount: 25,
    density: 72,
  },
  tempoRange: [85, 120],
};

export default preset;
