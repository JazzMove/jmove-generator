# Changelog

All notable changes to `@jmove/generator` will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

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
