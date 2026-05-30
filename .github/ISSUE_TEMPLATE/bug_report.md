---
name: Bug Report
about: Report incorrect output, crashes, or unexpected behavior
title: "[Bug] "
labels: bug
assignees: ''
---

## Description

A clear description of the bug.

## Steps to Reproduce

```typescript
import { generateJamSession } from '@jmove/generator';

const result = generateJamSession({
  key: 'C',
  form: 'blues12',
  style: 'swing',
  tempo: 120,
  timeSignature: [4, 4],
});

// What you observed:
// What you expected:
```

## Expected Behavior

What should happen.

## Actual Behavior

What happens instead. Include any error messages verbatim.

## Environment

- **Package version**: `1.0.x`
- **Node.js version**: `v2x.x.x`
- **OS**: macOS / Linux / Windows

## Which generator is affected?

- [ ] `generateJamSession` (chord progressions)
- [ ] `generateWalkingBass` (bass lines)
- [ ] `generatePianoComping` (piano voicings)
- [ ] `generateDrumPattern` (drum patterns)
- [ ] `autoDetectPreset` (preset detection)
- [ ] Other: ___

## Musical context (if applicable)

- **Style**: e.g. swing, bossa, fusion
- **Form**: e.g. blues12, aaba32
- **Tempo**: e.g. 120 BPM
- **Time signature**: e.g. 4/4, 7/8
- **Chord quality**: e.g. m7, 7b9

## Additional context

Any other info, screenshots, or MIDI file excerpts that help illustrate the issue.
