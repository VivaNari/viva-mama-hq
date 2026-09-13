/**
 * The normal distribution routines, checked against published quantiles.
 *
 * These are tested to more decimal places than the product displays on purpose. A CDF
 * that is merely "close" produces a percentile up to half a point off the reference, and
 * that failure looks exactly like an LMS bug — it gets diagnosed only after the LMS maths
 * has been cleared, which is a day gone. Pinning the accuracy here means the next person
 * can rule this file out in seconds.
 */
import { normalCdf, percentileFromZ, zFromPercentile } from "./normal";

describe("normalCdf", () => {
    it("is exactly a half at zero", () => {
        expect(normalCdf(0)).toBeCloseTo(0.5, 15);
    });

    it("matches published quantiles", () => {
        // The textbook 95% two-sided interval.
        expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 12);
        expect(normalCdf(-1.959963984540054)).toBeCloseTo(0.025, 12);
        // WHO's ±2 SD flags.
        expect(normalCdf(2)).toBeCloseTo(0.9772498680518208, 12);
        expect(normalCdf(-2)).toBeCloseTo(0.022750131948179195, 12);
        // ±3 SD, where the extreme-value adjustment takes over.
        expect(normalCdf(3)).toBeCloseTo(0.9986501019683699, 12);
        expect(normalCdf(-3)).toBeCloseTo(0.0013498980316301035, 12);
    });

    it("is symmetric about zero", () => {
        for (const z of [0.25, 1, 1.5, 2.5, 4, 6]) {
            expect(normalCdf(z) + normalCdf(-z)).toBeCloseTo(1, 14);
        }
    });

    it("saturates rather than overflowing in the far tails", () => {
        expect(normalCdf(40)).toBe(1);
        expect(normalCdf(-40)).toBe(0);
        expect(normalCdf(Number.POSITIVE_INFINITY)).toBe(1);
        expect(normalCdf(Number.NEGATIVE_INFINITY)).toBe(0);
    });
});

describe("zFromPercentile", () => {
    it("matches published quantiles", () => {
        expect(zFromPercentile(50)).toBeCloseTo(0, 12);
        expect(zFromPercentile(97.5)).toBeCloseTo(1.959963984540054, 9);
        expect(zFromPercentile(2.5)).toBeCloseTo(-1.959963984540054, 9);
    });

    /** The five curves the chart draws — these exact z-values shape every reference line. */
    it("gives the right z for each reference percentile", () => {
        expect(zFromPercentile(3)).toBeCloseTo(-1.8807936081512509, 9);
        expect(zFromPercentile(15)).toBeCloseTo(-1.0364333894937898, 9);
        expect(zFromPercentile(50)).toBeCloseTo(0, 9);
        expect(zFromPercentile(85)).toBeCloseTo(1.0364333894937898, 9);
        expect(zFromPercentile(97)).toBeCloseTo(1.8807936081512509, 9);
    });

    it("round-trips against the CDF across the whole usable range", () => {
        for (const percentile of [0.1, 1, 3, 15, 25, 50, 75, 85, 97, 99, 99.9]) {
            expect(percentileFromZ(zFromPercentile(percentile))).toBeCloseTo(percentile, 9);
        }
    });

    it("refuses a percentile that is not strictly inside 0–100", () => {
        expect(() => zFromPercentile(0)).toThrow(RangeError);
        expect(() => zFromPercentile(100)).toThrow(RangeError);
        expect(() => zFromPercentile(-1)).toThrow(RangeError);
    });
});
