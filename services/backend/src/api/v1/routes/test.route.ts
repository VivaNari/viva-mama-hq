import { Router, Request, Response } from "express";
import ScoreRecommendationHandler from "../handlers/score-recommendation.handler";
import RecommendationHistoryService from "../../../services/recommendations/recommendation-history.service";
import recommendationHistoryModel from "../../../models/recommendation-history.model";

const testRouter = Router();

const recommendationHistoryService = new RecommendationHistoryService(recommendationHistoryModel);

/**
 * POST /api/checkin
 * Complete flow: Calculate score → Get recommendation → Save history
 *
 * This endpoint handles the entire weekly check-in process
 */
testRouter.post("/checkin", async (req: Request, res: Response) => {
    try {
        const { userId, indicators } = req.body;

        // Validation
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: "userId is required",
            });
        }

        if (!indicators || typeof indicators !== "object") {
            return res.status(400).json({
                success: false,
                error: "indicators object is required",
            });
        }

        // Validate indicators structure
        const { physical, lactation, emotional } = indicators;

        if (!Array.isArray(physical) || !Array.isArray(lactation) || !Array.isArray(emotional)) {
            return res.status(400).json({
                success: false,
                error: "indicators must contain physical, lactation, and emotional arrays",
            });
        }

        // Validate that all values are numbers between 0-2
        const allValues = [...physical, ...lactation, ...emotional];
        const hasInvalidValues = allValues.some(
            (val) => typeof val !== "number" || val < 0 || val > 2,
        );

        if (hasInvalidValues) {
            return res.status(400).json({
                success: false,
                error: "All indicator values must be numbers between 0 and 2",
            });
        }

        // Process the complete flow
        const result = await ScoreRecommendationHandler.process(
            userId,
            indicators,
            "69438b601c84c724d53239fd",
        );

        // Return formatted response
        res.json({
            success: true,
            message: "Check-in completed successfully",
            data: {
                userId: result.score.userId,
                week: result.score.week,
                breastfeeding: result.score.breastfeeding,
                score: {
                    final: result.score.finalScore,
                    zone: result.score.zone,
                    weakestCategory: result.score.weakestCategory,
                    categories: {
                        physical: {
                            raw: result.score.categories.physical.raw,
                            weighted: result.score.categories.physical.weighted,
                            maxPossible: result.score.categories.physical.maxPossible,
                        },
                        lactation: {
                            raw: result.score.categories.lactation.raw,
                            weighted: result.score.categories.lactation.weighted,
                            maxPossible: result.score.categories.lactation.maxPossible,
                        },
                        emotional: {
                            raw: result.score.categories.emotional.raw,
                            weighted: result.score.categories.emotional.weighted,
                            maxPossible: result.score.categories.emotional.maxPossible,
                        },
                    },
                },
                recommendation: {
                    id: result.recommendation.id,
                    message: result.recommendation.message,
                },
            },
        });
    } catch (error: any) {
        console.error("Error in check-in endpoint:", error);

        // Handle specific errors
        if (error.message === "User not found") {
            return res.status(404).json({
                success: false,
                error: "User not found",
            });
        }

        if (error.message.includes("No recommendation found")) {
            return res.status(404).json({
                success: false,
                error: "Recommendation not found. Please seed recommendations first.",
            });
        }

        res.status(500).json({
            success: false,
            error: error.message || "Failed to process check-in",
        });
    }
});

/**
 * GET /api/checkin/history/:userId
 * Get check-in history for a user
 */
testRouter.get("/history/:userId", async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;

        const history = await recommendationHistoryService.find({
            filter: { userId },
            sort: { createdAt: -1 },
            populate: "recommendationId",
        });
        res.json({
            success: true,
            count: history.length,
            data: history,
        });
    } catch (error: any) {
        console.error("Error fetching check-in history:", error);
        res.status(500).json({
            success: false,
            error: error.message || "Failed to fetch check-in history",
        });
    }
});

/**
 * GET /api/checkin/history/:userId/week/:week
 * Get specific week's check-in for a user
 */

export default testRouter;
