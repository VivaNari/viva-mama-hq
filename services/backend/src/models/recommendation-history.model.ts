import { model } from "mongoose";
import { IRecommendationHistory } from "../types/recommendation-history.types";
import { RecommendationHistorySchema } from "./schema/recommendationHistory.schema";

const recommendationHistoryModel = model<IRecommendationHistory>(
    "recommendation_history",
    RecommendationHistorySchema,
);
export default recommendationHistoryModel;
