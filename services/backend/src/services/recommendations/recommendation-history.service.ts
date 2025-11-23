import { Schema, Types } from "mongoose";
import RecommendationHistoryModel from "../../models/recommendation-history.model";
import { CategoryKey } from "../../types/score-engine.types";

export default class RecommendationHistoryService {
    public static async create(data: {
        userId: string | Schema.Types.ObjectId;
        week: number;
        finalScore: number;
        zone: "RED" | "YELLOW" | "GREEN";
        weakestCategory: CategoryKey;
        breastfeeding: boolean;
        recommendationId: Types.ObjectId | string; // Changed this
        categoryScores: {
            physical: { raw: number; weighted: number };
            lactation: { raw: number; weighted: number };
            emotional: { raw: number; weighted: number };
        };
    }) {
        try {
            const history = await RecommendationHistoryModel.create(data);
            console.log(`✓ Recommendation history saved for user ${data.userId}`);
            return history;
        } catch (error) {
            console.error("Error saving recommendation history:", error);
            throw error;
        }
    }

    public static async getUserHistory(userId: string | Schema.Types.ObjectId, limit: number = 10) {
        return await RecommendationHistoryModel.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("recommendationId")
            .lean();
    }

    public static async getHistoryByWeek(userId: string | Schema.Types.ObjectId, week: number) {
        return await RecommendationHistoryModel.findOne({ userId, week })
            .sort({ createdAt: -1 })
            .populate("recommendationId")
            .lean();
    }
}
