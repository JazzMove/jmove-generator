# Changelog

All notable changes to `@jmove/generator` will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [1.3.3] - 2026-07-17

### Added

- **Dynamic groove templates** - groove bias/jitter now evolve with sectionEnergy and PhraseArc. `evolveElement()` tightens timing during builds/climax, loosens during release/drop. All three generators wire energy+arc to `applyGroove()` calls
- **Tempo rubato** - deterministic per-beat micro-tempo variation via `rubatoOffset()`. Ballad/ECM styles stretch beat 4 (+4ms) and compress beat 1 (-2ms). Arc-driven: builds push ahead (-1ms), releases lay back (+2ms), drops drift (+3ms). Zero PRNG cost - fully deterministic
- **2-bar Latin clave** - proper son clave alternation with `LATIN_CLAVE_3` (3-side: beats 1, 1.5, 3) and `LATIN_CLAVE_2` (2-side: beats 1, 2.5). `clavePhase` in DrumState persists across streaming calls. Clave removed from base pattern set to prevent random-side selection
- **Double/half-time feel** - `PhraseIntent.feel` field ("normal"/"doubleTime"/"halfTime") drives density and velocity changes across all generators. Drums: half-time drops offbeat hits (50%), velocity scaled 0.85x/1.1x. Bass: half-time thins to beat 1&3 notes with extended durations. Piano: rest chance scaled 0.5x (double-time) / 2.0x (half-time). Triggered by creativity+arc (climax->doubleTime, drop->halfTime)
- **Harmonic rhythm awareness** - chords-per-bar density modulates all generators. Bass: chromatic approach probability scaled down at fast harmonic rhythm (hrScale). Piano: forces shell voicings when harmonicRhythm >= 3. Drums: comping density reduced 20-40% at fast harmonic rhythm. `BandContext.harmonicRhythm` computed per-measure in both batch and streaming paths
- 72 new tests: groove template evolution (15), rubato offset (18), 2-bar clave (10), feel changes (10), harmonic rhythm (7), bass/piano/drum negative-time clamping, feel, and HR direct tests (12)

### Changed

- **Dynamic range widened** - `compressDynamicLevel()` output range expanded from [0.79, 1.0] (21% range) to [0.55, 1.0] (45% range). Quietest sections now genuinely quiet, loudest sections retain full volume
- `evolveElement` and `rubatoOffset` exported from package for direct use

### Fixed

- **Bass/piano negative time clamping** - groove evolution + rubato could push beat 0 notes before t=0 (e.g., hardBop push + build arc). Added `Math.max(0, ...)` clamp matching drum patterns
- **Bass error path state leak** - `_approachHistory` not restored when `generateWalkingBass` threw on invalid tempo, leaving stale history for subsequent calls
- **Drum ghost threshold negative** - without bandContext, high `ghostDensity` granular (100) could produce negative ghost threshold (-9), bypassing all ghost filtering. Added `Math.max(0, ...)` floor
- **Ensemble batch harmonicRhythm zero** - empty chord input produced harmonicRhythm=0 in batch path (streaming already clamped to 1). Added `Math.max(1, ...)` for consistency

## [1.3.2] - 2026-07-17

### Added

- **Piano register slider** (`pianoRegister` in PianoGranular) - new 0-100 control that shifts the piano voicing range center up/down by up to a perfect fifth (7 semitones). 0=low (C3-F5), 50=default (G3-C6), 100=high (D4-G6). Independent of complexity slider (always defaults to 50 unless manually overridden)
- **Bass register slider** (`bassRegister` in BassGranular) - new 0-100 control that shifts the bass range center up/down by up to a perfect fourth (5 semitones). 0=low (B0-D3), 50=default (E1-G3), 100=high (A1-C4). Composes with registerWidth (width narrows/widens, center shifts)
- 12 new tests: register complexity independence, override precedence, shift at 0/100, identity, range constraints for both piano and bass

## [1.3.1] - 2026-07-17

### Changed

- **Bass approach tones context-aware** - approach tone selection now tracks history across bars to prevent formulaic repetition (same direction 3+ times triggers 60% flip bias, consecutive half-steps boost diatonic/double-chromatic probability)
- **Arc-driven approach direction** - phrase arc (build/climax) biases ascending approaches, release/drop biases descending, creating musical contour across phrases
- **ii-V approach awareness** - when on ii chord approaching V, 35% chance of chromatic-from-below or b7 common-tone approach (strong voice leading into dominant)
- **HardBop approach variety** - was hardcoded `clamp(target-1)` (always chromatic from below), now uses full approach vocabulary 40% of the time while maintaining aggressive character
- **CoolJazz diatonic approaches** - was hardcoded chromatic, now uses style's diatonic-heavy vocabulary (55% chromatic, 35% diatonic, 10% double-chromatic)
- 7 new approach tone tests: direction variety, interval variety, hardBop/coolJazz variety, ii-V-I harmonic awareness, range safety

## [1.3.0] - 2026-07-17

### Added

- **Harmonic analysis engine** (`harmonicAnalysis.ts`) - analyzes chord progressions for key centers, Roman numeral degrees, harmonic function (tonic/predominant/dominant), ii-V-I patterns, cadences, secondary dominants, modulations, and per-chord tension values
- New types: `ChordAnalysis`, `HarmonicFunction`, `CadenceType`, `HarmonicAnalysisResult`
- `ChordEvent.analysis` - optional per-chord harmonic annotation populated by `analyzeHarmony()`
- `BandContext.harmonicAnalysis` - full analysis result available to all generators
- `analyzeHarmony()` exported from package for standalone use
- 61 new tests covering key detection, degree assignment, ii-V-I detection, secondary dominants, cadences, tension values, modulation detection, real jazz progressions, key transposition accuracy, and voicing deduplication across styles

### Fixed

- **Key transposition bug** - `detectTemplateKey()` used last-chord heuristic, causing wrong key for templates ending on non-tonic chords (e.g. "Blues in Bb" produced chords in Ab). Replaced with explicit `TEMPLATE_KEY` map covering all ~60 template variants
- **Duplicate MIDI notes in voicings** - cluster, inversion, open, and root-position voicing builders lacked pitch deduplication after octave clamping. Added `[...new Set()]` to 4 fallback paths
- **Harsh minor-2nd clusters in Alfa Mist** - minor cluster intervals `[2,3,5,10]` always placed 9th and b3rd one semitone apart. Changed to `[3,5,7,10]` (b3-4-5-b7)

### Changed

- **Ensemble** runs harmonic analysis once before generation; all three generators receive annotated chords with per-chord function, tension, and cadence data
- **Piano comping** uses `chord.analysis` for ii-V-I awareness instead of ad-hoc `isDominantQuality`/`isResolvingDominant`; altered voicings now trigger on secondary dominants and authentic cadence dominants, not just V-I root motion; anticipation probability modulated by per-chord tension (high-tension dominants anticipate more)
- **Walking bass** beat 1 selection is harmonic-aware: 85% root on tonic resolution (strong arrival), 55% root on dominant chords (more variety for tension); leading-tone approach on beat 4 of V-I cadences (45% probability) creates strongest resolution motion
- **Drum fills** placed before authentic cadence resolutions using harmonic analysis, not just form/phrase markers
- `planMusicalIntents` uses average phrase tension to modulate anticipation and passing chord probabilities per phrase

## [1.2.9] - 2026-07-16

### Added

- **ii-V-I voicing awareness** - dominant chords resolving to I (root up a P4) now offer altered voicing candidates (7alt, 7#9, 7b9) alongside standard voicings, selected by voice-leading distance. Zero PRNG cost - no random calls added
- **Tempo-dependent behavior** - bass enclosures decay linearly from 180-300 BPM, piano forces shell voicings above 220 BPM and increases rest chance above 200 BPM, piano rhythm density capped at fast tempos, drum fills reduced above 220 BPM, ghost notes stripped at fast tempos
- **Bossa bass variations** - four patterns (root-5th 50%, root-3rd 25%, chromatic approach 15%, inverted 10%) with voice-leading between bars, replacing static root-5th
- **Latin/tumbao variations** - four patterns (classic 40%, melodic 25%, approach 20%, anticipated 15%) with chord tone variety and voice-leading, replacing static root-5th-octave-5th

### Fixed

- **Voice leading distance** - greedy minimum-cost matching replaces sorted-index comparison. Old code compared Type A (3rd on bottom) to Type B (7th on bottom) by index, producing jumpy voicings. New NxN cost matrix correctly pairs closest voices
- **Beat 1 non-root tones** - bass now plays 5th (25%) and 3rd (10%) on beat 1, with voice-leading guard (falls back to root if distance > 7 from previous bar's approach note). First chord always root. Eliminates "MIDI bass" plodding feel
- **Diatonic approach tones** - `approachTone()` now finds actual nearest scale tone above/below target instead of hardcoded ±2 (whole step). Correctly handles half-step scale positions (e.g., E-F in C major)
- **Groove jitter distribution** - replaced uniform random jitter with triangular distribution (peaked at center). Most hits cluster near intended beat position, rare larger displacements. Matches real musician timing distributions (GrooVAE research)
- **Voicing range clamping** - `buildVoicing()` now clamps all pitches to PIANO_LOW-PIANO_HIGH range, preventing notes from escaping comping register (was possible with altered voicing templates)
- **Duplicate voicing pitches** - octave clamping in `buildVoicing()`, `buildQuartalVoicing()`, and `buildOpen5thsVoicing()` could collapse octave-apart intervals to same pitch. Added `[...new Set()]` dedup after clamping
- **RegisterShift out of range** - single ternary `±12` clamp insufficient for large register shifts; replaced with while-loops matching voicing builders. Fixes F#3 (54) escaping below PIANO_LOW (55)
- **Swing snare too weak** - expanded SWING_KICK_SNARE from 4 to 6 variations with accented snare hits (vel 75-80, Tony Williams/Philly Joe style) and cross-stick on beat 4. Reduced ghost closed hi-hat in swing patterns - HIHAT_A now pedal-only on 2&4, HIHAT_B pedal on all beats, new HIHAT_C with minimal ghost hits

### Tests

- **Comprehensive audit** - 25 new tests covering tempo boundary verification (drum fills/ghosts at fast tempos, bass enclosure probability at 300 BPM, piano density cap at 400 BPM, extreme tempo stability 40-400 BPM), groove template validation (triangular distribution shape and symmetry, style template ranges), ii-V-I across all 12 keys, exhaustive voicing range across 17 chord qualities x 12 roots, bossa/latin pattern distribution verification. Total: 1251 tests across 14 files

## [1.2.8] - 2026-07-16

### Fixed

- **Piano register too low** - PIANO_LOW was 48 (C3), producing muddy voicings in octave 3. Raised to 55 (G3), PIANO_HIGH from 76 (E5) to 84 (C6). buildVoicing() now prefers k=4 (octave 4) instead of lowest valid octave. Quartal, open-5ths, and root-position builders changed from `base = 48` to `base = 60` (C4). First chord of Ab blues now starts at C4 instead of C3
- **Broken voicing timing too wide** - broken voicings used swing "and" offset (~285ms), placing top pair audibly late. Tightened to 40-80ms gap (real pianist chord break, independent of tempo/swing)
- **Broken voicing beat detection fragile** - strong-beat check computed beat position from humanized time, which groove bias could shift past tolerance. Now uses raw beat offset stored at note creation (WeakMap), immune to humanization/groove shifts. Tolerance widened from 0.15 to 0.5 beats to catch swing-displaced "ands" that land near strong beats
- **Broken voicing + strum double displacement** - 2-note pairs from broken voicings were strummed again (+20ms each), creating 80-140ms total span. Strum now skips dyads (≤2 pitches) - only rolls 3+ note chords
- **Broken voicings on downbeats** - broken chord split was applied on beats 1 and 3, making downbeat attacks feel audibly late. Now suppressed within ±0.5 beats of strong beats - only applied to clearly weak positions
- **Strum velocity mechanical staircase** - fixed -3 per note decay made every chord sound identical. Randomized with proportional decay (total drop capped at 15% of base velocity)
- **Velocity floor stacking** - hard floor=48 caused multiple notes to cluster at identical velocity on weak beats. Floor lowered to 40, decay proportional to base velocity
- **Velocity contour too formulaic** - same sine-curve dynamic shape every measure created audible "energy waves". Added ±6 velocity jitter to break mechanical repetition
- **Strum used Math.random instead of seeded PRNG** - `_rng` was restored to `prevRng` before `strumSpread()` call, causing strum randomization to use `Math.random` instead of seeded stream. Broke determinism
- **buildStandardVoicing fallback at C3** - fallback triad still used `base = 48` after other builders moved to 60. Fixed to C4

## [1.2.7] - 2026-07-15

### Fixed

- **Dynamic level compression** - section dynamicLevel was applied as raw multiplier (intro at 0.55 × micro 0.60 = 0.33, near-silent). Compressed to `0.7 + 0.3 × dynamicLevel`, mapping [0.3, 1.0] → [0.79, 1.0]. Max velocity ratio across sections now < 1.5x
- **Section boundary crossfade** - instant velocity jumps at section transitions replaced with 2-measure linear blend from previous section's level to current. Short sections (< 4 measures) use proportionally shorter crossfade
- **Holdsworth drum balance** - diagnosed via MIDI analysis (toms in 46% of measures, ride+HH overlap in 78%, erratic velocity CV=0.33). Six targeted fixes:
  - Removed HI_HAT_OPEN from stochastic table (base pattern already provides hi-hat → no cymbal overlap)
  - Reduced maxHits from 8 to 6 (both 4/4 and 11/8) - prevents 19-hit measures
  - Removed holdsworth from MICRO_VARIATION_STYLES (stochastic table IS the ghost engine; micro-variation was double-dipping)
  - Reduced fill probabilities: section 0.75→0.55, phrase 0.55→0.30 (was highest of all styles)
  - Halved tom probabilities in stochastic table (8-10% → 4-5%)
  - Reduced ghost snare probabilities (12-14% → 8-10%)
  - Added empty hihat variant - ride-only rotation periods (~25% of time, no cymbal overlap)
  - Added sparse quarter-note ride variant for 4/4 (4 hits vs 8) and sparse group-start ride for 11/8 (7 hits vs 11)
  - Reordered ride variants: sparse at index 0 so low rideWash biases toward lighter patterns

### Added

- **Exported `compressDynamicLevel()`** - extracted and exported for testability and reuse
- **20 section-aware dynamic tests** - `compressDynamicLevel` (7: floor/max/intro/head/clamping/range/monotonicity) + section dynamics (13: compression, peak, ratio cap, crossfade, convergence, single section, 3-section fullSong, multi-style, floor/max levels, gap handling, short sections, realistic form templates). Total generator tests: 1221

## [1.2.6] - 2026-07-15

### Added

- **Per-instrument complexity controls** - 3 general sliders + 13 granular sub-controls:
  - **Drums** (5 controls): tomFrequency, fillIntensity, rideWash, ghostDensity, cymbalColor
  - **Piano** (4 controls): voicingDensity, rhythmicActivity, registerRange, anticipation
  - **Bass** (4 controls): chromaticApproach, registerWidth, syncopation, beatVariety
- **Complexity mapping engine** (`complexityMapping.ts`) - piecewise linear interpolation maps general complexity (0-100) to per-control values via min/default/max curves; manual overrides take precedence
- **Cymbal color variety** - SPLASH (GM 55) and CHINA (GM 52) added to `GM_DRUMS`; cymbalColor controls substitution probability on section boundaries
- **`GENERATOR_VERSION` export** - runtime version string for metadata stamping
- **45 granular tests** - 14 complexity mapping (defaults, extremes, overrides, monotonicity, clamping, integer output) + 7 drum behavioral (tomFrequency, fillIntensity, rideWash, ghostDensity, cymbalColor high/low, backward compat) + 6 piano behavioral (voicingDensity, rhythmicActivity, registerRange, anticipation, backward compat) + 6 bass behavioral (chromaticApproach, registerWidth, registerWidth extremes, syncopation, beatVariety, backward compat) + 5 ensemble threading (drum/piano/bass pass-through, all-three combined, streaming) + 7 edge cases (bounds at 0/100, partial/full overrides, GENERATOR_VERSION semver)

### Changed

- **Drum granular wiring** - `tomFrequency` scales stochastic tom probabilities and micro-variation; `fillIntensity` scales fill probabilities; `rideWash` biases ride variant selection and rotation; `ghostDensity` adjusts ghost threshold; `cymbalColor` triggers splash/china substitution
- **Piano granular wiring** - `voicingDensity` controls shell vs full voicing threshold; `rhythmicActivity` overrides density for rhythm pattern selection; `registerRange` scales max register drift magnitude; `anticipation` controls harmonic anticipation probability
- **Bass granular wiring** - `chromaticApproach` biases approach tone vocabulary weights; `registerWidth` narrows/widens playable MIDI range dynamically; `syncopation` scales 8th-note enclosure probability; `beatVariety` scales chord-tone variety on beat 2
- **Ensemble threading** - all granular params threaded through batch and streaming ensemble paths to per-instrument generators

## [1.2.5] - 2026-07-14

### Added

- **Tom integration in regular grooves** - toms now appear in comping, not just fills:
  - **holdsworth**: melodic tom ghosts (HIGH, MID, FLOOR) on 16th positions (8-10%), floor tom as kick substitute at 3.75
  - **holdsworth 11/8**: tom accents on 3+3+3+2 group boundaries (HIGH at 0.75, MID at 1.75/4, FLOOR at 3.25)
  - **metheny**: linear tom touches between kick/snare (HIGH at 0.5, MID at 1.5/3.25, HIGH accent at 2.75)
  - **hardBop**: floor tom bombs on beat 3.5 (12%), mid tom ghost at 1.5 and 3.67 (Blakey-inspired)
  - **contemporaryJazz**: conversational tom ghosts on offbeats (HIGH at 0.75/2.75, MID at 1.5/3.25)
  - **swing**: sparse floor tom ghost at 3.5 (7%) - tasteful color without overpowering
  - **coolJazz**: brushy floor tom swell at 2.5 (6%) - minimal, ghost-only
- **Fusion tom variations** - 2 new kick/snare patterns:
  - V7: Weckl linear tom-kick phrase (rack toms replace snare ghosts, HIGH→MID→LOW cascade)
  - V8: Chambers power groove (floor tom + kick unison on beats 0 and 2.5, tom cascade at 3.25-3.5)
- **NeoSoul ghost tom touches** - 2 new variations:
  - V6: muted tom replacing snare ghosts (Questlove feel, vel 30-35)
  - V7: floor tom pocket as rhythmic anchor with kick unison (vel 38-40)
- **Tom micro-variation** - 8% probability ghost tom (HIGH or MID) on random 16th offbeat, excluded from swing/coolJazz
- **11 new tests** - tom presence per style, velocity range, pitch variety, fusion/neoSoul toms, micro-variation, excluded styles

### Changed

- **maxHits raised** for tom accommodation: holdsworth 7→8, holdsworth 11/8 7→8, metheny 5→6, hardBop 6→7, contemporaryJazz 6→7, swing 4→5, coolJazz 3→4
- **AI drums default OFF** - pattern drums now default; Magenta neural drums available via checkbox

## [1.2.4] - 2026-07-14

### Added

- **Ride/HH rotation extended to 7 styles** - ride variant + hihat variant rotation (every 4-8 bars) ported from Holdsworth to metheny, fusion, neoSoul, contemporaryJazz, hardBop, coolJazz, swing:
  - **metheny**: 3 rides (flat/brush/Sanchez bell), 3 HH (pedal/open splash/sparse), fill prob 0.70/0.50
  - **fusion**: 4 timekeeping variants (3 HH patterns + ride bell) rotate as rideVariants. HH-B (Weckl broken), HH-C (Gadd 8th-note pocket)
  - **neoSoul**: 3 broken HH variants rotate (Dilla/Questlove/heavy-open). New HH-C with Questlove pocket feel
  - **contemporaryJazz**: 3 rides (8ths/Kendrick Scott bell/sparse quarters), 3 HH (pedal/open splash/sparse)
  - **hardBop**: 3 rides (standard/Blakey bell/crash), 2 HH (2&4/all-beats driving)
  - **coolJazz**: 2 rides (quarters/gentle 8ths), 2 HH (brush sweep/pedal only)
  - **swing**: 2 rides (standard/bell accent), 2 HH (2&4/Philly Joe all-beats). Ghost pulse integrated into HH variants
- **Stochastic table upgrades** - accent snares, cross-stick, wider velocity for 3 styles:
  - **metheny**: 12 positions (was 8), accent snare vel 85-88, cross-stick prob 0.12-0.15, minHits 2/maxHits 5 (was 1/3)
  - **contemporaryJazz**: 14 positions (was 11), accent snare vel 80-85, ghost cascades, maxHits 6 (was 5)
  - **hardBop**: accent snare at beats 1 and 2.5 (vel 85-88), ghost cascades, maxHits 6 (was 5)

## [1.2.3] - 2026-07-14

### Added

- **Chad Wackerman drums for Holdsworth preset** - Complete drum overhaul inspired by Wackerman's playing with Allan Holdsworth:
  - **Holdsworth-specific 11/8 patterns** - ride, kick/snare, hi-hat, and fills designed for 5.5-beat measures with 3+3+3+2 asymmetric grouping accents. Holdsworth in 11/8 no longer falls back to generic patterns
  - **Cross-stick variations** - 2 new kick/snare patterns (V5, V6) using cross-stick (MIDI 37) for quiet intensity and ghost cascade punctuation
  - **Ghost cascade density** - expanded stochastic table with 16th-note ghost positions (0.25, 0.75, 1.25, etc.) for cascading snare melody between accents
  - **Cross-stick in stochastic comping** - 3 cross-stick slots at beats 1, 2, 3 with 6-8% probability for conversational interjections
  - **Linear fills** - 4 new fills: linear snare-kick cascade (no simultaneous hits), dynamic arc (pp→ff ghost build), cross-stick→snare transition, metric modulation triplets
  - **Ride bell increased to 45%** - up from 30%, matching Wackerman's aggressive bell usage
  - **11/8 stochastic table** - dedicated `HOLDSWORTH_11_8_STOCHASTIC` with accents following 3+3+3+2 grouping boundaries
  - **11/8 fills** - 3 fill patterns adapted for odd-meter: ghost cascade into tom melody, linear cascade, triplet grouping metric modulation
  - **Fixed simultaneous hit in fill 2** - crash moved from beat 3.5 (simultaneous with snare) to 3.75 for linear drumming integrity
  - **Ride bell always present** - replaced all-or-nothing bell selection (45% chance of zero bell for entire piece) with 3 ride variants that ALL include bell accents: A (2 bell on downbeats), B (1 bell, conversational), C (4 bell, high energy). Ride variant rotates every 4-8 bars for timbral arc across sections
  - **11/8 ride bell always present** - 2 ride variants (A: 4 bell on group boundaries, B: 2 bell sparser), both with guaranteed bell
  - **Stochastic accent probabilities raised** - snare accent slots from 0.10-0.12 to 0.20-0.30 in both 4/4 and 11/8 tables. Kick secondary positions boosted. minHits raised to 2, maxHits to 6-7. Eliminates nearly-empty comping measures
  - **Hi-hat rotation** - 3 variants per meter (pedal+open, shifted emphasis, sparse) rotate alongside ride every 4-8 bars via `hihatVariants` on `StylePatternSet`. Breaks monotony of single static hi-hat pattern
  - **Fill probability boosted** - Holdsworth section fill 0.60→0.75, phrase fill 0.40→0.55. Wackerman fills frequently and dramatically
  - **Snare guarantee in stochastic comping** - if stochastic roll produces zero snare/cross-stick, inject ghost snare at random accent position. No drummer leaves snare completely silent in a non-minimal bar
  - **Ride pattern velocities raised** - off-beats 48-55→58-68, bells 72-80→85-92 across all Holdsworth ride variants (4/4 and 11/8). Ride drives the beat instead of whispering
  - **Accent snare velocities raised** - stochastic table accent snare from 75-82→88-95. After multiplier stacking and MIDI scaling, accents land at 60-75 instead of 45-55
  - **Cross-stick probability raised** - 0.08-0.12→0.18-0.22. Wackerman uses cross-stick as conversational interjection, should appear regularly
  - **`humanizeVelocity` non-ghost floor lowered** - 45→35. Old floor compressed quiet ride/kick into same velocity band as accents, collapsing dynamics

## [1.2.2] - 2026-07-13

### Fixed

- **Bass dissonance on strong beats** - Added `filterDissonant()` helper that removes tritone (6 semitones) and minor 2nd (1 semitone) intervals from candidate pitches on beats 2-3. Falls back to unfiltered for chords where those intervals are structural (e.g., diminished). Applied in `passingTone`, swing beat-2 fallback, and 11/8 generator
- **Bass pattern repetition** - Beat 2 now has 35% chance of picking second-nearest chord tone instead of always nearest. `passingTone` has 35% chance of picking from top-3 scale tones instead of always nearest midpoint. Swing beat-2 fallback randomly selects from 2 filtered scale degrees. Same chord progression now produces varied lines across takes
- **11/8 bass hardcoded to 4 notes at wrong positions** - `generate11_8Measure` rewritten with proper 2+2+3+2+2 eighth-note grouping: 5 notes at onsets 0, 2, 4, 7, 9 (eighths). Uses `getChordTones`/`getScaleTones` with dissonance filtering instead of hardcoded intervals (+5, +7). Durations reflect group lengths (short-short-long-short-short)
- **Holdsworth bass empty in odd meters** - Holdsworth patterns assumed 4 quarter beats, leaving 1.5+ beats silent in 11/8 (5.5 beats). Now detects actual measure length from `chord.duration` and scales note positions/durations proportionally when measure exceeds 4 beats

## [1.2.1] - 2026-07-13

### Fixed

- **Quality-aware quartal voicings** - `buildQuartalVoicing` now accepts chord quality and selects diatonic 4th intervals per quality: maj7→Ionian `[4,9,14,19]`, m7→Dorian `[0,5,10,15]`, m(maj7)→melodic minor `[3,7,11,14]`, dom7→Mixolydian `[10,16,21,26]`, alt→Altered `[10,15,20,25]`, m7b5→Locrian `[3,8,13,18]`, 7b9→HW Dim `[10,13,16,19]`, 7#9→`[10,15,16,19]`. Previously stacked chromatic perfect 4ths `[0,5,10,15]` for all chords
- **Quality-aware open voicings** - `buildOpenVoicing` split into quality-specific branches: m(maj7) `[2,7,11]`, m7b5 `[3,6,10]`, alt `[4,10,13]`, 7b9 `[4,10,13]`, 7#9 `[4,10,15]`, 7#5 `[4,8,10]`, separate maj7 `[4,11,14]` vs dom7 `[4,10,14]`
- **Quality-aware 5ths voicings** - `buildOpen5thsVoicing` detects b5/aug/#5 for correct 5th interval and m(maj7) for correct 3rd and 7th
- **m(maj7) producing Bb instead of B** - Quartal, open, and open-5ths builders all routed m(maj7) through generic minor branches (interval 10 = Bb). Added dedicated m(maj7) branches with interval 11 (B natural) in all three builders
- **Dominant 7th producing major 7th** - Open voicing used interval 11 (B natural) for C7/C9. Split maj7 and dom7 branches
- **m7b5 producing natural 5th** - Quartal template had `[3,8,13,19]` where 19%12=7=G. Fixed to `[3,8,13,18]` (Gb)
- **Stale drum phraseIntent in batch mode** - Drums used `currentPhraseIntent` (set once at ensemble start). Added per-measure `lookupDrumIntent()` matching bass/piano lookup pattern
- **Ghost note threshold overflow** - High arc adjustment could push threshold past 40, stripping all ghost notes during drops. Capped at 40
- **Bass arc/conversation awareness without measureInfo** - `convMult` and `arcMult` were scoped inside `if (options.measureInfo)` block. Moved outside so standalone bass calls get arc-driven velocity shaping
- **Register drift boundary too tight** - ±12 semitone limit caused drift to stall after one octave. Expanded to ±24 with PIANO_LOW/PIANO_HIGH clamping
- **Dead `motifSeeds` code** - Removed unused `motifSeeds` from `PhraseMap` type and `computePhraseMap`. Field was computed but never read by any generator

## [1.2.0] - 2026-07-13

### Added

- **Phrase Intent Planner** (`ensemble.ts`) - `planMusicalIntents()` pre-plans each phrase before any instrument generates. Selects a `PhraseArc` (build / sustain / release / drop / climax) based on position, schedules dynamic drops, air gaps, conversation leader, harmonic probabilities, and motif lock durations
- **Musicality Parameters** - Four new optional `StyleParameters` fields:
  - `creativity` (0-100): Surprise frequency - dynamic drops, arc variety, grace notes
  - `conversation` (0-100): Inter-instrument responsiveness - leader/follower dynamics, velocity differentiation
  - `airGaps` (0-100): Intentional silence - piano rests, bass drops, drums-minimal measures
  - `harmonicFreedom` (0-100): Reharmonization - chord anticipation, chromatic passing chords
- **`PhraseIntent` and `PhraseArc` types** - New types exported from package. `PhraseIntent` carries: arc, dropMeasures, pianoRests, bassRests, drumsMinimal, anticipationChance, passingChordChance, motifLockBars, crescendo, conversationLeader
- **`PhraseMap.intents`** - Parallel array to boundaries, one `PhraseIntent` per phrase
- **`BandContext` extended** - New fields: `currentPhraseIntent`, `creativity`, `conversation`, `airGaps`, `harmonicFreedom`
- **Piano motif memory for all styles** - Rhythm patterns held for multiple bars (was alfaMist only). Lock duration tuned per style: Metheny=4 bars, Holdsworth=2, Fusion=2, default=3
- **Harmonic anticipation** - Piano plays next chord's voicing early on beat 3 (probability = harmonicFreedom × 0.35). `chromaticApproachRoot()` helper added
- **Passing chord insertion** - Chromatic approach voicings between chord changes (probability = harmonicFreedom × 0.25)
- **Grace notes for all styles** - Extended from alfaMist-only to creativity-dependent: Holdsworth=12%, Metheny=8%, Neo-Soul=15%
- **Drums minimal measures** - Phrase intent can thin drums to ride quarters + pedal hat on 2&4 only
- **Bass dynamic drops** - Sustained pedal root at velocity 50 during drop measures. Bass rests (complete silence) on high airGaps + creativity
- **Conversation-driven velocity** - Leader instrument: 1.1-1.2× velocity/density. Listener: 0.6-0.8× density, 0.75× velocity

### Changed

- **`EnsembleOptions`** accepts optional `creativity`, `conversation`, `airGaps`, `harmonicFreedom` parameters
- **All 23 style presets** updated with tuned musicality parameters:
  - Pat Metheny: creativity=40, conversation=60, airGaps=45, harmonicFreedom=45
  - Holdsworth: creativity=55, conversation=65, airGaps=25, harmonicFreedom=60
  - Alfa Mist: creativity=45, conversation=35, airGaps=20, harmonicFreedom=35
  - ECM: creativity=35, conversation=40, airGaps=45, harmonicFreedom=30
  - Funk: creativity=25, conversation=30, airGaps=5, harmonicFreedom=10
- **Piano comping** - Main generation loop rewritten for phrase intent awareness, conversation dynamics, and harmonic enrichment
- **Walking bass** - Phrase intent awareness: rest/drop/conversation support in main generation loop
- **Drum patterns** - Drums minimal support in per-measure loop

## [1.1.1] - 2026-07-12

### Fixed

- **Lint: unused `adjustPianoChords`** - dead code left after register adjustment moved into `generatePianoComping` via bandContext. Removed function and stale comment. Fixes CI eslint failure
- **npm audit: js-yaml, vite vulnerabilities** - updated devDependencies (remaining esbuild low-severity is Windows-only dev server issue, locked by tsup)

## [1.1.0] - 2026-07-12

### Added

- **Ensemble Coordination Layer** - new `generateEnsemble()` function produces drums, bass, and piano as a coordinated band rather than independent parts. Instruments inform each other: kick pattern shapes bass timing, bass register guides piano voicing placement, drum density modulates piano rhythmic activity
- **Seedable PRNG** - deterministic generation via `createPRNG(seed)`. Pass a seed to `generateEnsemble()` or individual generators (via `random` option) for reproducible output. Save `result.seed` to replay a "good take"
- **Streaming iterator** - `generateEnsembleMeasures()` yields measure-by-measure slices for incremental generation without full upfront computation
- **BandContext coordination** - shared context flows between instruments (kick times, drum density, bass register, hi-hat pattern, crash positions, phrase map)
- **Phrase-aware generation** - `PhraseMap` computes 2/4/8-bar phrase boundaries from song sections or chord repetition, enabling section-driven dynamics and fills at structural boundaries
- **Section energy scaling** - `SongSection.dynamicLevel` automatically modulates density (intro sparse, shout dense) across all instruments
- **Independent PRNG streams** - per-instrument streams (`deriveStream`) ensure changes to one generator's logic don't cascade to others
- **Built-in alignment** - ensemble function aligns kick↔bass (15ms snap) and bass↔piano (15ms snap with anticipation preservation) internally, eliminating need for post-hoc alignment in consumers
- **71 ensemble tests** - PRNG determinism/distribution/period, ensemble coordination, all 19 styles smoke test, streaming iterator, streaming fills, streaming phrase continuity, stochastic comping verification, dynamicLevel=0 audibility, MIDI velocity bounds, empty chords graceful handling, per-section energy in streaming, uncovered section default energy, alfaMist grace note non-negative time, performance benchmark (1081 total)

### Fixed

- **Generators deaf to bandContext** - all 3 generators accepted `bandContext` in options but never read it. Wired in energy/density/register reading for actual ensemble-aware dynamics
- **`getSectionEnergy` divided by 100** - `dynamicLevel` already 0-1 scale, dividing by 100 clamped all sections to minimum energy 0.3. Removed erroneous division
- **Batch path used measure-0 energy only** - single `getSectionEnergy(0, ...)` call applied first section's energy to entire piece. Fixed with weighted average across all sections
- **Streaming never updated drumDensity** - stayed 0 forever, piano never reacted to drum density. Added `totalDrumHits` running accumulator
- **Streaming never updated bassRegister** - stayed "mid" forever, piano never shifted voicings. Added per-measure avgPitch calculation
- **Drums `dynamicMultiplier` always position 0 in streaming** - loop var `m` reset to 0 each streaming call. Fixed to use `measureStart / measureDuration` for absolute measure index
- **Bass `dynamicMultiplier` always position 0 in streaming** - relative chord time collapsed to ~0 in streaming. Fixed to use absolute `chord.time / measureDuration`
- **Double velocity scaling** - `dynamicMultiplier` already multiplies by `section.dynamicLevel`; energy velocity multiplier in each generator applied a second scaling. Quiet sections crushed to ~33% velocity. Fixed: energy multiplier only applies when no sections exist (fallback path)
- **Streaming never generated drum fills** - `generateDrumPattern(measures: 1)` has `m=0` always, fill guard `m > 0` blocked all fills. Lookahead logic can't work in 1-measure calls. Fixed via `fillHint` option precomputed in ensemble.ts
- **Streaming lost drum phrase continuity** - each 1-measure call re-initialized `variationIdx`, `barsOnPattern`, `tendency`. Pattern changed every measure instead of holding 2-4 bars. Fixed via persistent `DrumState` across calls
- **Streaming stochastic comping never activated** - for 9 styles (swing, hardBop, coolJazz, modal, ballad, contemporaryJazz, ecm, metheny, holdsworth), `tendency` was `null` forever in streaming. Fixed: sentinel-based initialization lets first call bootstrap tendency via same rng path as batch
- **PRNG divergence in streaming** - `variationIdx` hardcoded to 0 instead of rng-picked on first call. Fixed: sentinel -1 triggers proper rng initialization
- **DrumState not exported** - `DrumState` interface missing from package `index.ts` exports. Added
- **Non-deterministic tendency shuffle** - `pickTendency` used `sort(() => rng() - 0.5)` which consumes variable rng calls depending on JS engine sort algorithm. Replaced with Fisher-Yates shuffle
- **`dynamicMultiplier` no floor on `dynamicLevel`** - `dynamicLevel = 0` produced velocity 0 (silent output) while `getSectionEnergy` clamped to 0.3. Added matching `Math.max(0.3, ...)` floor
- **Piano `measureDuration` division guard missing** - `chord.time / measureDuration` without `|| 1` fallback. Division by zero produced `Infinity`. Added guard
- **Bass velocity not clamped at 127** - `dynamicMultiplier * energyMult` could push velocity above MIDI max. Added `Math.min(127, ...)` upper clamp
- **Streaming O(n²) array growth** - `kickTimes` and `bassTimes` rebuilt via spread (`[...old, ...new]`) each measure. Switched to `push()` for O(n) total
- **Velocity not clamped when humanize=false** - `humanizeVelocity` in drums and piano returned raw velocity without MIDI [1-127] clamp when humanization disabled. Added clamp to both paths
- **Grace notes produce negative time** - `applyGraceNotes` in pianoComping placed notes 30ms before main note. When first chord starts at time=0, grace note time = -0.030s - invalid for MIDI scheduling/export. Fixed: skip grace note when main note time < 30ms

### Changed

- All generators (`generateDrumPattern`, `generateWalkingBass`, `generatePianoComping`) now accept optional `random?: () => number` parameter for seeded generation. Defaults to `Math.random` - fully backward compatible
- All generators accept optional `bandContext?: BandContext` for coordination when used within ensemble (ignored when standalone)
- `applyGroove()`, `humanizeTime()`, `humanizeVelocity()`, `applyMicroVariation()`, `interlockKickHihat()`, `getMeterPatternSet()` gain optional `random` parameter for deterministic humanization

## [1.0.5] - 2026-06-02

### Added

- **Story links in README** - 6 deep technical articles about the generator's algorithms, architecture, and music theory (backlinks to upfusion.net/stories)

## [1.0.4] - 2026-05-30

### Fixed

- **Density formula bug** - `baseRestChance` in piano comping used `/200` divisor instead of `/100`, compressing the 0-100 density range to half effect. Density 100 now correctly produces zero rests (max density)
- **Shell voicing comment** - clarified misleading comment on `toShellVoicing()` (logic was correct: picks 3rd + 7th guide tones from rootless voicings by taking sorted[0] + sorted[2])
- **Dead code** - removed unused `_BASS_MID` constant from walking bass module

### Added

- **Tempo validation** - all four public generators (`generateJamSession`, `generatePianoComping`, `generateWalkingBass`, `generateDrumPattern`) now throw `RangeError` for tempo <= 0 instead of producing `Infinity`/`NaN` downstream
- **15 new tests** - density full-range behavior, strum spreading, odd-meter piano comping (5/4, 7/4), and tempo validation across all generators (996 total)

## [1.0.3] - 2026-05-26

### Added

- **Voicing entries for `6/9`, `m6/9`, `7#9b5`, `7b9b5`** - piano voicings and bass chord tones for all 4 qualities that previously fell back to wrong chord types, causing semitone clashes
- **Quality coverage guard tests** - verify all 28 engine-valid chord qualities produce consonant output (required intervals present, forbidden intervals absent)

### Fixed

- **Backing track dissonance** - 5 chord qualities from transcriber pipeline had no direct voicing entries, falling back to wrong types: `6/9`→`7` (b7 vs 6th), `m6/9`→`m7` (b7 vs 6th), `7#9b5`→`7` (nat5 vs b5), `7b9b5`→`7` (nat5 vs b5). All now have correct dedicated voicings

## [1.0.2] - 2026-05-26

### Added

- **`strumMs` in `StyleParameters`** - new optional field (0–30ms) controls piano chord strum spread
- **Per-preset strum defaults** - all 22 presets carry explicit `strumMs` value (0 for no-strum styles, 8 for short-strum, 20 for standard)

### Changed

- **Simplified strum logic** in `pianoComping.ts` - generator always respects caller's `strumMs` (0=off, default 20ms). Style-aware strum control lives in preset defaults, not generator internals

## [1.0.1] - 2026-05-25

### Fixed

- **Package metadata** - corrected GitHub repository and homepage links for npm listing

## [1.0.0] - 2026-05-24

### Added

- **Jam Session Generator** - 17 chord progression forms (blues, rhythm changes, AABA, modal, Coltrane matrix, full song, and more)
- **Walking Bass** - rule-based walking lines with chromatic approaches, style-specific patterns (swing quarter walk, bossa root-5th, Latin tumbao)
- **Piano Comping** - Bill Evans rootless voicings (Type A/B) with voice leading and style-specific rhythmic templates
- **Drum Patterns** - 19 styles with humanization, ghost notes, fills, and variation
- **Groove Templates** - structured micro-timing offsets per instrument based on GrooVAE research
- **Style Presets** - 22 built-in presets across 5 categories (Traditional, Modern, Latin, Groove, Experimental) plus 3 hybrid presets with per-instrument style overrides
- **Auto-Detect** - score analysis to recommend best preset based on tempo, time signature, chord content, and iReal Pro style hints
- **Full Song Form** - multi-section arrangements (intro, head, solo, bridge, interlude, shout, outro) with dynamic shaping
- **Swing Utilities** - tempo-dependent swing ratio, per-instrument swing scaling, dynamic multipliers
- **iReal Pro Mapping** - convert iReal style strings to generator styles
- **Community Preset Infrastructure** - template, JSON schema, CLI validator, contributing guide
- **890 tests** covering all generators, presets, styles, forms, and keys
- **Dual ESM + CJS build** with full TypeScript declarations
- **Zero runtime dependencies**
