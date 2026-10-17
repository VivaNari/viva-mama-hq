/**
 * Turning stored growth logs into what the chart plots.
 *
 * The case worth pinning is that one log feeds four indicators on two different x-axes:
 * three against age, weight-for-length against the child's length. A log with a weight but
 * no length contributes to three of them and to weight-for-length not at all.
 *
 * Run:  npx jest growthSeries
 */
import { buildSeries, latestResults, previewResults } from '../src/utils/growthSeries';
import { IGrowthLog } from '../src/types/growthLog.types';

const log = (
    measuredOn: string,
    ageInDays: number,
    measurements: IGrowthLog['measurements'],
    percentiles: Partial<IGrowthLog['percentiles']> = {},
): IGrowthLog =>
    ({
        _id: measuredOn,
        childId: 'c1',
        measuredOn,
        ageInDays,
        sex: 'Male',
        measurements,
        percentiles: {
            weight_for_age: { status: 'MISSING_INPUT', value: null, key: null, z: null, zRaw: null, percentile: null },
            length_for_age: { status: 'MISSING_INPUT', value: null, key: null, z: null, zRaw: null, percentile: null },
            head_circumference_for_age: { status: 'MISSING_INPUT', value: null, key: null, z: null, zRaw: null, percentile: null },
            weight_for_length: { status: 'MISSING_INPUT', value: null, key: null, z: null, zRaw: null, percentile: null },
            ...percentiles,
        },
        standard: { source: 'WHO-2006', version: 'who-2006.1' },
        createdAt: '',
        updatedAt: '',
    }) as IGrowthLog;

const scored = (percentile: number) => ({
    status: 'OK' as const,
    value: 7.8,
    key: 6,
    z: 0,
    zRaw: 0,
    percentile,
});

describe('buildSeries', () => {
    it('plots the three age-based indicators against age in months', () => {
        const series = buildSeries([
            log('2026-09-13', 183, {
                weight_kg: 7.8,
                length_cm: 67.6,
                head_circumference_cm: 43.3,
            }),
        ]);

        expect(series.weight_for_age).toHaveLength(1);
        expect(series.weight_for_age[0].x).toBeCloseTo(183 / 30.4375, 6);
        expect(series.weight_for_age[0].y).toBe(7.8);
        expect(series.length_for_age[0].y).toBe(67.6);
        expect(series.head_circumference_for_age[0].y).toBe(43.3);
    });

    /** Weight-for-length is keyed on length, so its x is centimetres. */
    it('plots weight-for-length against length, not age', () => {
        const series = buildSeries([
            log('2026-09-13', 183, { weight_kg: 7.8, length_cm: 67.6 }),
        ]);

        expect(series.weight_for_length[0].x).toBe(67.6);
        expect(series.weight_for_length[0].y).toBe(7.8);
    });

    it('omits weight-for-length when the entry has no length', () => {
        const series = buildSeries([log('2026-09-13', 183, { weight_kg: 7.8 })]);

        expect(series.weight_for_age).toHaveLength(1);
        expect(series.weight_for_length).toHaveLength(0);
    });

    it('orders an age series oldest first, whatever order the logs arrive in', () => {
        const series = buildSeries([
            log('2026-09-13', 183, { weight_kg: 7.8 }),
            log('2026-03-14', 0, { weight_kg: 3.3 }),
            log('2026-06-14', 92, { weight_kg: 6.4 }),
        ]);

        expect(series.weight_for_age.map((point) => point.y)).toEqual([3.3, 6.4, 7.8]);
    });

    /**
     * Length does not increase monotonically with time once measurement noise is involved,
     * so sorting weight-for-length by x keeps its line from doubling back on itself.
     */
    it('orders weight-for-length by length rather than by date', () => {
        const series = buildSeries([
            log('2026-09-13', 183, { weight_kg: 7.8, length_cm: 67.6 }),
            log('2026-09-20', 190, { weight_kg: 7.9, length_cm: 67.4 }),
        ]);

        expect(series.weight_for_length.map((point) => point.x)).toEqual([67.4, 67.6]);
    });

    it('returns empty series for a child with no logs', () => {
        const series = buildSeries([]);

        expect(series.weight_for_age).toEqual([]);
        expect(series.weight_for_length).toEqual([]);
    });
});

describe('latestResults', () => {
    it('takes the newest scored result for each indicator', () => {
        const results = latestResults([
            log('2026-06-14', 92, { weight_kg: 6.4 }, { weight_for_age: scored(30) }),
            log('2026-09-13', 183, { weight_kg: 7.8 }, { weight_for_age: scored(43.6) }),
        ]);

        expect(results.weight_for_age.status).toBe('OK');
        expect(results.weight_for_age.percentile).toBeCloseTo(43.6, 4);
    });

    /**
     * A mother who records only a weight today should still see her last head-circumference
     * percentile, not "not measured".
     */
    it('keeps an earlier real number rather than letting a later blank overwrite it', () => {
        const results = latestResults([
            log(
                '2026-06-14',
                92,
                { head_circumference_cm: 41 },
                { head_circumference_for_age: scored(60) },
            ),
            log('2026-09-13', 183, { weight_kg: 7.8 }, { weight_for_age: scored(43.6) }),
        ]);

        expect(results.head_circumference_for_age.status).toBe('OK');
        expect(results.head_circumference_for_age.percentile).toBe(60);
    });

    it('reports MISSING_INPUT for a child with no logs at all', () => {
        const results = latestResults([]);

        expect(results.weight_for_age.status).toBe('MISSING_INPUT');
        expect(results.weight_for_age.percentile).toBeNull();
    });
});

describe('previewResults', () => {
    /**
     * The live preview while typing runs the same package function the server uses, which
     * is why it lands on the reference site's number too.
     */
    it('scores what is being typed, matching the reference example', () => {
        const results = previewResults({
            sex: 'Male',
            dateOfBirth: '2026-03-14',
            measuredOn: new Date('2026-09-13T00:00:00.000Z'),
            measurement: { weight_kg: 7.8 },
        });

        expect(results.weight_for_age.status).toBe('OK');
        expect(results.weight_for_age.percentile).toBeCloseTo(43.6, 1);
    });

    it('cannot score without a date of birth, and says so', () => {
        const results = previewResults({
            sex: 'Male',
            dateOfBirth: null,
            measuredOn: new Date('2026-09-13T00:00:00.000Z'),
            measurement: { weight_kg: 7.8 },
        });

        expect(results.weight_for_age.status).toBe('MISSING_INPUT');
    });
});

