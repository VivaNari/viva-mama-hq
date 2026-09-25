# @vivamama/growth-standards

WHO Child Growth Standards (2006) — the LMS reference tables plus the z-score and
percentile maths — shared by `services/backend` and `apps/mobile`.

Both consumers import this one module on purpose. The percentile a mother sees while she is
typing a measurement and the percentile the server persists have to be the same number; two
implementations of `z = ((x/M)^L − 1)/(L·S)` would be free to drift, and the drift would be
invisible until someone compared a stored row against the screen.

## What's inside

| Module | Exports |
| --- | --- |
| `evaluate` | `evaluateGrowth`, `evaluateIndicator` — measurement → z-score + percentile |
| `curves` | `referenceCurves`, `curveDomain`, `curveExtent` — percentile → expected value, for drawing |
| `age` | `ageInDaysUtc`, `ageMonths` |
| `units` | `gramsToKg`, `birthMeasurementsToGrowthPoint`, `lbToKg`, `inToCm` |
| `classification` | `bandForZ`, `isPercentileQuotable` |
| `data` | `TABLES` — the eight generated LMS tables |

Four indicators: `weight_for_age`, `length_for_age`, `head_circumference_for_age`,
`weight_for_length`.

## Usage

```ts
import { ageInDaysUtc, evaluateGrowth } from '@vivamama/growth-standards';

const evaluation = evaluateGrowth({
  sex: child.sex,                                        // 'Male' | 'Female'
  ageInDays: ageInDaysUtc(child.date_of_birth, measuredOn),
  measurement: { weight_kg: 7.8, length_cm: 67.6, head_circumference_cm: 43.3 },
});

evaluation.weight_for_age;
// { status: 'OK', z: -0.1604, zRaw: -0.1604, percentile: 43.6, value: 7.8, key: 6.012 }
```

Everything is metric (kg, cm) and free of Node and browser APIs. Convert at the boundary —
`units.ts` has the conversions, and they are never applied to a rounded value.

### Results are a discriminated union

Read `status` before `percentile`. It is `'OK'`, `'OUT_OF_RANGE'` (the key falls outside
what WHO published — common, since weight-for-length starts at 45 cm), `'MISSING_INPUT'`
(weight-for-length needs a length from the same entry), or `'NOT_APPLICABLE'` (no WHO table
for that child, e.g. sex recorded as Other).

Nothing is ever clamped or extrapolated. Outside the published range you get `null`, not a
plausible-looking invented number.

## Regenerating the tables

The eight source workbooks live in `who-source/` and are committed. For a medical number
the ability to re-run the generator and get a byte-identical diff *is* the audit trail.

```bash
pnpm --filter @vivamama/growth-standards run generate   # git diff must come back empty
```

Each generated file in `src/data/` carries the sha256 of the workbook it came from, so a
silently swapped source fails review rather than shipping. Output is TypeScript rather than
JSON so it compiles on the backend without an asset-copy step, bundles under Metro with no
configuration, and can carry that provenance header — JSON cannot hold a comment.

## Module resolution

The `exports` map serves TypeScript source to React Native and compiled CommonJS to Node:

```jsonc
"exports": { ".": {
  "react-native": "./src/index.ts",
  "types": "./dist/index.d.ts",
  "require": "./dist/index.js",
  "default": "./dist/index.js"
} }
```

Metro, `tsc` and RN's Jest environment all honour the `react-native` condition, so the app
gets live source with no build step and no stale `dist`. The backend gets `dist`, ordered by
turbo's `build.dependsOn: ["^build"]`.

`apps/mobile/jest.config.js` replaces the React Native preset's `transformIgnorePatterns`
with its own allowlist, so it maps this package explicitly via `moduleNameMapper`.

## Accuracy

Verified against the client's reference implementation (infantchart.com): a boy born
2026-03-14 measured 2026-09-13 at 7.80 kg scores z = −0.1604, percentile 43.6 — matching the
site exactly. `src/evaluate.test.ts` pins that case, and the same assertion is duplicated in
the backend and mobile suites so a stale `dist` shipping to one side is caught.

Age is keyed in fractional months (`days / 30.4375`) with L, M and S interpolated between
rows. Rounding to whole months gives 43.8 instead of 43.6, so neither is optional.

## Attribution

WHO Child Growth Standards — https://www.who.int/tools/child-growth-standards

**Not a medical device.** Percentiles produced here are informational and are not a clinical
assessment. Any surface that displays them must say so.
