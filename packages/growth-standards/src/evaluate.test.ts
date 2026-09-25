/**
 * Scoring a measurement against the WHO standards.
 *
 * The first test is the important one: it reproduces a case taken from the client's
 * reference implementation (infantchart.com). If that number ever moves, our numbers have
 * stopped matching the site the product is measured against — regardless of which part of
 * the pipeline caused it.
 */
import { ageInDaysUtc } from "./age";
import { TABLES } from "./data";
import { evaluateGrowth, evaluateIndicator } from "./evaluate";
import { lmsAt } from "./lms/interpolate";
import { valueFromZ, zFromValue } from "./lms/zscore";

describe("reference parity with infantchart.com", () => {
    /**
     * Boy, born 2026-03-14, measured 2026-09-13 (183 days), 7.80 kg.
     * InfantChart reports "44th percentile … Precise: Percentile rank 43.6".
     */
    it("reproduces the published worked example exactly", () => {
        const ageInDays = ageInDaysUtc("2026-03-14", "2026-09-13");
        expect(ageInDays).toBe(183);

        const result = evaluateIndicator("weight_for_age", {
            sex: "Male",
            ageInDays,
            measurement: { weight_kg: 7.8 },
        });

        expect(result.status).toBe("OK");
        expect(result.z).toBeCloseTo(-0.1604, 4);
        expect(result.percentile).toBeCloseTo(43.6, 1);
        expect(Math.round(result.percentile ?? 0)).toBe(44);
    });

    /**
     * The same measurement scored at a whole month gives 43.8, not 43.6. Day precision and
     * interpolation between rows are load-bearing, not a refinement — this test exists so
     * that nobody "simplifies" the age key back to whole months.
     */
    it("differs measurably from whole-month lookup", () => {
        const table = TABLES["weight_for_age:Male"];
        const wholeMonth = lmsAt(table, 6);
        expect(wholeMonth).not.toBeNull();

        const zAtWholeMonth = zFromValue(wholeMonth!, 7.8);
        expect(zAtWholeMonth).toBeCloseTo(-0.1553, 4);
        expect(zAtWholeMonth).not.toBeCloseTo(-0.1604, 4);
    });
});

describe("evaluateGrowth", () => {
    const sixMonthOldBoy = {
        sex: "Male" as const,
        ageInDays: 183,
        measurement: { weight_kg: 7.8, length_cm: 67.6, head_circumference_cm: 43.3 },
    };

    it("scores all four indicators from one entry", () => {
        const evaluation = evaluateGrowth(sixMonthOldBoy);

        expect(evaluation.weight_for_age.status).toBe("OK");
        expect(evaluation.length_for_age.status).toBe("OK");
        expect(evaluation.head_circumference_for_age.status).toBe("OK");
        expect(evaluation.weight_for_length.status).toBe("OK");
    });

    it("keys weight-for-length on the length, not the age", () => {
        const evaluation = evaluateGrowth(sixMonthOldBoy);
        expect(evaluation.weight_for_length.key).toBe(67.6);
        expect(evaluation.weight_for_age.key).toBeCloseTo(183 / 30.4375, 6);
    });

    /** Weight-for-length needs both numbers from the same entry; the others do not. */
    it("reports MISSING_INPUT for weight-for-length when only a weight was taken", () => {
        const evaluation = evaluateGrowth({
            sex: "Male",
            ageInDays: 183,
            measurement: { weight_kg: 7.8 },
        });

        expect(evaluation.weight_for_age.status).toBe("OK");
        expect(evaluation.weight_for_length.status).toBe("MISSING_INPUT");
        expect(evaluation.length_for_age.status).toBe("MISSING_INPUT");
    });

    it("reports MISSING_INPUT rather than scoring when the date of birth is unknown", () => {
        const evaluation = evaluateGrowth({
            sex: "Male",
            ageInDays: null,
            measurement: { weight_kg: 7.8, length_cm: 67.6 },
        });

        expect(evaluation.weight_for_age.status).toBe("MISSING_INPUT");
        // Weight-for-length is keyed on length, so it survives an unknown age.
        expect(evaluation.weight_for_length.status).toBe("OK");
    });

    /**
     * WHO publishes boys' and girls' tables only. A child recorded as Other has no
     * reference to be scored against, and guessing one would be worse than saying so.
     */
    it("reports NOT_APPLICABLE when there is no WHO table for the child's sex", () => {
        const evaluation = evaluateGrowth({
            sex: "Other",
            ageInDays: 183,
            measurement: { weight_kg: 7.8, length_cm: 67.6 },
        });

        for (const result of Object.values(evaluation)) {
            expect(result.status).toBe("NOT_APPLICABLE");
        }
    });
});

describe("domain edges", () => {
    /**
     * WHO's weight-for-length table starts at 45 cm. A newborn shorter than that is the
     * ordinary case in the first weeks, not an exotic one, so this path gets exercised in
     * production constantly — it must report, never clamp.
     */
    it("reports OUT_OF_RANGE for a baby shorter than the weight-for-length table", () => {
        const result = evaluateIndicator("weight_for_length", {
            sex: "Female",
            ageInDays: 3,
            measurement: { weight_kg: 2.4, length_cm: 43 },
        });

        expect(result.status).toBe("OUT_OF_RANGE");
        expect(result.percentile).toBeNull();
        // The inputs survive so the UI can say what was measured and why it is off-chart.
        expect(result.value).toBe(2.4);
        expect(result.key).toBe(43);
    });

    /**
     * Length-for-age stops at 24 months because WHO switches from recumbent length to
     * standing height there — a real clinical boundary, not a gap in the data. Weight-for-age
     * runs to 60 months, so the two must degrade independently.
     */
    it("stops length-for-age at two years while weight-for-age continues", () => {
        const thirtyMonths = { sex: "Male" as const, ageInDays: 913 };

        expect(
            evaluateIndicator("length_for_age", {
                ...thirtyMonths,
                measurement: { length_cm: 91 },
            }).status,
        ).toBe("OUT_OF_RANGE");

        expect(
            evaluateIndicator("weight_for_age", {
                ...thirtyMonths,
                measurement: { weight_kg: 13.3 },
            }).status,
        ).toBe("OK");
    });

    it("scores the first and last row of every table", () => {
        for (const table of Object.values(TABLES)) {
            for (const key of table.domain) {
                expect(lmsAt(table, key)).not.toBeNull();
            }
            expect(lmsAt(table, table.domain[0] - 0.01)).toBeNull();
            expect(lmsAt(table, table.domain[1] + 0.01)).toBeNull();
        }
    });
});

describe("the LMS transform", () => {
    it("round-trips a value through z and back, in every table", () => {
        for (const table of Object.values(TABLES)) {
            const [min, max] = table.domain;
            const midpoint = (min + max) / 2;

            for (const key of [min, midpoint, max]) {
                const lms = lmsAt(table, key);
                expect(lms).not.toBeNull();

                // Around the median, where every real measurement sits.
                for (const value of [lms!.M * 0.85, lms!.M, lms!.M * 1.15]) {
                    expect(valueFromZ(lms!, zFromValue(lms!, value))).toBeCloseTo(value, 9);
                }
            }
        }
    });

    it("puts the median exactly at z = 0", () => {
        for (const table of Object.values(TABLES)) {
            const lms = lmsAt(table, table.domain[0]);
            expect(zFromValue(lms!, lms!.M)).toBeCloseTo(0, 12);
        }
    });
});

describe("WHO extreme-value adjustment", () => {
    /** Applies to weight-based indicators only, and only past ±3 SD. */
    it("leaves ordinary measurements untouched", () => {
        const result = evaluateIndicator("weight_for_age", {
            sex: "Male",
            ageInDays: 183,
            measurement: { weight_kg: 7.8 },
        });

        expect(result.z).toBe(result.zRaw);
    });

    /**
     * Past -3 SD the Box-Cox tail collapses and reports percentiles like 0.0000003. WHO
     * rescales using the width of the outermost published SD interval. The two numbers are
     * expected to diverge here; we keep both so a persisted row can be re-read either way.
     */
    it("rescales a severely underweight measurement, and keeps the raw value too", () => {
        const result = evaluateIndicator("weight_for_age", {
            sex: "Male",
            ageInDays: 183,
            measurement: { weight_kg: 4.2 },
        });

        expect(result.status).toBe("OK");
        expect(result.zRaw).toBeLessThan(-3);
        expect(result.z).not.toBe(result.zRaw);
        // The adjustment pulls the score back toward the reference range, never past it.
        expect(result.z!).toBeGreaterThan(result.zRaw!);
        expect(result.z!).toBeLessThan(-3);
    });

    /** Length and head circumference are not weight-based; WHO does not rescale them. */
    it("does not touch length-for-age in the tails", () => {
        const result = evaluateIndicator("length_for_age", {
            sex: "Male",
            ageInDays: 183,
            measurement: { length_cm: 55 },
        });

        expect(result.zRaw).toBeLessThan(-3);
        expect(result.z).toBe(result.zRaw);
    });
});
