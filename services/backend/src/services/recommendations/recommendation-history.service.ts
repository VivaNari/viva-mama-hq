import { Schema, Types } from "mongoose";
import RecommendationHistoryModel from "../../models/recommendation-history.model";
import { CategoryKey } from "../../types/score-engine.types";
import { Request, Response } from "express";
import sendResponse from "../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";

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
            console.log(`Recommendation history saved for user ${data.userId}`);
            return history;
        } catch (error) {
            console.error("Error saving recommendation history:", error);
            throw error;
        }
    }

    public async getUserHistory(request: Request, response: Response) {
        const recommendations = await RecommendationHistoryModel.find({ userId: request.user?._id })
            .sort({ createdAt: -1 })
            .populate("recommendationId")
            .lean();

        sendResponse({
            data: recommendations,
            message: "Fetched all recommendations",
            response: response,
            statusCode: StatusCodes.OK,
            success: true,
        });
    }
    public async getUserFormattedrHistory(request: Request, response: Response) {
        const recommendations = await RecommendationHistoryModel.find({ userId: request.user?._id })
            .select(["finalScore", "zone", "week"])
            .sort({ createdAt: -1 })
            .lean();

        sendResponse({
            data: recommendations,
            message: "Fetched all formatted recommendations",
            response: response,
            statusCode: StatusCodes.OK,
            success: true,
        });
    }

    public static async getHistoryByWeek(userId: string | Schema.Types.ObjectId, week: number) {
        return await RecommendationHistoryModel.findOne({ userId, week })
            .sort({ createdAt: -1 })
            .populate("recommendationId")
            .lean();
    }
}
