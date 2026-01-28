import { Schema } from "mongoose";
import { IRecommendationHistory } from "../../types/recommendation-history.types";
import { required } from "joi";

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
        breastfeeding: { type: Boolean, required: true },
        tagline: { type: String },
        individualRecommendations: {
            physical: {
                recommendation: {
                    title: { type: String, required: false },
                    goingWell: { type: String, required: false },
                    needsHelp: { type: String },
                    celebrate: { type: [String], default: [] },
                    tips: { type: [String], default: [] },
                    next: { type: [String], default: [] },
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
                recommendation: {
                    title: { type: String, required: true },
                    goingWell: { type: String, required: true },
                    needsHelp: { type: String },
                    celebrate: { type: [String], default: [] },
                    tips: { type: [String], default: [] },
                    next: { type: [String], default: [] },
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
                recommendation: {
                    title: { type: String, required: true },
                    goingWell: { type: String, required: true },
                    needsHelp: { type: String },
                    celebrate: { type: [String], default: [] },
                    tips: { type: [String], default: [] },
                    next: { type: [String], default: [] },
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
