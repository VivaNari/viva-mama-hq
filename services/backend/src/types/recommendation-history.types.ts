import { Schema, Document, Types } from "mongoose";
import { CategoryKey } from "./score-engine.types";

export interface IRecommendationHistory {
    userId: Schema.Types.ObjectId | string;
    week: number;
    finalScore: number;
    zone: "RED" | "YELLOW" | "GREEN";
    weakestCategory: CategoryKey;
    breastfeeding: boolean;
    recommendationId: Types.ObjectId | string;
    categoryScores: {
        physical: { raw: number; weighted: number };
        lactation: { raw: number; weighted: number };
        emotional: { raw: number; weighted: number };
    };
}
