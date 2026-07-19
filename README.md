# @jmove/generator

Jazz backing track generator. Walking bass, piano comping, drum patterns, and full ensemble sessions from chord progressions.

Zero dependencies. TypeScript. ESM + CJS.

[![CI](https://github.com/JazzMove/jmove-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/JazzMove/jmove-generator/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@jmove/generator)](https://www.npmjs.com/package/@jmove/generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Demo

Try the live app at **[jmove.it.com](https://jmove.it.com)** - the Practice Player uses this package to generate all backing tracks in real time.

### Stories

Deep technical articles about how JMove and the generator work:

- [Inside @jmove/generator: Every Algorithm Explained](https://upfusion.net/stories/open-source-jazz-generator) - Evans voicings, stochastic drum comping, groove templates
- [Building JMove: Architecture of a Jazz Practice Tool](https://upfusion.net/stories/building-jmove) - three engines, two languages, 45 chord qualities, 26 style presets
- [Walking Bass from First Principles](https://upfusion.net/stories/walking-bass-from-first-principles) - contour-first planning, approach weights, two-bar phrasing arcs
- [1,511 Jazz Standards in Your Browser](https://upfusion.net/stories/jazz-standards-browser) - iReal Pro URI decoding, 43-rule quality map, 748KB offline database
- [Five Ways to See a Chord](https://upfusion.net/stories/five-notation-views) - Zustand sync, DFS fretboard search, Viterbi voice-leading optimizer
- [14 Ways to Reharmonize a Jazz Standard](https://upfusion.net/stories/14-ways-to-reharmonize) - tritone subs to Coltrane changes, every technique with history and theory

---

## Features

**Generation**
- **Ensemble Coordination** - `generateEnsemble()` produces drums, bass, and piano as a coordinated band. Kick patterns shape bass timing, bass register guides piano voicings, drum density modulates comping activity
- **Streaming Iterator** - `generateEnsembleMeasures()` yields measure-by-measure for incremental generation
- **Jam Session Generator** - random chord progressions across 17 jazz forms (blues, rhythm changes, AABA, modal, Coltrane matrix, and more)

**Instruments**
- **Walking Bass** - rule-based walking lines with dissonance filtering, chromatic approaches, tritone sub approach on V-I, pattern variety, 19 styles (swing, bossa, Latin tumbao, neo-soul, math rock, IDM), proper odd-meter groupings (11/8, 7/8, 5/4)
- **Piano Comping** - Bill Evans rootless voicings (Type A/B), quartal, shell, cluster, upper structure triads, tritone sub reharmonization - all quality-aware with diatonic intervals per chord type, voice-led with rhythmic templates per style
- **Drum Patterns** - 19 styles with humanization, ghost notes, groove templates based on GrooVAE research. Holdsworth preset features Chad Wackerman-inspired drumming: cross-stick interjections, ghost cascades, linear fills, 11/8-specific patterns

**Intelligence**
- **Harmonic Analysis Engine** - `analyzeHarmony()` detects key centers, assigns Roman numeral degrees, identifies ii-V-I patterns, cadences, secondary dominants, and modulations. Per-chord tension values drive musical decisions across all generators
- **Musicality Engine** - phrase-level intelligence: dynamic drops, air gaps, harmonic anticipation, passing chords, conversation dynamics, motif memory. Four parameters (creativity, conversation, airGaps, harmonicFreedom) control musical character
- **Per-Instrument Complexity** - 3 general sliders drive 13 granular sub-controls via piecewise linear mapping. Manual overrides take precedence over derived values
- **Full Song Form** - multi-section arrangements with dynamic shaping and section-driven dynamics (intro sparse, shout dense)
- **Auto-Detect** - analyze a score to recommend the best preset

**Quality**
- **Seedable and Reproducible** - deterministic PRNG (xoshiro128**) with per-instrument streams. Save a seed, replay the exact same take
- **Groove Templates** - structured micro-timing offsets per instrument, not random jitter
- **23 Style Presets** - Classic Swing to IDM, with per-instrument style overrides and tuned musicality parameters

---

## Install

```bash
npm install @jmove/generator
```

Requires Node.js 20+.

---

## Quick Start

### Ensemble (recommended)

```typescript
import { generateJamSession, generateEnsemble, scoreChordsToEvents } from '@jmove/generator';

// Generate a 12-bar blues in Bb
const session = generateJamSession({
  key: 'Bb',
  form: 'blues12',
  style: 'swing',
  tempo: 140,
  timeSignature: [4, 4],
});

// Generate coordinated ensemble (drums -> bass -> piano)
const chords = scoreChordsToEvents(session.score.measures);
const result = generateEnsemble({
  chordEvents: chords,
  style: 'swing',
  tempo: 140,
  measures: 12,
  seed: 42,  // deterministic - omit for random
});

console.log(result.drums.length, 'drum hits');
console.log(result.bass.length, 'bass notes');
console.log(result.piano.length, 'piano chords');
console.log('Replay with seed:', result.seed);
```

### Individual Generators

```typescript
import {
  generateWalkingBass,
  generatePianoComping,
  generateDrumPattern,
  scoreChordsToEvents,
} from '@jmove/generator';

// Generate individual instrument parts (standalone, no coordination)
const bass = generateWalkingBass(chords, { style: 'swing', tempo: 140 });
const piano = generatePianoComping(chords, { style: 'swing', tempo: 140 });
const drums = generateDrumPattern({ style: 'swing', tempo: 140, measures: 12 });
```

---

## API Reference

### Jam Session

#### `generateJamSession(config: JamConfig): JamResult`

Generate a complete chord progression with score.

```typescript
interface JamConfig {
  key: JamKey;                     // 'C' | 'Db' | 'D' | ... | 'B'
  form: JamForm;                   // 'blues12' | 'rhythm32' | 'aaba32' | ...
  style: PracticeStyle;            // 'swing' | 'bossa' | 'funk' | ...
  tempo: number;                   // BPM (must be > 0)
  timeSignature: [number, number]; // e.g. [4, 4], [3, 4], [7, 8]
  measures?: number;               // override measure count (for 'free' form)
}

interface JamResult {
  score: QuantizedScore;           // full score with measures and chords
  config: JamConfig;
  progressionLabel: string;        // e.g. "Bb7 | Eb7 | Bb7 | ..."
  sections?: SongSection[];        // for 'fullSong' form
}
```

#### `transposeProgression(chords, semitones): string[][]`

Transpose a chord progression by semitones.

#### `getFormsForStyle(style): JamForm[]`

Get available forms for a style (e.g. waltz styles get waltz-compatible forms).

#### `enrichQuality(quality): string`

Normalize chord quality strings (e.g. `'-'` -> `'m'`, `'^7'` -> `'maj7'`).

### Walking Bass

#### `generateWalkingBass(chords, options?): BassNote[]`

```typescript
interface BassNote {
  pitch: number;     // MIDI pitch (28-55, E1-G3)
  time: number;      // seconds
  duration: number;  // seconds
  velocity: number;  // 0-127
}

interface WalkingBassOptions {
  style?: string;    // swing=quarter walk, bossa=root-5th, latin=tumbao
  tempo?: number;    // affects swing ratio and dynamics
  swingAmount?: number;
  density?: number;
  humanize?: boolean;
}
```

#### `scoreChordsToEvents(measures): ChordEvent[]`

Extract chord events with timing from score measures.

### Piano Comping

#### `generatePianoComping(chords, options?): CompNote[]`

```typescript
interface CompNote {
  pitches: number[];  // MIDI pitches (chord voicing, G3-C6)
  time: number;
  duration: number;
  velocity: number;
}

interface PianoCompingOptions {
  style?: string;
  tempo?: number;
  humanize?: boolean;
  swingAmount?: number;
  density?: number;
  strum?: boolean;    // arpeggiate voicings (3+ note chords only)
  strumMs?: number;   // strum speed in ms (default 20)
}
```

### Drum Patterns

#### `generateDrumPattern(options): DrumHit[]`

```typescript
interface DrumHit {
  pitch: number;     // GM drum map pitch
  time: number;      // seconds
  duration: number;
  velocity: number;
}

interface DrumPatternOptions {
  style?: string;
  tempo?: number;
  measures?: number;
  timeSignature?: [number, number];
  humanize?: boolean;
  startTime?: number;
  swingAmount?: number;
  density?: number;
}
```

#### `GM_DRUMS`

General MIDI drum map constants:

```typescript
GM_DRUMS.KICK           // 36
GM_DRUMS.SNARE          // 38
GM_DRUMS.HI_HAT_CLOSED  // 42
GM_DRUMS.HI_HAT_OPEN   // 46
GM_DRUMS.RIDE           // 51
GM_DRUMS.CRASH          // 49
GM_DRUMS.SPLASH         // 55
GM_DRUMS.CHINA          // 52
GM_DRUMS.TOM_HIGH       // 50
GM_DRUMS.TOM_MID        // 47
GM_DRUMS.TOM_LOW        // 45
GM_DRUMS.TOM_FLOOR      // 43
```

### Ensemble

#### `generateEnsemble(options): EnsembleResult`

Generate a coordinated ensemble with built-in alignment and phrase awareness.

```typescript
interface EnsembleOptions {
  chordEvents: ChordEvent[];
  style: PracticeStyle;
  tempo: number;
  measures: number;
  timeSignature?: [number, number];
  sections?: SongSection[];
  density?: number;                // 0-100
  swingAmount?: number;            // 0-100
  strumMs?: number;                // 0-30
  seed?: number;                   // omit = random, provide = deterministic
  instrumentStyles?: InstrumentStyles;
  creativity?: number;             // 0-100
  conversation?: number;           // 0-100
  airGaps?: number;                // 0-100
  harmonicFreedom?: number;        // 0-100
  drumGranular?: DrumGranular;
  pianoGranular?: PianoGranular;
  bassGranular?: BassGranular;
}

interface EnsembleResult {
  drums: DrumHit[];
  bass: BassNote[];
  piano: CompNote[];
  seed: number;
  context: BandContext;
}
```

#### `generateEnsembleMeasures(options): Generator<MeasureSlice>`

Streaming version - yields one measure at a time.

```typescript
for (const slice of generateEnsembleMeasures(options)) {
  schedule(slice.drums, slice.bass, slice.piano);
}
```

#### `createPRNG(seed): RandomFn`

Seedable random function (xoshiro128**). Same seed = same output.

```typescript
const rng = createPRNG(42);
const drums = generateDrumPattern({ style: 'swing', measures: 4, random: rng });
```

### Complexity Mapping

#### `resolveDrumGranular(complexity?, overrides?): DrumGranular`
#### `resolvePianoGranular(complexity?, overrides?): PianoGranular`
#### `resolveBassGranular(complexity?, overrides?): BassGranular`

Map a general complexity slider (0-100) to per-control values. Manual overrides take precedence.

```typescript
const drum = resolveDrumGranular(70, { tomFrequency: 85 });
// drum.tomFrequency = 85  (overridden)
// drum.fillIntensity = 66 (derived from complexity 70)
// drum.rideWash = 66, drum.ghostDensity = 58, drum.cymbalColor = 48

const result = generateEnsemble({
  chordEvents, style: 'swing', tempo: 140, measures: 12,
  drumGranular: drum,
});
```

```typescript
interface DrumGranular {
  tomFrequency: number;       // 0-100
  fillIntensity: number;      // 0-100
  rideWash: number;           // 0-100
  ghostDensity: number;       // 0-100
  cymbalColor: number;        // 0-100
}

interface PianoGranular {
  voicingDensity: number;     // 0-100
  rhythmicActivity: number;   // 0-100
  registerRange: number;      // 0-100
  anticipation: number;       // 0-100
}

interface BassGranular {
  chromaticApproach: number;  // 0-100
  registerWidth: number;      // 0-100
  syncopation: number;        // 0-100
  beatVariety: number;        // 0-100
}
```

### Style Presets

#### `STYLE_PRESETS: StylePreset[]`

23 built-in presets across 6 categories:

| Category | Presets |
|----------|---------|
| Traditional | Classic Swing, Hard Bop Drive, West Coast Cool, Soft Ballad |
| Modern | Fusion Groove, ECM Space, Miles Modal, Contemporary Jazz |
| Latin | Bossa Nova, Latin Fire |
| Groove | Funk Pocket, Jazz Waltz, Blues Shuffle, Neo-Soul Pocket |
| Experimental | Holdsworth Fusion, Alfa Mist, Pat Metheny, Math Rock, IDM |
| Hybrid | Fusion/ECM, Modal Funk, Fusion/Neo-Soul |

```typescript
interface StylePreset {
  id: string;
  name: string;
  description: string;
  style: PracticeStyle;
  instrumentStyles?: { bass?: PracticeStyle; piano?: PracticeStyle; drums?: PracticeStyle };
  parameters: {
    swingAmount: number;
    density: number;
    strumMs?: number;
    creativity?: number;
    conversation?: number;
    airGaps?: number;
    harmonicFreedom?: number;
  };
  tempoRange: [number, number];
}
```

#### `autoDetectPreset(score): StylePreset`

Analyze a score and return the best-matching preset based on tempo, time signature, chord content, and style hints.

### Groove and Swing

| Function | Purpose |
|----------|---------|
| `getGrooveTemplate(style)` | Micro-timing template per instrument (GrooVAE-based) |
| `applyGroove(time, element, rng)` | Apply groove displacement to a note |
| `tempoSwingMultiplier(tempo)` | Slow tempos swing harder, fast tempos straighten |
| `instrumentSwingFactor(role)` | Ride swings hardest, bass walks straighter |
| `humanizeTime(time, amount?)` | Timing jitter |
| `humanizeVelocity(vel, amount?)` | Velocity variation |
| `irealStyleToPracticeStyle(str)` | Convert iReal Pro style strings to generator styles |

### Constants

```typescript
ALL_KEYS              // ['C', 'Db', 'D', ..., 'B']
FORM_LABELS           // { blues12: '12-Bar Blues', ... }
FORM_MEASURE_COUNTS   // { blues12: 12, rhythm32: 32, ... }
TIME_SIGNATURE_GROUPS // grouped time signatures
ALL_TIME_SIGNATURES   // all supported time signatures
```

---

## Styles

19 styles with distinct algorithms for bass, piano, and drums:

| Style | Feel | Bass | Piano | Drums |
|-------|------|------|-------|-------|
| `swing` | Triplet swing | Quarter-note walk | Rootless voicings, syncopated | Ride + hi-hat 2&4 |
| `bossa` | Straight 8ths | Root-5th pattern | Montuno rhythm | Cross-stick + syncopated kick |
| `latin` | Straight 8ths | Tumbao pattern | Montuno variations | Cascara + clave |
| `ballad` | Light swing | Half-note roots | Whole/half-note voicings | Brushes feel |
| `funk` | Straight 16ths | Syncopated octaves | Staccato stabs | 16th hi-hat + ghost notes |
| `fusion` | Light swing | Chromaticism | Extended voicings | Linear patterns |
| `ecm` | Minimal | Sparse, open | Wide intervals | Brushes, space |
| `hardBop` | Heavy swing | Strong walk | Punchy voicings | Driving ride |
| `coolJazz` | Light swing | Melodic walk | Light touch | Brushes |
| `modal` | Medium swing | Pedal points | Quartal voicings | Sparse |
| `jazzWaltz` | Waltz swing | 3/4 walk | Waltz comp | 3/4 ride pattern |
| `shuffleBlues` | Triplet shuffle | Shuffle bass | Blues comping | Shuffle groove |
| `neoSoul` | Broken feel | Erykah-style | Glasper voicings | J Dilla pocket |
| `contemporaryJazz` | Moderate | Nordic clarity | Avishai Cohen trio | Brushes/sticks mix |
| `holdsworth` | Straight | Melodic minor | Wide voicings | Wackerman: bell ride, cross-stick, ghost cascades |
| `alfaMist` | Broken beat | Lo-fi chromatic | Rhodes, chromatic | Broken beat |
| `metheny` | Light swing | Jaco melodic | Lydian shimmer | Bob Moses brushes |
| `mathRock` | Straight | Angular | Staccato | Odd groupings |
| `idm` | Generative | Glitch patterns | Algorithmic | Generative |

---

## Forms

17 chord progression forms:

| Form | Bars | Description |
|------|------|-------------|
| `blues12` | 12 | 12-bar blues |
| `minorBlues12` | 12 | Minor blues |
| `rhythm32` | 32 | Rhythm changes (I Got Rhythm) |
| `aaba32` | 32 | AABA standard form |
| `abac32` | 32 | ABAC form |
| `modal16` | 16 | Modal vamp |
| `turnaround8` | 8 | Short turnaround |
| `songForm24` | 24 | Song form |
| `rondo20` | 20 | Rondo form |
| `clave16` | 16 | Clave-based montuno |
| `secondLine16` | 16 | New Orleans second line |
| `coltraneMatrix16` | 16 | Coltrane changes matrix |
| `throughComposed12` | 12 | Through-composed |
| `pentatonic8` | 8 | Pentatonic vamp |
| `quartal16` | 16 | Quartal harmony |
| `fullSong` | varies | Multi-section arrangement |
| `free` | custom | Free form (set `measures` in config) |

---

## Community Presets

Contribute new style presets! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
cp preset-template.ts presets/your-preset.ts
npx tsx scripts/validate-preset.ts presets/your-preset.ts
```

Presets are validated against [`preset-schema.json`](preset-schema.json) and smoke-tested with the generator.

---

## Development

```bash
npm install                      # install dependencies
npm test                         # run tests (1251 tests)
npm run test:watch               # watch mode
npm run lint                     # lint
npm run typecheck                # type check
npm run build                    # build (ESM + CJS + .d.ts)
npm run validate-preset -- --all # validate community presets
```

## Architecture

```
src/
  index.ts              Public API exports
  types.ts              Type definitions
  ensemble.ts           Ensemble coordination (generateEnsemble)
  prng.ts               Seedable PRNG (xoshiro128**)
  jamGenerator.ts       Chord progression generation (17 forms)
  walkingBass.ts        Walking bass line generation
  pianoComping.ts       Piano voicing + comping patterns
  drumPatterns.ts       Drum pattern generation (19 styles)
  complexityMapping.ts  Complexity slider -> granular controls
  stylePresets.ts       Built-in style presets
  autoDetectPreset.ts   Score analysis + preset recommendation
  grooveTemplates.ts    Micro-timing templates (GrooVAE-based)
  swingUtils.ts         Tempo/instrument swing calculations
  styleMapping.ts       iReal Pro style string mapping
```

## License

[MIT](LICENSE)
