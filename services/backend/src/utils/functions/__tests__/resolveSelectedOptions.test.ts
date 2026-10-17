import {
    resolveSelectedOptions,
    resolveSelectedScores,
    resolveSelectedValues,
} from "../resolveSelectedOptions";
import { IFlowNode } from "../../../types/chat.types";

type OptionNode = Pick<IFlowNode, "options">;

/**
 * Mirrors the real `pregnancy_conditions` node of onboarding-flow-v2: every real
 * condition shares score 0 and only "none" differs. This shape is what made
 * score-based resolution corrupt answers.
 */
const pregnancyConditions: OptionNode = {
    options: [
        { label: "Anemia", value: "anemia", score: 0 },
        { label: "Gestational diabetes", value: "gestational_diabetes", score: 0 },
        { label: "High BP", value: "high_bp", score: 0 },
        { label: "Obesity", value: "obesity", score: 0 },
        { label: "Thyroid", value: "thyroid", score: 0 },
        { label: "Fibroids", value: "fibroids", score: 0 },
        { label: "Twin pregnancy", value: "twin", score: 0 },
        { label: "None of these", value: "none", score: 2 },
    ],
};

/** Mirrors `smoking`: a SINGLE-select whose two non-"never" options share a score. */
const smoking: OptionNode = {
    options: [
        { label: "Never", value: "never", score: 2 },
        { label: "Occasionally", value: "occasionally", score: 0 },
        { label: "Regularly", value: "regularly", score: 0 },
    ],
};

/** Mirrors `parity`: both options have a null score. */
const parity: OptionNode = {
    options: [
        { label: "First-time mom", value: "first_time", score: null },
        { label: "I have had a child before", value: "multiparous", score: null },
    ],
};

/**
 * Mirrors the weekly check-in `lactation_status` node. Scores are unique here,
 * and -1 is the STOPPED_BREASTFEEDING sentinel — it must survive the switch to
 * value-based resolution or the breastfeeding-status handler stops firing.
 */
const lactationStatus: OptionNode = {
    options: [
        { label: "Painful or no milk", value: "painful_or_no_milk", score: 0 },
        { label: "Supply inadequate", value: "supply_inadequate", score: 1 },
        { label: "Well established", value: "well_established", score: 2 },
        { label: "Stopped Breastfeeding", value: "skipped", score: -1 },
    ],
};

const STOPPED_BREASTFEEDING_SCORE = -1;

describe("resolveSelectedOptions", () => {
    describe("regression: one selection must resolve to exactly one option", () => {
        it("resolves a single condition even though all conditions share score 0", () => {
            const values = resolveSelectedValues(pregnancyConditions, {
                selectedValues: ["anemia"],
            });

            expect(values).toEqual(["anemia"]);
        });

        it("does not leak sibling options that share the same score", () => {
            const values = resolveSelectedValues(pregnancyConditions, {
                selectedValues: ["thyroid"],
            });

            expect(values).toHaveLength(1);
            expect(values).not.toContain("anemia");
            expect(values).not.toContain("none");
        });

        it("resolves a single-select whose options share a score", () => {
            expect(resolveSelectedValues(smoking, { selectedValues: ["regularly"] })).toEqual([
                "regularly",
            ]);
        });

        it("resolves options whose scores are all null", () => {
            expect(resolveSelectedValues(parity, { selectedValues: ["multiparous"] })).toEqual([
                "multiparous",
            ]);
        });
    });

    describe("multi-select", () => {
        it("returns exactly the selected options", () => {
            const values = resolveSelectedValues(pregnancyConditions, {
                selectedValues: ["anemia", "obesity", "twin"],
            });

            expect(values.sort()).toEqual(["anemia", "obesity", "twin"]);
        });

        it("ignores values that are not options on the node", () => {
            const values = resolveSelectedValues(pregnancyConditions, {
                selectedValues: ["anemia", "not_a_real_option"],
            });

            expect(values).toEqual(["anemia"]);
        });
    });

    describe("derived scores stay intact for scoring/elimination", () => {
        it("returns the score of the selected option, not of its siblings", () => {
            expect(resolveSelectedScores(smoking, { selectedValues: ["never"] })).toEqual([2]);
            expect(resolveSelectedScores(smoking, { selectedValues: ["regularly"] })).toEqual([0]);
        });

        it("returns one score per selected option", () => {
            expect(
                resolveSelectedScores(pregnancyConditions, {
                    selectedValues: ["anemia", "high_bp"],
                }),
            ).toEqual([0, 0]);
        });
    });

    describe("legacy fallback (app builds predating selectedValues)", () => {
        it("falls back to score matching when no values are sent", () => {
            const values = resolveSelectedValues(pregnancyConditions, { selectedKeys: [2] });

            expect(values).toEqual(["none"]);
        });

        it("preserves the old ambiguous behaviour rather than erroring", () => {
            const values = resolveSelectedValues(pregnancyConditions, { selectedKeys: [0] });

            expect(values).toHaveLength(7);
        });

        it("prefers values over keys when both are supplied", () => {
            const values = resolveSelectedValues(pregnancyConditions, {
                selectedValues: ["anemia"],
                selectedKeys: [0],
            });

            expect(values).toEqual(["anemia"]);
        });
    });

    describe("empty / malformed input", () => {
        it.each([
            ["no selection at all", {}],
            ["empty values", { selectedValues: [] }],
            ["empty keys", { selectedKeys: [] }],
            ["null values", { selectedValues: null }],
        ])("returns [] for %s", (_label, input) => {
            expect(resolveSelectedOptions(pregnancyConditions, input)).toEqual([]);
        });

        it("returns [] for a node with no options", () => {
            expect(resolveSelectedOptions({ options: [] }, { selectedValues: ["anemia"] })).toEqual(
                [],
            );
        });
    });

    describe("weekly check-in must be unaffected (scores are unique there)", () => {
        it.each(["painful_or_no_milk", "supply_inadequate", "well_established", "skipped"])(
            "resolves %s identically whether the client sends values or legacy scores",
            (value) => {
                const option = lactationStatus.options.find((o) => o.value === value)!;

                const byValue = resolveSelectedOptions(lactationStatus, {
                    selectedValues: [value],
                });
                const byScore = resolveSelectedOptions(lactationStatus, {
                    selectedKeys: [option.score as number],
                });

                expect(byValue).toEqual(byScore);
                expect(byValue).toHaveLength(1);
            },
        );

        it("preserves the STOPPED_BREASTFEEDING sentinel score through value resolution", () => {
            const scores = resolveSelectedScores(lactationStatus, {
                selectedValues: ["skipped"],
            });

            expect(scores).toEqual([STOPPED_BREASTFEEDING_SCORE]);
            expect(scores.includes(STOPPED_BREASTFEEDING_SCORE)).toBe(true);
        });

        it("keeps scores intact for node-elimination (score === 2 checks)", () => {
            expect(
                resolveSelectedScores(lactationStatus, { selectedValues: ["well_established"] }),
            ).toEqual([2]);
        });
    });

    describe("identity invariant", () => {
        it.each([
            ["pregnancy_conditions", pregnancyConditions],
            ["smoking", smoking],
            ["parity", parity],
        ])("%s has unique, non-empty option values", (_name, node) => {
            const values = node.options.map((o) => String(o.value));

            expect(values.every((v) => v.length > 0)).toBe(true);
            expect(new Set(values).size).toBe(values.length);
        });
    });
});
