# Changelog

All notable changes to `@jmove/generator` will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

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
