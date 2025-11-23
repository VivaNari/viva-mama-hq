import RecommendationModel from "../../models/recommendation.model";
import { CategoryKey } from "../../types/score-engine.types";
import { IRecommendationLean } from "../../types/recommendation.types";

export default class RecommendationEngineService {
    public static async getRecommendation(
        week: number,
        zone: "RED" | "YELLOW" | "GREEN",
        weakestCategory: CategoryKey,
        breastfeeding: boolean,
    ): Promise<IRecommendationLean> {
        const phase = this.getPhaseKey(week);

        try {
            // For GREEN zone, category is "all"
            if (zone === "GREEN") {
                const recommendation = await RecommendationModel.findOne({
                    phase,
                    zone: "GREEN",
                    category: "all",
                }).lean<IRecommendationLean>();

                if (!recommendation) {
                    throw new Error(`No recommendation found for phase ${phase}, zone GREEN`);
                }

                return recommendation;
            }

            // For RED/YELLOW zones, get category-specific recommendation
            let categoryToQuery = weakestCategory;

            // Handle weeks 7+ where physical is inactive
            if (week >= 7 && weakestCategory === "physical") {
                categoryToQuery = breastfeeding ? "lactation" : "emotional";
            }

            let recommendation = await RecommendationModel.findOne({
                phase,
                zone,
                category: categoryToQuery,
            }).lean<IRecommendationLean>();

            // Fallback: if not found, try other categories
            if (!recommendation) {
                const fallbackCategories: CategoryKey[] = [
                    "lactation",
                    "emotional",
                    "physical",
                ].filter((c) => c !== categoryToQuery) as CategoryKey[];

                for (const fallbackCat of fallbackCategories) {
                    recommendation = await RecommendationModel.findOne({
                        phase,
                        zone,
                        category: fallbackCat,
                    }).lean<IRecommendationLean>();

                    if (recommendation) break;
                }
            }

            if (!recommendation) {
                throw new Error(
                    `No recommendation found for phase ${phase}, zone ${zone}, category ${categoryToQuery}`,
                );
            }

            return recommendation;
        } catch (error) {
            console.error("Error fetching recommendation:", error);
            throw error;
        }
    }

    public static formatRecommendationMessage(recommendation: IRecommendationLean): string {
        let message = `${recommendation.title}\n\n`;
        message += `What's Going Well:\n${recommendation.goingWell}\n\n`;

        if (recommendation.needsHelp) {
            message += `Needs Help:\n${recommendation.needsHelp}\n\n`;
        }

        if (recommendation.celebrate) {
            message += `Celebrate:\n${recommendation.celebrate}\n\n`;
        }

        if (recommendation.tips) {
            message += `Tips:\n${recommendation.tips}`;
        }

        if (recommendation.next) {
            message += `\n\nNext:\n${recommendation.next}`;
        }

        return message;
    }

    private static getPhaseKey(week: number): "1-2" | "3-4" | "5-6" | "7-12" | "13-26" | "27-52" {
        if (week >= 1 && week <= 2) return "1-2";
        if (week >= 3 && week <= 4) return "3-4";
        if (week >= 5 && week <= 6) return "5-6";
        if (week >= 7 && week <= 12) return "7-12";
        if (week >= 13 && week <= 26) return "13-26";
        if (week >= 27 && week <= 52) return "27-52";
        return "1-2";
    }
}
