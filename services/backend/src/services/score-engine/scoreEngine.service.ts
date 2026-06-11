import { Schema } from "mongoose";
import { Indicators, CategoryKey, ScoreResult } from "../../types/score-engine.types";
import UserModel from "../../models/user.model";

export default class ScoreEngineService {
    private static THRESHOLDS = {
        "1-2": { red: 62, yellow: 81, green: 82 },
        "3-4": { red: 72, yellow: 91, green: 92 },
        "5-6": { red: 82, yellow: 96, green: 97 },
        "7-12": { red: 77, yellow: 97, green: 98 },
        "13-26": { red: 85, yellow: 99, green: 100 },
        "27-52": { red: 93, yellow: 98, green: 99 },
    };

    public static async calculateForUser(
        userId: string | Schema.Types.ObjectId,
        indicators: Indicators,
    ): Promise<ScoreResult> {
        const user = await UserModel.findById(userId)
            .select("current_weekdays is_breastfeeding_currently")
            .lean()
            .exec();

        if (!user) {
            throw new Error("User not found");
        }

        return this.calculate(
            indicators,
            user.current_weekdays.weeks || 1,
            user.is_breastfeeding_currently ?? true,
            String(userId),
        );
    }

    public static calculate(
        indicators: Indicators,
        week: number,
        breastfeeding: boolean,
        userId: string,
    ): ScoreResult {
        // do the filter to remove negative values as when the user chooses not breastfeeding then the value is coming as -1
        const physicalArr =
            indicators.physical.filter((phsyicalScore: number) => phsyicalScore >= 0) || [];
        const lactationArr =
            indicators.lactation.filter((lactationScore: number) => lactationScore >= 0) || [];
        const emotionalArr =
            indicators.emotional.filter((emotionalScore: number) => emotionalScore >= 0) || [];

        // Helper functions
        const sum = (arr: number[]) => arr.reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);

        const categoryRaw = (arr: number[]) => {
            const count = arr.length;
            const maxPossible = count * 2;
            if (count === 0) return { raw: 0, sum: 0, maxPossible };
            const s = sum(arr);
            return {
                raw: maxPossible === 0 ? 0 : s / maxPossible,
                sum: s,
                maxPossible,
            };
        };

        // Calculate raw scores (before multiplying by the weight)
        const physicalComputed = categoryRaw(physicalArr);
        const lactationComputed = categoryRaw(lactationArr);
        const emotionalComputed = categoryRaw(emotionalArr);

        // Calculate individual score percentage (as it is individual that's why multiplying by 100)
        const individualPhysicalScorePercentage = physicalComputed.raw * 100;
        const individualLactationScorePercentage = lactationComputed.raw * 100;
        const individualEmotionalScorePercentage = emotionalComputed.raw * 100;

        const zoneForPhysical = this.getZoneForWeek(week, individualPhysicalScorePercentage);
        const zoneForLactation = this.getZoneForWeek(week, individualLactationScorePercentage);
        const zoneForEmotional = this.getZoneForWeek(week, individualEmotionalScorePercentage);

        // Get weights based on week and breastfeeding status
        const weights = this.getWeightsForWeek(week, breastfeeding);

        // Calculate weighted scores
        const physicalWeighted = physicalComputed.raw * weights.physical;
        const lactationWeighted = lactationComputed.raw * weights.lactation;
        const emotionalWeighted = emotionalComputed.raw * weights.emotional;

        // Calculate final score (0-100)
        const finalScore = this.roundToTwo(
            physicalWeighted + lactationWeighted + emotionalWeighted,
        );

        // Determine zone
        const zone = this.getZoneForWeek(week, finalScore);

        // Find weakest category
        const weakestCategory = this.findWeakestCategory(
            {
                physical: physicalComputed.raw,
                lactation: lactationComputed.raw,
                emotional: emotionalComputed.raw,
            },
            {
                physical: physicalWeighted,
                lactation: lactationWeighted,
                emotional: emotionalWeighted,
            },
        );

        return {
            userId,
            week,
            breastfeeding,
            categories: {
                physical: {
                    raw: this.roundToThree(physicalComputed.raw),
                    weighted: this.roundToTwo(physicalWeighted),
                    maxPossible: physicalComputed.maxPossible,
                    sum: physicalComputed.sum,
                    invidual: {
                        score: individualPhysicalScorePercentage,
                        zone: zoneForPhysical,
                    },
                },
                lactation: {
                    raw: this.roundToThree(lactationComputed.raw),
                    weighted: this.roundToTwo(lactationWeighted),
                    maxPossible: lactationComputed.maxPossible,
                    sum: lactationComputed.sum,
                    invidual: {
                        score: individualLactationScorePercentage,
                        zone: zoneForLactation,
                    },
                },
                emotional: {
                    raw: this.roundToThree(emotionalComputed.raw),
                    weighted: this.roundToTwo(emotionalWeighted),
                    maxPossible: emotionalComputed.maxPossible,
                    sum: emotionalComputed.sum,
                    invidual: {
                        score: individualEmotionalScorePercentage,
                        zone: zoneForEmotional,
                    },
                },
            },
            finalScore,
            zone,
            weakestCategory,
        };
    }

    private static getWeightsForWeek(week: number, breastfeeding: boolean) {
        if (week >= 1 && week <= 8) {
            return { physical: 33.33, lactation: 33.33, emotional: 33.33 };
        }

        if (week >= 9 && week <= 52) {
            if (breastfeeding) {
                return { physical: 0, lactation: 50, emotional: 50 };
            } else {
                return { physical: 0, lactation: 40, emotional: 60 };
            }
        }

        return { physical: 33.33, lactation: 33.33, emotional: 33.33 };
    }

    private static getZoneForWeek(week: number, finalScore: number): "RED" | "YELLOW" | "GREEN" {
        const phaseKey = this.getPhaseKey(week);
        const thresholds = this.THRESHOLDS[phaseKey];

        if (finalScore < thresholds.red) return "RED";
        if (finalScore <= thresholds.yellow) return "YELLOW";
        return "GREEN";
    }

    private static findWeakestCategory(
        rawScores: Record<CategoryKey, number>,
        weightedScores: Record<CategoryKey, number>,
    ): CategoryKey {
        const categories: CategoryKey[] = ["physical", "lactation", "emotional"];

        let weakest: CategoryKey = "physical";

        categories.forEach((category) => {
            const isWeaker = rawScores[category] < rawScores[weakest];
            const isTied = rawScores[category] === rawScores[weakest];
            const hasLowerWeight = weightedScores[category] < weightedScores[weakest];

            if (isWeaker || (isTied && hasLowerWeight)) {
                weakest = category;
            }
        });

        return weakest;
    }

    private static getPhaseKey(week: number): keyof typeof ScoreEngineService.THRESHOLDS {
        if (week >= 1 && week <= 2) return "1-2";
        if (week >= 3 && week <= 4) return "3-4";
        if (week >= 5 && week <= 6) return "5-6";
        if (week >= 7 && week <= 12) return "7-12";
        if (week >= 13 && week <= 26) return "13-26";
        if (week >= 27 && week <= 52) return "27-52";
        return "1-2"; // fallback
    }

    private static roundToTwo(n: number) {
        return Math.round(n * 100) / 100;
    }

    private static roundToThree(n: number) {
        return Math.round(n * 1000) / 1000;
    }
}
