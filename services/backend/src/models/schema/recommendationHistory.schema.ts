import { Schema } from "mongoose";
import { IRecommendationHistory } from "../../types/recommendation-history.types";

export const RecommendationHistorySchema = new Schema<IRecommendationHistory>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        week: { type: Number, required: true },
        finalScore: { type: Number, required: true },
        zone: {
            type: String,
            required: true,
            enum: ["RED", "YELLOW", "GREEN"],
        },
        weakestCategory: {
            type: String,
            required: true,
            enum: ["physical", "lactation", "emotional"],
        },
        breastfeeding: { type: Boolean, required: true },
        recommendationId: {
            type: Schema.Types.ObjectId,
            ref: "Recommendation",
            required: true,
        },
        individualRecommendations: {
            physical: {
                recommendationId: {
                    type: Schema.Types.ObjectId,
                    ref: "Recommendation",
                    default: null,
                },
                score: {
                    type: Number,
                    required: true,
                },
                zone: {
                    type: String,
                    required: true,
                    enum: ["RED", "YELLOW", "GREEN"],
                },
            },
            lactation: {
                recommendationId: {
                    type: Schema.Types.ObjectId,
                    ref: "Recommendation",
                    default: null,
                },
                score: {
                    type: Number,
                    required: true,
                },
                zone: {
                    type: String,
                    required: true,
                    enum: ["RED", "YELLOW", "GREEN"],
                },
            },
            emotional: {
                recommendationId: {
                    type: Schema.Types.ObjectId,
                    ref: "Recommendation",
                    default: null,
                },
                score: {
                    type: Number,
                    required: true,
                },
                zone: {
                    type: String,
                    required: true,
                    enum: ["RED", "YELLOW", "GREEN"],
                },
            },
        },
        categoryScores: {
            physical: {
                raw: { type: Number, required: true },
                weighted: { type: Number, required: true },
            },
            lactation: {
                raw: { type: Number, required: true },
                weighted: { type: Number, required: true },
            },
            emotional: {
                raw: { type: Number, required: true },
                weighted: { type: Number, required: true },
            },
        },
        checkinAnswersDump: [
            {
                question: { type: String, required: true },
                answer: { type: Schema.Types.Mixed, required: true },
            },
        ],
    },
    { timestamps: true },
);

// Index for querying user history
RecommendationHistorySchema.index({ userId: 1, createdAt: -1 });
