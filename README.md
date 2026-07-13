# @jmove/generator

Jazz backing track generator — walking bass lines, piano comping, drum patterns, and full jam sessions from chord progressions.

Zero dependencies. TypeScript. ESM + CJS.

[![CI](https://github.com/JazzMove/jmove-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/JazzMove/jmove-generator/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@jmove/generator)](https://www.npmjs.com/package/@jmove/generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Demo

Try the live app at **[jmove.it.com](https://jmove.it.com)** — the Practice Player uses this package to generate all backing tracks in real time.

### Stories

Deep technical articles about how JMove and the generator work:

- [Inside @jmove/generator: Every Algorithm Explained](https://upfusion.net/stories/open-source-jazz-generator) — Evans voicings, stochastic drum comping, groove templates, 996 tests
- [Building JMove: Architecture of a Jazz Practice Tool](https://upfusion.net/stories/building-jmove) — three engines, two languages, 45 chord qualities, 26 style presets
- [Walking Bass from First Principles](https://upfusion.net/stories/walking-bass-from-first-principles) — contour-first planning, approach weights, two-bar phrasing arcs
- [1,511 Jazz Standards in Your Browser](https://upfusion.net/stories/jazz-standards-browser) — iReal Pro URI decoding, 43-rule quality map, 748KB offline database
- [Five Ways to See a Chord](https://upfusion.net/stories/five-notation-views) — Zustand sync, DFS fretboard search, Viterbi voice-leading optimizer
- [14 Ways to Reharmonize a Jazz Standard](https://upfusion.net/stories/14-ways-to-reharmonize) — tritone subs to Coltrane changes, every technique with history and theory

## Features

- **Musicality Engine** — phrase-level intelligence: dynamic drops, air gaps, harmonic anticipation, passing chords, conversation dynamics, motif memory. Four parameters (creativity, conversation, airGaps, harmonicFreedom) control how musical and surprising the output sounds
- **Ensemble Coordination** — `generateEnsemble()` produces drums, bass, and piano as a coordinated band. Kick patterns shape bass timing, bass register guides piano voicings, drum density modulates comping activity
- **Seedable & Reproducible** — deterministic PRNG (xoshiro128**) with per-instrument streams. Save a seed, replay the exact same take
- **Jam Session Generator** — random chord progressions across 17 jazz forms (blues, rhythm changes, AABA, modal, Coltrane matrix, and more)
- **Walking Bass** — rule-based walking lines with chromatic approaches, 19 styles (swing, bossa, Latin tumbao, neo-soul, math rock, IDM)
- **Piano Comping** — Bill Evans rootless voicings (Type A/B), quartal, shell, cluster — voice-led with rhythmic templates per style
- **Drum Patterns** — 19 styles with humanization, ghost notes, groove templates based on GrooVAE research
- **23 Style Presets** — Classic Swing to IDM, with per-instrument style overrides and tuned musicality parameters
- **Auto-Detect** — analyze a score to recommend the best preset
- **Full Song Form** — multi-section arrangements with dynamic shaping
- **Phrase-Aware Generation** — 2/4/8-bar phrase boundaries with section-driven dynamics (intro sparse, shout dense)
- **Streaming Iterator** — `generateEnsembleMeasures()` yields measure-by-measure for incremental generation
- **Groove Templates** — structured micro-timing offsets per instrument, not random jitter

## Install

```bash
npm install @jmove/generator
```

Requires Node.js 20+.

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

// Generate coordinated ensemble (drums → bass → piano)
const chords = scoreChordsToEvents(session.score.measures);
const result = generateEnsemble({
  chordEvents: chords,
  style: 'swing',
  tempo: 140,
  measures: 12,
  seed: 42,  // deterministic — omit for random
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

## API Reference

### Jam Session

#### `generateJamSession(config: JamConfig): JamResult`

Generate a complete chord progression with score.

```typescript
interface JamConfig {
  key: JamKey;                    // 'C' | 'Db' | 'D' | ... | 'B'
  form: JamForm;                  // 'blues12' | 'rhythm32' | 'aaba32' | ...
  style: PracticeStyle;           // 'swing' | 'bossa' | 'funk' | ...
  tempo: number;                  // BPM (must be > 0)
  timeSignature: [number, number]; // e.g. [4, 4], [3, 4], [7, 8]
  measures?: number;              // override measure count (for 'free' form)
}

interface JamResult {
  score: QuantizedScore;          // full score with measures and chords
  config: JamConfig;
  progressionLabel: string;       // e.g. "Bb7 | Eb7 | Bb7 | ..."
  sections?: SongSection[];       // for 'fullSong' form
}
```

#### `transposeProgression(chords, semitones): string[][]`

Transpose a chord progression by semitones.

#### `getFormsForStyle(style): JamForm[]`

Get available forms for a style (e.g. waltz styles get waltz-compatible forms).

#### `enrichQuality(quality): string`

Normalize chord quality strings (e.g. `'-'` → `'m'`, `'^7'` → `'maj7'`).

### Walking Bass

#### `generateWalkingBass(chords: ChordEvent[], options?: WalkingBassOptions): BassNote[]`

Generate a walking bass line from chord events.

```typescript
interface BassNote {
  pitch: number;     // MIDI pitch (28-55, E1-G3)
  time: number;      // seconds
  duration: number;  // seconds
  velocity: number;  // 0-127
}

interface WalkingBassOptions {
  style?: string;    // affects pattern: swing=quarter walk, bossa=root-5th, latin=tumbao
  tempo?: number;    // affects swing ratio and dynamics
  swingAmount?: number;
  density?: number;
  humanize?: boolean;
}
```

#### `scoreChordsToEvents(measures): ChordEvent[]`

Extract chord events with timing from score measures.

### Piano Comping

#### `generatePianoComping(chords: ChordEvent[], options?: PianoCompingOptions): CompNote[]`

Generate piano voicings with rhythmic comping patterns.

```typescript
interface CompNote {
  pitches: number[];  // MIDI pitches (chord voicing)
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
  strum?: boolean;    // arpeggiate voicings
  strumMs?: number;   // strum speed in ms
}
```

### Drum Patterns

#### `generateDrumPattern(options: DrumPatternOptions): DrumHit[]`

Generate a drum pattern for the specified style and duration.

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
GM_DRUMS.KICK          // 36
GM_DRUMS.SNARE         // 38
GM_DRUMS.HI_HAT_CLOSED // 42
GM_DRUMS.HI_HAT_OPEN  // 46
GM_DRUMS.RIDE          // 51
GM_DRUMS.CRASH         // 49
// ... and more
```

### Ensemble

#### `generateEnsemble(options: EnsembleOptions): EnsembleResult`

Generate a coordinated ensemble with built-in alignment and phrase awareness.

```typescript
interface EnsembleOptions {
  chordEvents: ChordEvent[];
  style: PracticeStyle;
  tempo: number;
  measures: number;
  timeSignature?: [number, number];
  sections?: SongSection[];        // section-driven dynamics
  density?: number;                // 0-100
  swingAmount?: number;            // 0-100
  strumMs?: number;                // 0-30
  seed?: number;                   // omit = random, provide = deterministic
  instrumentStyles?: InstrumentStyles;
  creativity?: number;             // 0-100: surprise frequency
  conversation?: number;           // 0-100: inter-instrument responsiveness
  airGaps?: number;                // 0-100: intentional silence
  harmonicFreedom?: number;        // 0-100: reharmonization intensity
}

interface EnsembleResult {
  drums: DrumHit[];
  bass: BassNote[];
  piano: CompNote[];
  seed: number;                    // always returned for replay
  context: BandContext;            // coordination state (kick times, bass register, etc.)
}
```

#### `generateEnsembleMeasures(options: EnsembleOptions): Generator<MeasureSlice>`

Streaming version — yields one measure at a time for incremental generation.

```typescript
for (const slice of generateEnsembleMeasures(options)) {
  schedule(slice.drums, slice.bass, slice.piano);
}
```

#### `createPRNG(seed: number): RandomFn`

Create a seedable random function (xoshiro128**). Pass to any generator via the `random` option for deterministic output.

```typescript
import { createPRNG, generateDrumPattern } from '@jmove/generator';

const rng = createPRNG(42);
const drums = generateDrumPattern({ style: 'swing', measures: 4, random: rng });
// Same seed → same drums every time
```

### Style Presets

#### `STYLE_PRESETS: StylePreset[]`

23 built-in presets:

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
  instrumentStyles?: {     // per-instrument overrides
    bass?: PracticeStyle;
    piano?: PracticeStyle;
    drums?: PracticeStyle;
  };
  parameters: {
    swingAmount: number;   // 0-100
    density: number;       // 0-100
    strumMs?: number;      // 0-30: piano chord strum spread in ms
    creativity?: number;   // 0-100: surprise frequency
    conversation?: number; // 0-100: inter-instrument responsiveness
    airGaps?: number;      // 0-100: intentional silence
    harmonicFreedom?: number; // 0-100: reharmonization intensity
  };
  tempoRange: [number, number];
}
```

#### `STYLE_LABELS: Record<PracticeStyle, string>`

Display names for all 19 practice styles.

#### `STYLE_CATEGORIES: Record<string, PracticeStyle[]>`

Styles grouped by category (Traditional, Modern, Latin, Groove, Experimental).

#### `autoDetectPreset(score: QuantizedScore): StylePreset`

Analyze a score and return the best-matching preset based on tempo, time signature, chord content, and style hints.

### Groove & Swing Utilities

#### `getGrooveTemplate(style): GrooveTemplate`

Get micro-timing template for a style. Templates define per-instrument bias and jitter values based on GrooVAE research.

#### `applyGroove(time, element, template): number`

Apply groove displacement to a note time.

#### `tempoSwingMultiplier(tempo): number`

Tempo-dependent swing scaling. Slow tempos swing harder; fast tempos straighten out.

#### `instrumentSwingFactor(role): number`

Per-instrument swing scaling. Ride swings hardest, bass walks straighter, piano between.

#### `humanizeTime(time, amount?): number`

Add timing jitter to a note.

#### `humanizeVelocity(velocity, amount?): number`

Add velocity variation to a note.

### Style Mapping

#### `irealStyleToPracticeStyle(irealStyle): PracticeStyle`

Convert iReal Pro style strings (e.g. `"Medium Swing"`, `"Bossa Nova"`) to generator styles.

### Constants

```typescript
ALL_KEYS              // ['C', 'Db', 'D', ..., 'B']
FORM_LABELS           // { blues12: '12-Bar Blues', ... }
FORM_MEASURE_COUNTS   // { blues12: 12, rhythm32: 32, ... }
TIME_SIGNATURE_GROUPS // grouped time signatures
ALL_TIME_SIGNATURES   // all supported time signatures
```

## Styles

19 styles with distinct algorithms for bass, piano, and drums:

| Style | Swing | Bass | Piano | Drums |
|-------|-------|------|-------|-------|
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
| `holdsworth` | Straight | Melodic minor | Wide voicings | Linear fusion |
| `alfaMist` | Broken beat | Lo-fi chromatic | Rhodes, chromatic | Broken beat |
| `metheny` | Light swing | Jaco melodic | Lydian shimmer | Bob Moses brushes |
| `mathRock` | Straight | Angular | Staccato | Odd groupings |
| `idm` | Generative | Glitch patterns | Algorithmic | Generative |

## Forms

17 chord progression forms:

| Form | Measures | Description |
|------|----------|-------------|
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

## Community Presets

Contribute new style presets! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
# Copy the template
cp preset-template.ts presets/your-preset.ts

# Edit and validate
npx tsx scripts/validate-preset.ts presets/your-preset.ts

# Submit a PR
```

Presets are validated against [`preset-schema.json`](preset-schema.json) and smoke-tested with the generator.

## Development

```bash
# Install
npm install

# Run tests (1081 tests)
npm test

# Watch mode
npm run test:watch

# Lint + type check
npm run lint
npm run typecheck

# Build (ESM + CJS + .d.ts)
npm run build

# Validate community presets
npm run validate-preset -- --all
```

## Architecture

```
src/
  index.ts              Barrel exports (public API)
  types.ts              All public type definitions
  ensemble.ts           Ensemble coordination layer (generateEnsemble)
  prng.ts               Seedable PRNG (xoshiro128**)
  jamGenerator.ts       Chord progression generation (17 forms)
  walkingBass.ts        Walking bass line generation
  pianoComping.ts       Piano voicing + comping patterns
  drumPatterns.ts       Drum pattern generation (19 styles)
  stylePresets.ts       Built-in style presets
  autoDetectPreset.ts   Score analysis + preset recommendation
  grooveTemplates.ts    Micro-timing templates (GrooVAE-based)
  swingUtils.ts         Tempo/instrument swing calculations
  styleMapping.ts       iReal Pro style string mapping
```

## License

[MIT](LICENSE)
