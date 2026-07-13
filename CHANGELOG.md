# Changelog

All notable changes to `@jmove/generator` will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [1.2.1] - 2026-07-13

### Fixed

- **Quality-aware quartal voicings** — `buildQuartalVoicing` now accepts chord quality and selects diatonic 4th intervals per quality: maj7→Ionian `[4,9,14,19]`, m7→Dorian `[0,5,10,15]`, m(maj7)→melodic minor `[3,7,11,14]`, dom7→Mixolydian `[10,16,21,26]`, alt→Altered `[10,15,20,25]`, m7b5→Locrian `[3,8,13,18]`, 7b9→HW Dim `[10,13,16,19]`, 7#9→`[10,15,16,19]`. Previously stacked chromatic perfect 4ths `[0,5,10,15]` for all chords
- **Quality-aware open voicings** — `buildOpenVoicing` split into quality-specific branches: m(maj7) `[2,7,11]`, m7b5 `[3,6,10]`, alt `[4,10,13]`, 7b9 `[4,10,13]`, 7#9 `[4,10,15]`, 7#5 `[4,8,10]`, separate maj7 `[4,11,14]` vs dom7 `[4,10,14]`
- **Quality-aware 5ths voicings** — `buildOpen5thsVoicing` detects b5/aug/#5 for correct 5th interval and m(maj7) for correct 3rd and 7th
- **m(maj7) producing Bb instead of B** — Quartal, open, and open-5ths builders all routed m(maj7) through generic minor branches (interval 10 = Bb). Added dedicated m(maj7) branches with interval 11 (B natural) in all three builders
- **Dominant 7th producing major 7th** — Open voicing used interval 11 (B natural) for C7/C9. Split maj7 and dom7 branches
- **m7b5 producing natural 5th** — Quartal template had `[3,8,13,19]` where 19%12=7=G. Fixed to `[3,8,13,18]` (Gb)
- **Stale drum phraseIntent in batch mode** — Drums used `currentPhraseIntent` (set once at ensemble start). Added per-measure `lookupDrumIntent()` matching bass/piano lookup pattern
- **Ghost note threshold overflow** — High arc adjustment could push threshold past 40, stripping all ghost notes during drops. Capped at 40
- **Bass arc/conversation awareness without measureInfo** — `convMult` and `arcMult` were scoped inside `if (options.measureInfo)` block. Moved outside so standalone bass calls get arc-driven velocity shaping
- **Register drift boundary too tight** — ±12 semitone limit caused drift to stall after one octave. Expanded to ±24 with PIANO_LOW/PIANO_HIGH clamping
- **Dead `motifSeeds` code** — Removed unused `motifSeeds` from `PhraseMap` type and `computePhraseMap`. Field was computed but never read by any generator

## [1.2.0] - 2026-07-13

### Added

- **Phrase Intent Planner** (`ensemble.ts`) — `planMusicalIntents()` pre-plans each phrase before any instrument generates. Selects a `PhraseArc` (build / sustain / release / drop / climax) based on position, schedules dynamic drops, air gaps, conversation leader, harmonic probabilities, and motif lock durations
- **Musicality Parameters** — Four new optional `StyleParameters` fields:
  - `creativity` (0-100): Surprise frequency — dynamic drops, arc variety, grace notes
  - `conversation` (0-100): Inter-instrument responsiveness — leader/follower dynamics, velocity differentiation
  - `airGaps` (0-100): Intentional silence — piano rests, bass drops, drums-minimal measures
  - `harmonicFreedom` (0-100): Reharmonization — chord anticipation, chromatic passing chords
- **`PhraseIntent` and `PhraseArc` types** — New types exported from package. `PhraseIntent` carries: arc, dropMeasures, pianoRests, bassRests, drumsMinimal, anticipationChance, passingChordChance, motifLockBars, crescendo, conversationLeader
- **`PhraseMap.intents`** — Parallel array to boundaries, one `PhraseIntent` per phrase
- **`BandContext` extended** — New fields: `currentPhraseIntent`, `creativity`, `conversation`, `airGaps`, `harmonicFreedom`
- **Piano motif memory for all styles** — Rhythm patterns held for multiple bars (was alfaMist only). Lock duration tuned per style: Metheny=4 bars, Holdsworth=2, Fusion=2, default=3
- **Harmonic anticipation** — Piano plays next chord's voicing early on beat 3 (probability = harmonicFreedom × 0.35). `chromaticApproachRoot()` helper added
- **Passing chord insertion** — Chromatic approach voicings between chord changes (probability = harmonicFreedom × 0.25)
- **Grace notes for all styles** — Extended from alfaMist-only to creativity-dependent: Holdsworth=12%, Metheny=8%, Neo-Soul=15%
- **Drums minimal measures** — Phrase intent can thin drums to ride quarters + pedal hat on 2&4 only
- **Bass dynamic drops** — Sustained pedal root at velocity 50 during drop measures. Bass rests (complete silence) on high airGaps + creativity
- **Conversation-driven velocity** — Leader instrument: 1.1-1.2× velocity/density. Listener: 0.6-0.8× density, 0.75× velocity

### Changed

- **`EnsembleOptions`** accepts optional `creativity`, `conversation`, `airGaps`, `harmonicFreedom` parameters
- **All 23 style presets** updated with tuned musicality parameters:
  - Pat Metheny: creativity=40, conversation=60, airGaps=45, harmonicFreedom=45
  - Holdsworth: creativity=55, conversation=65, airGaps=25, harmonicFreedom=60
  - Alfa Mist: creativity=45, conversation=35, airGaps=20, harmonicFreedom=35
  - ECM: creativity=35, conversation=40, airGaps=45, harmonicFreedom=30
  - Funk: creativity=25, conversation=30, airGaps=5, harmonicFreedom=10
- **Piano comping** — Main generation loop rewritten for phrase intent awareness, conversation dynamics, and harmonic enrichment
- **Walking bass** — Phrase intent awareness: rest/drop/conversation support in main generation loop
- **Drum patterns** — Drums minimal support in per-measure loop

## [1.1.1] - 2026-07-12

### Fixed

- **Lint: unused `adjustPianoChords`** — dead code left after register adjustment moved into `generatePianoComping` via bandContext. Removed function and stale comment. Fixes CI eslint failure
- **npm audit: js-yaml, vite vulnerabilities** — updated devDependencies (remaining esbuild low-severity is Windows-only dev server issue, locked by tsup)

## [1.1.0] - 2026-07-12

### Added

- **Ensemble Coordination Layer** — new `generateEnsemble()` function produces drums, bass, and piano as a coordinated band rather than independent parts. Instruments inform each other: kick pattern shapes bass timing, bass register guides piano voicing placement, drum density modulates piano rhythmic activity
- **Seedable PRNG** — deterministic generation via `createPRNG(seed)`. Pass a seed to `generateEnsemble()` or individual generators (via `random` option) for reproducible output. Save `result.seed` to replay a "good take"
- **Streaming iterator** — `generateEnsembleMeasures()` yields measure-by-measure slices for incremental generation without full upfront computation
- **BandContext coordination** — shared context flows between instruments (kick times, drum density, bass register, hi-hat pattern, crash positions, phrase map)
- **Phrase-aware generation** — `PhraseMap` computes 2/4/8-bar phrase boundaries from song sections or chord repetition, enabling section-driven dynamics and fills at structural boundaries
- **Section energy scaling** — `SongSection.dynamicLevel` automatically modulates density (intro sparse, shout dense) across all instruments
- **Independent PRNG streams** — per-instrument streams (`deriveStream`) ensure changes to one generator's logic don't cascade to others
- **Built-in alignment** — ensemble function aligns kick↔bass (15ms snap) and bass↔piano (15ms snap with anticipation preservation) internally, eliminating need for post-hoc alignment in consumers
- **71 ensemble tests** — PRNG determinism/distribution/period, ensemble coordination, all 19 styles smoke test, streaming iterator, streaming fills, streaming phrase continuity, stochastic comping verification, dynamicLevel=0 audibility, MIDI velocity bounds, empty chords graceful handling, per-section energy in streaming, uncovered section default energy, alfaMist grace note non-negative time, performance benchmark (1081 total)

### Fixed

- **Generators deaf to bandContext** — all 3 generators accepted `bandContext` in options but never read it. Wired in energy/density/register reading for actual ensemble-aware dynamics
- **`getSectionEnergy` divided by 100** — `dynamicLevel` already 0-1 scale, dividing by 100 clamped all sections to minimum energy 0.3. Removed erroneous division
- **Batch path used measure-0 energy only** — single `getSectionEnergy(0, ...)` call applied first section's energy to entire piece. Fixed with weighted average across all sections
- **Streaming never updated drumDensity** — stayed 0 forever, piano never reacted to drum density. Added `totalDrumHits` running accumulator
- **Streaming never updated bassRegister** — stayed "mid" forever, piano never shifted voicings. Added per-measure avgPitch calculation
- **Drums `dynamicMultiplier` always position 0 in streaming** — loop var `m` reset to 0 each streaming call. Fixed to use `measureStart / measureDuration` for absolute measure index
- **Bass `dynamicMultiplier` always position 0 in streaming** — relative chord time collapsed to ~0 in streaming. Fixed to use absolute `chord.time / measureDuration`
- **Double velocity scaling** — `dynamicMultiplier` already multiplies by `section.dynamicLevel`; energy velocity multiplier in each generator applied a second scaling. Quiet sections crushed to ~33% velocity. Fixed: energy multiplier only applies when no sections exist (fallback path)
- **Streaming never generated drum fills** — `generateDrumPattern(measures: 1)` has `m=0` always, fill guard `m > 0` blocked all fills. Lookahead logic can't work in 1-measure calls. Fixed via `fillHint` option precomputed in ensemble.ts
- **Streaming lost drum phrase continuity** — each 1-measure call re-initialized `variationIdx`, `barsOnPattern`, `tendency`. Pattern changed every measure instead of holding 2-4 bars. Fixed via persistent `DrumState` across calls
- **Streaming stochastic comping never activated** — for 9 styles (swing, hardBop, coolJazz, modal, ballad, contemporaryJazz, ecm, metheny, holdsworth), `tendency` was `null` forever in streaming. Fixed: sentinel-based initialization lets first call bootstrap tendency via same rng path as batch
- **PRNG divergence in streaming** — `variationIdx` hardcoded to 0 instead of rng-picked on first call. Fixed: sentinel -1 triggers proper rng initialization
- **DrumState not exported** — `DrumState` interface missing from package `index.ts` exports. Added
- **Non-deterministic tendency shuffle** — `pickTendency` used `sort(() => rng() - 0.5)` which consumes variable rng calls depending on JS engine sort algorithm. Replaced with Fisher-Yates shuffle
- **`dynamicMultiplier` no floor on `dynamicLevel`** — `dynamicLevel = 0` produced velocity 0 (silent output) while `getSectionEnergy` clamped to 0.3. Added matching `Math.max(0.3, ...)` floor
- **Piano `measureDuration` division guard missing** — `chord.time / measureDuration` without `|| 1` fallback. Division by zero produced `Infinity`. Added guard
- **Bass velocity not clamped at 127** — `dynamicMultiplier * energyMult` could push velocity above MIDI max. Added `Math.min(127, ...)` upper clamp
- **Streaming O(n²) array growth** — `kickTimes` and `bassTimes` rebuilt via spread (`[...old, ...new]`) each measure. Switched to `push()` for O(n) total
- **Velocity not clamped when humanize=false** — `humanizeVelocity` in drums and piano returned raw velocity without MIDI [1-127] clamp when humanization disabled. Added clamp to both paths
- **Grace notes produce negative time** — `applyGraceNotes` in pianoComping placed notes 30ms before main note. When first chord starts at time=0, grace note time = -0.030s — invalid for MIDI scheduling/export. Fixed: skip grace note when main note time < 30ms

### Changed

- All generators (`generateDrumPattern`, `generateWalkingBass`, `generatePianoComping`) now accept optional `random?: () => number` parameter for seeded generation. Defaults to `Math.random` — fully backward compatible
- All generators accept optional `bandContext?: BandContext` for coordination when used within ensemble (ignored when standalone)
- `applyGroove()`, `humanizeTime()`, `humanizeVelocity()`, `applyMicroVariation()`, `interlockKickHihat()`, `getMeterPatternSet()` gain optional `random` parameter for deterministic humanization

## [1.0.5] - 2026-06-02

### Added

- **Story links in README** — 6 deep technical articles about the generator's algorithms, architecture, and music theory (backlinks to upfusion.net/stories)

## [1.0.4] - 2026-05-30

### Fixed

- **Density formula bug** — `baseRestChance` in piano comping used `/200` divisor instead of `/100`, compressing the 0-100 density range to half effect. Density 100 now correctly produces zero rests (max density)
- **Shell voicing comment** — clarified misleading comment on `toShellVoicing()` (logic was correct: picks 3rd + 7th guide tones from rootless voicings by taking sorted[0] + sorted[2])
- **Dead code** — removed unused `_BASS_MID` constant from walking bass module

### Added

- **Tempo validation** — all four public generators (`generateJamSession`, `generatePianoComping`, `generateWalkingBass`, `generateDrumPattern`) now throw `RangeError` for tempo <= 0 instead of producing `Infinity`/`NaN` downstream
- **15 new tests** — density full-range behavior, strum spreading, odd-meter piano comping (5/4, 7/4), and tempo validation across all generators (996 total)

## [1.0.3] - 2026-05-26

### Added

- **Voicing entries for `6/9`, `m6/9`, `7#9b5`, `7b9b5`** — piano voicings and bass chord tones for all 4 qualities that previously fell back to wrong chord types, causing semitone clashes
- **Quality coverage guard tests** — verify all 28 engine-valid chord qualities produce consonant output (required intervals present, forbidden intervals absent)

### Fixed

- **Backing track dissonance** — 5 chord qualities from transcriber pipeline had no direct voicing entries, falling back to wrong types: `6/9`→`7` (b7 vs 6th), `m6/9`→`m7` (b7 vs 6th), `7#9b5`→`7` (nat5 vs b5), `7b9b5`→`7` (nat5 vs b5). All now have correct dedicated voicings

## [1.0.2] - 2026-05-26

### Added

- **`strumMs` in `StyleParameters`** — new optional field (0–30ms) controls piano chord strum spread
- **Per-preset strum defaults** — all 22 presets carry explicit `strumMs` value (0 for no-strum styles, 8 for short-strum, 20 for standard)

### Changed

- **Simplified strum logic** in `pianoComping.ts` — generator always respects caller's `strumMs` (0=off, default 20ms). Style-aware strum control lives in preset defaults, not generator internals

## [1.0.1] - 2026-05-25

### Fixed

- **Package metadata** — corrected GitHub repository and homepage links for npm listing

## [1.0.0] - 2026-05-24

### Added

- **Jam Session Generator** — 17 chord progression forms (blues, rhythm changes, AABA, modal, Coltrane matrix, full song, and more)
- **Walking Bass** — rule-based walking lines with chromatic approaches, style-specific patterns (swing quarter walk, bossa root-5th, Latin tumbao)
- **Piano Comping** — Bill Evans rootless voicings (Type A/B) with voice leading and style-specific rhythmic templates
- **Drum Patterns** — 19 styles with humanization, ghost notes, fills, and variation
- **Groove Templates** — structured micro-timing offsets per instrument based on GrooVAE research
- **Style Presets** — 22 built-in presets across 5 categories (Traditional, Modern, Latin, Groove, Experimental) plus 3 hybrid presets with per-instrument style overrides
- **Auto-Detect** — score analysis to recommend best preset based on tempo, time signature, chord content, and iReal Pro style hints
- **Full Song Form** — multi-section arrangements (intro, head, solo, bridge, interlude, shout, outro) with dynamic shaping
- **Swing Utilities** — tempo-dependent swing ratio, per-instrument swing scaling, dynamic multipliers
- **iReal Pro Mapping** — convert iReal style strings to generator styles
- **Community Preset Infrastructure** — template, JSON schema, CLI validator, contributing guide
- **890 tests** covering all generators, presets, styles, forms, and keys
- **Dual ESM + CJS build** with full TypeScript declarations
- **Zero runtime dependencies**
