/**
 * The reference curves the chart draws.
 *
 * These are the backward direction — percentile to expected measurement — and their
 * correctness is what makes a plotted point mean anything. The properties asserted here
 * (the 50th curve is the table's median, curves never cross, the domain stops where the
 * standard stops) are the ones a rendering bug would break first.
 */
import { MAX_CHART_AGE_MONTHS, REFERENCE_PERCENTILES } from "./constants";
import { curveDomain, curveExtent, referenceCurve, referenceCurves } from "./curves";
import { TABLES } from "./data";
import { lmsAt } from "./lms/interpolate";

describe("referenceCurve", () => {
    /** The 50th percentile is the median, which is exactly the table's M column. */
    it("puts the 50th percentile curve on the table's median", () => {
        const table = TABLES["weight_for_age:Male"];
        const curve = referenceCurve("weight_for_age", "Male", 50);

        expect(curve).not.toBeNull();

        for (const point of curve!.points) {
            const lms = lmsAt(table, point.x);
            expect(point.y).toBeCloseTo(lms!.M, 9);
        }
    });

    it("samples one point per table row for an age-based indicator", () => {
        const curve = referenceCurve("length_for_age", "Female", 50);
        // 0..24 months inclusive.
        expect(curve!.points).toHaveLength(25);
        expect(curve!.points[0]!.x).toBe(0);
        expect(curve!.points[24]!.x).toBe(24);
    });

    /**
     * Weight-for-length is sampled every 1 cm rather than at its 0.5 cm rows — five curves
     * over 131 rows makes long path strings for a difference invisible at phone width.
     */
    it("samples weight-for-length every centimetre across 45–110 cm", () => {
        const curve = referenceCurve("weight_for_length", "Male", 50);
        expect(curve!.points).toHaveLength(66);
        expect(curve!.points[0]!.x).toBe(45);
        expect(curve!.points[65]!.x).toBe(110);
    });

    it("returns null for an indicator and sex with no table", () => {
        // @ts-expect-error — exercising the runtime guard with an unsupported sex.
        expect(referenceCurve("weight_for_age", "Other", 50)).toBeNull();
    });
});

describe("referenceCurves", () => {
    it("returns the five curves the design calls for, in order", () => {
        const curves = referenceCurves("weight_for_age", "Male");
        expect(curves.map((curve) => curve.percentile)).toEqual([...REFERENCE_PERCENTILES]);
    });

    /**
     * Percentile curves are strictly ordered at every age — if they ever cross, either the
     * interpolation or the inverse transform is wrong, and the chart would show the 3rd
     * percentile above the 97th.
     */
    it("never lets a lower percentile sit above a higher one", () => {
        for (const indicator of [
            "weight_for_age",
            "length_for_age",
            "head_circumference_for_age",
            "weight_for_length",
        ] as const) {
            for (const sex of ["Male", "Female"] as const) {
                const curves = referenceCurves(indicator, sex);

                for (let i = 1; i < curves.length; i++) {
                    const lower = curves[i - 1]!;
                    const higher = curves[i]!;

                    for (let p = 0; p < lower.points.length; p++) {
                        expect(higher.points[p]!.y).toBeGreaterThan(lower.points[p]!.y);
                    }
                }
            }
        }
    });

    it("is memoised, so switching tabs does not recompute", () => {
        expect(referenceCurves("weight_for_age", "Female")).toBe(
            referenceCurves("weight_for_age", "Female"),
        );
    });
});

describe("curveDomain", () => {
    /** The product tracks to two years even where WHO's table runs to five. */
    it("clips age-based charts at 24 months", () => {
        expect(curveDomain(TABLES["weight_for_age:Male"])).toEqual([0, MAX_CHART_AGE_MONTHS]);
        expect(curveDomain(TABLES["head_circumference_for_age:Female"])).toEqual([
            0,
            MAX_CHART_AGE_MONTHS,
        ]);
    });

    it("leaves the length axis of weight-for-length alone", () => {
        expect(curveDomain(TABLES["weight_for_length:Male"])).toEqual([45, 110]);
    });

    it("never widens a table past what WHO published", () => {
        // Length-for-age ends at 24 months; asking for 60 must not invent rows.
        expect(curveDomain(TABLES["length_for_age:Male"], 60)).toEqual([0, 24]);
    });
});

describe("curveExtent", () => {
    it("spans the lowest 3rd-percentile point to the highest 97th", () => {
        const curves = referenceCurves("weight_for_age", "Male");
        const [min, max] = curveExtent(curves);

        expect(min).toBeCloseTo(curves[0]!.points[0]!.y, 9);
        expect(max).toBeCloseTo(curves[4]!.points.at(-1)!.y, 9);
        expect(min).toBeLessThan(max);
    });

    it("falls back to a usable range rather than infinities when given nothing", () => {
        expect(curveExtent([])).toEqual([0, 1]);
    });
});
