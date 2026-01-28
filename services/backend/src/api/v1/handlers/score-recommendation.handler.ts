import { Schema } from "mongoose";
import ScoreEngineService from "../../../services/score-engine/scoreEngine.service";
import RecommendationEngineService from "../../../services/recommendations/recommendation-engine.service";
import RecommendationHistoryService from "../../../services/recommendations/recommendation-history.service";
import { Indicators } from "../../../types/score-engine.types";
import { getFlowQuestionsAndAnswers } from "../../../utils/getFlowQuestionsAndAnswers";

export default class ScoreRecommendationHandler {
    public static async process(
        userId: string | Schema.Types.ObjectId,
        indicators: Indicators,
        flowInstanceId: string,
    ) {
        try {
            console.log(`Processing score and recommendation for user ${userId}...`);

            // Calculate Score
            const scoreResult = await ScoreEngineService.calculateForUser(userId, indicators);
            console.log(`Score calculated: ${scoreResult.finalScore} (${scoreResult.zone})`);
            console.log(
                `scoreResult.categories.physical.invidual`,
                scoreResult.categories.physical.invidual,
            );
            console.log(
                `scoreResult.categories.lactation.invidual`,
                scoreResult.categories.lactation.invidual,
            );
            console.log(
                `scoreResult.categories.emotional.invidual`,
                scoreResult.categories.emotional.invidual,
            );

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
            console.log("recommendation is ============>", recommendation);

            // get the questions and answers by using the flow Response
            const questionsAndAnswers = await getFlowQuestionsAndAnswers(flowInstanceId);

            // Store History
            await RecommendationHistoryService.createRH({
                userId: scoreResult.userId,
                week: scoreResult.week,
                finalScore: scoreResult.finalScore,
                zone: scoreResult.zone,
                breastfeeding: scoreResult.breastfeeding,
                tagline: recommendation.overall.title,
                individualRecommendations: {
                    physical: {
                        recommendation: {
                            title: recommendation.individual.physical?.title as string,
                            goingWell: recommendation.individual.physical?.goingWell as string,
                            needsHelp: recommendation.individual.physical?.needsHelp as string,
                            celebrate: recommendation.individual.physical?.celebrate as string[],
                            tips: recommendation.individual.physical?.tips as string[],
                            next: recommendation.individual.physical?.next as string[],
                        },
                        score: scoreResult.categories.physical.invidual.score,
                        zone: scoreResult.categories.physical.invidual.zone,
                    },
                    lactation: {
                        recommendation: {
                            title: recommendation.individual.lactation?.title as string,
                            goingWell: recommendation.individual.lactation?.goingWell as string,
                            needsHelp: recommendation.individual.lactation?.needsHelp as string,
                            celebrate: recommendation.individual.lactation?.celebrate as string[],
                            tips: recommendation.individual.lactation?.tips as string[],
                            next: recommendation.individual.lactation?.next as string[],
                        },
                        score: scoreResult.categories.lactation.invidual.score,
                        zone: scoreResult.categories.lactation.invidual.zone,
                    },
                    emotional: {
                        recommendation: {
                            title: recommendation.individual.emotional?.title as string,
                            goingWell: recommendation.individual.emotional?.goingWell as string,
                            needsHelp: recommendation.individual.emotional?.needsHelp as string,
                            celebrate: recommendation.individual.emotional?.celebrate as string[],
                            tips: recommendation.individual.emotional?.tips as string[],
                            next: recommendation.individual.emotional?.next as string[],
                        },
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
                checkinAnswersDump: questionsAndAnswers,
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
