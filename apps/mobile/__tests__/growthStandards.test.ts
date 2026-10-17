/**
 * The growth calculation, as the app sees it.
 *
 * The parity test here is deliberately the same assertion that lives in
 * `packages/growth-standards` and in the backend suite. Duplicating it is the point: it is
 * the contract between the two consumers. The app resolves the package through Metro's
 * `react-native` export condition (TypeScript source) while the backend resolves compiled
 * CommonJS from `dist`, so only a test on each side catches one of them going stale.
 *
 * It also proves the jest moduleNameMapper wiring works — without it this import fails
 * outright, because the app's transformIgnorePatterns allowlist would refuse to compile
 * the package's TypeScript.
 *
 * Run:  npx jest growthStandards
 */
import {
    ageInDaysUtc,
    evaluateGrowth,
    gramsToKg,
    isPercentileQuotable,
    referenceCurves,
} from '@vivamama/growth-standards';

describe('reference parity with infantchart.com', () => {
    /** Boy, born 2026-03-14, measured 2026-09-13 (183 days), 7.80 kg → rank 43.6. */
    it('reproduces the published worked example', () => {
        const ageInDays = ageInDaysUtc('2026-03-14', '2026-09-13');
        expect(ageInDays).toBe(183);

        const { weight_for_age } = evaluateGrowth({
            sex: 'Male',
            ageInDays,
            measurement: { weight_kg: 7.8 },
        });

        expect(weight_for_age.status).toBe('OK');
        expect(weight_for_age.z).toBeCloseTo(-0.1604, 4);
        expect(weight_for_age.percentile).toBeCloseTo(43.6, 1);
    });
});

describe('units', () => {
    /**
     * The Growth Log field is in grams because that is what an Indian clinic reports; WHO
     * works in kilograms. This conversion is the only place the two meet.
     */
    it('converts the grams a clinic reports into the kilograms WHO scores', () => {
        expect(gramsToKg(7800)).toBeCloseTo(7.8, 10);
        expect(gramsToKg(3300)).toBeCloseTo(3.3, 10);
    });
});

describe('degradation', () => {
    /**
     * WHO's weight-for-length table starts at 45 cm, so a newborn shorter than that falls
     * outside it. This is the ordinary case in the first weeks, not an edge case, and the
     * screen has copy for it.
     */
    it('reports a too-short baby as out of range rather than guessing', () => {
        const { weight_for_length } = evaluateGrowth({
            sex: 'Female',
            ageInDays: 2,
            measurement: { weight_kg: 2.4, length_cm: 43 },
        });

        expect(weight_for_length.status).toBe('OUT_OF_RANGE');
        expect(weight_for_length.percentile).toBeNull();
    });

    it('reports a missing length rather than scoring weight-for-length without it', () => {
        const { weight_for_length, weight_for_age } = evaluateGrowth({
            sex: 'Male',
            ageInDays: 183,
            measurement: { weight_kg: 7.8 },
        });

        expect(weight_for_age.status).toBe('OK');
        expect(weight_for_length.status).toBe('MISSING_INPUT');
    });

    /** WHO publishes boys' and girls' tables only. */
    it('has no chart for a child whose sex has no WHO reference', () => {
        const evaluation = evaluateGrowth({
            sex: 'Other',
            ageInDays: 183,
            measurement: { weight_kg: 7.8 },
        });

        expect(evaluation.weight_for_age.status).toBe('NOT_APPLICABLE');
    });
});

describe('isPercentileQuotable', () => {
    /**
     * Past the 0.1st and 99.9th the digits are false precision — "the 0.003rd percentile"
     * is not something a parent can act on — so the UI shows a band label instead.
     */
    it('refuses to quote a number out in the tails', () => {
        expect(isPercentileQuotable(43.6)).toBe(true);
        expect(isPercentileQuotable(0.1)).toBe(true);
        expect(isPercentileQuotable(0.003)).toBe(false);
        expect(isPercentileQuotable(99.97)).toBe(false);
    });
});

describe('referenceCurves', () => {
    it('gives the chart five curves over 0–24 months', () => {
        const curves = referenceCurves('weight_for_age', 'Male');

        expect(curves.map((curve) => curve.percentile)).toEqual([3, 15, 50, 85, 97]);
        expect(curves[0].points[0].x).toBe(0);
        expect(curves[0].points.at(-1)!.x).toBe(24);
    });

    /** Weight-for-length is plotted against centimetres, not months. */
    it('spans 45–110 cm for weight-for-length', () => {
        const curves = referenceCurves('weight_for_length', 'Female');

        expect(curves[0].points[0].x).toBe(45);
        expect(curves[0].points.at(-1)!.x).toBe(110);
    });
});
