import { Schema } from "mongoose";
import ScoreEngineService from "../../../services/score-engine/scoreEngine.service";
import RecommendationEngineService from "../../../services/recommendations/recommendation-engine.service";
import RecommendationHistoryService from "../../../services/recommendations/recommendation-history.service";
import { Indicators } from "../../../types/score-engine.types";

export default class ScoreRecommendationHandler {
    public static async process(userId: string | Schema.Types.ObjectId, indicators: Indicators) {
        try {
            console.log(`Processing score and recommendation for user ${userId}...`);

            // Calculate Score
            const scoreResult = await ScoreEngineService.calculateForUser(userId, indicators);
            console.log(`Score calculated: ${scoreResult.finalScore} (${scoreResult.zone})`);

            // Get Recommendation
            const recommendation = await RecommendationEngineService.getRecommendation(
                scoreResult.week,
                scoreResult.zone,
                scoreResult.weakestCategory,
                scoreResult.breastfeeding,
                scoreResult.categories.physical.invidual,
                scoreResult.categories.lactation.invidual,
                scoreResult.categories.emotional.invidual,
            );
            console.log(`Recommendation fetched: ${recommendation.overall._id}`);

            // Store History
            await RecommendationHistoryService.createRH({
                userId: scoreResult.userId,
                week: scoreResult.week,
                finalScore: scoreResult.finalScore,
                zone: scoreResult.zone,
                weakestCategory: scoreResult.weakestCategory,
                breastfeeding: scoreResult.breastfeeding,
                recommendationId: recommendation.overall._id,
                individualRecommendations: {
                    physical: {
                        recommendationId: recommendation.individual.physical?._id || null,
                        score: scoreResult.categories.physical.invidual.score,
                        zone: scoreResult.categories.physical.invidual.zone,
                    },
                    lactation: {
                        recommendationId: recommendation.individual.lactation?._id || null,
                        score: scoreResult.categories.lactation.invidual.score,
                        zone: scoreResult.categories.lactation.invidual.zone,
                    },
                    emotional: {
                        recommendationId: recommendation.individual.emotional?._id || null,
                        score: scoreResult.categories.emotional.invidual.score,
                        zone: scoreResult.categories.emotional.invidual.zone,
                    },
                },
                categoryScores: {
                    physical: {
                        raw: scoreResult.categories.physical.raw,
                        weighted: scoreResult.categories.physical.weighted,
                    },
                    lactation: {
                        raw: scoreResult.categories.lactation.raw,
                        weighted: scoreResult.categories.lactation.weighted,
                    },
                    emotional: {
                        raw: scoreResult.categories.emotional.raw,
                        weighted: scoreResult.categories.emotional.weighted,
                    },
                },
            });
            console.log(`Recommendation History saved`);

            const formattedMessage = RecommendationEngineService.formatRecommendationMessage(
                recommendation.overall,
            );

            return {
                success: true,
                score: scoreResult,
                recommendation: {
                    id: recommendation.overall._id,
                    message: formattedMessage,
                    raw: recommendation.overall,
                    individual: recommendation.individual,
                },
            };
        } catch (error) {
            console.error("Error in ScoreRecommendationHandler:", error);
            throw error;
        }
    }
}
