# Contributing to @jmove/generator

Thank you for your interest in contributing! This guide covers the main contribution path: **community style presets**.

## Table of Contents

- [Style Presets](#style-presets)
- [Development Setup](#development-setup)
- [Preset Creation Guide](#preset-creation-guide)
- [Validation](#validation)
- [Submitting a PR](#submitting-a-pr)
- [Bug Reports & Feature Requests](#bug-reports--feature-requests)
- [Code Contributions](#code-contributions)

## Style Presets

The easiest and most impactful way to contribute is by adding a new style preset. Presets define musical character — swing feel, density, tempo range, and optional per-instrument style overrides — that shape how the generator produces backing tracks.

### Built-in Styles

Presets build on top of one (or more) base styles:

| Category | Styles |
|----------|--------|
| Traditional | `swing`, `hardBop`, `coolJazz`, `ballad` |
| Modern | `fusion`, `ecm`, `modal`, `contemporaryJazz` |
| Latin | `bossa`, `latin` |
| Groove | `funk`, `jazzWaltz`, `shuffleBlues`, `neoSoul` |
| Experimental | `holdsworth`, `alfaMist`, `metheny`, `mathRock`, `idm` |

## Development Setup

```bash
# Clone the repo
git clone https://github.com/jmove/generator.git
cd generator

# Install dependencies (Node.js 20+ required)
npm install

# Run tests to make sure everything works
npm test

# Build the package
npm run build
```

## Preset Creation Guide

### 1. Copy the template

```bash
cp preset-template.ts presets/your-preset-name.ts
```

### 2. Fill in all fields

Open `presets/your-preset-name.ts` and edit:

```typescript
import type { StylePreset } from './src/types';

const preset: StylePreset = {
  // Unique kebab-case ID — must not conflict with built-in presets
  id: 'afrobeat-highlife',

  // Display name shown in the UI
  name: 'Afrobeat Highlife',

  // Be specific about genre, influences, and character
  description: 'Tony Allen-inspired Afrobeat with highlife guitar patterns and Fela Kuti horn section energy',

  // Base style — determines generator algorithms
  style: 'funk',

  // Optional: mix styles per instrument
  instrumentStyles: {
    bass: 'funk',
    piano: 'latin',
    drums: 'funk',
  },

  // Style parameters
  parameters: {
    swingAmount: 10,  // 0 = straight, 100 = heavy triplet
    density: 75,      // 0 = sparse, 100 = busy
  },

  // Realistic BPM range for this style
  tempoRange: [100, 130],
};

export default preset;
```

### 3. Field Reference

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Kebab-case, unique, 2+ chars |
| `name` | string | 2–50 chars |
| `description` | string | 10–200 chars, be specific |
| `style` | string | One of the base styles listed above |
| `instrumentStyles` | object? | Optional `{ bass?, piano?, drums? }` overrides |
| `parameters.swingAmount` | number | 0–100 |
| `parameters.density` | number | 0–100 |
| `tempoRange` | [number, number] | `[min, max]`, both 30–300, min < max |

### 4. Tips for Great Presets

- **Be specific in descriptions.** "Afrobeat highlife with 6/8 bell pattern" > "African music"
- **Name real influences.** Artists and albums help users understand the sound.
- **Test at both ends of the tempo range.** The preset should sound musical at min and max BPM.
- **Use `instrumentStyles` for hybrid feels.** E.g., Latin bass with funk drums creates interesting tension.
- **Keep tempo ranges realistic.** Don't set 30–300 — pick the range where the style actually works.

## Validation

Run the validator before submitting:

```bash
# Validate a single preset
npx tsx scripts/validate-preset.ts presets/your-preset-name.ts

# Validate all presets
npx tsx scripts/validate-preset.ts --all
```

The validator checks:

- All required fields present with correct types
- ID format (kebab-case) and uniqueness
- Style is a valid base style
- Parameters in valid ranges (0–100)
- Tempo range is valid (min < max, within 30–300 BPM)
- Description quality (min 10 chars)
- **Generation smoke test** — actually generates bass, piano, and drums to verify no runtime errors

You can also validate against the JSON Schema at `preset-schema.json`.

## Submitting a PR

1. Fork the repository
2. Create a branch: `git checkout -b preset/your-preset-name`
3. Add your preset file to `presets/`
4. Run validation: `npx tsx scripts/validate-preset.ts presets/your-preset-name.ts`
5. Push and open a PR using the **Preset** PR template
6. Include a brief listening note — what does this preset sound like and when would you use it?

### PR Checklist

Your PR will be reviewed for:

- [ ] Validation passes (`PASS` output)
- [ ] ID doesn't conflict with existing presets
- [ ] Description is specific and helpful
- [ ] Tempo range is realistic for the style
- [ ] Musical quality at both min and max tempo

## Bug Reports & Feature Requests

Open an issue with:

- **Bug reports**: Steps to reproduce, expected vs actual behavior, Node.js version
- **Feature requests**: Use case, proposed API surface, any prior art

## Code Contributions

For changes to the generator core (bass, piano, drums, groove algorithms):

1. Open an issue first to discuss the approach
2. Write tests for new functionality
3. Run the full test suite: `npm test`
4. Ensure lint and type check pass: `npm run lint && npm run typecheck`
5. Keep PRs focused — one feature or fix per PR

### Code Style

- TypeScript strict mode
- No runtime dependencies
- All public types in `src/types.ts`
- Export new functions from `src/index.ts`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
