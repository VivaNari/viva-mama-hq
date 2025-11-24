import { Schema } from "mongoose";
import { IRecommendation } from "../../types/recommendation.types";

export const RecommendationSchema = new Schema<IRecommendation>(
    {
        phase: {
            type: String,
            required: true,
            enum: ["1-2", "3-4", "5-6", "7-12", "13-26", "27-52"],
            index: true,
        },
        zone: {
            type: String,
            required: true,
            enum: ["RED", "YELLOW", "GREEN"],
            index: true,
        },
        category: {
            type: String,
            required: true,
            enum: ["physical", "lactation", "emotional", "all"],
            index: true,
        },
        title: { type: String, required: true },
        goingWell: { type: String, required: true },
        needsHelp: { type: String },
        celebrate: { type: String },
        tips: { type: String },
        next: { type: String },
    },
    { timestamps: true },
);

RecommendationSchema.index({ phase: 1, zone: 1, category: 1 });
