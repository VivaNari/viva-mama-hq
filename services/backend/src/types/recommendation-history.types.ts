import { Schema, Document } from "mongoose";

export interface IRecommendationHistory extends Document {
    userId: Schema.Types.ObjectId;
    week: number;
    finalScore: number;
    zone: "RED" | "YELLOW" | "GREEN";
    weakestCategory: "physical" | "lactation" | "emotional";
    breastfeeding: boolean;
    recommendationId: Schema.Types.ObjectId;
    categoryScores: {
        physical: { raw: number; weighted: number };
        lactation: { raw: number; weighted: number };
        emotional: { raw: number; weighted: number };
    };
}
