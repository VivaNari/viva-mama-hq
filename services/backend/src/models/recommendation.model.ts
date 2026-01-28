import { Model, model } from "mongoose";
import { IRecommendation } from "../types/recommendation.types";
import { RecommendationSchema } from "./schema/recommendation.schema";

const recommendationModel: Model<IRecommendation> = model<IRecommendation>(
    "Recommendation",
    RecommendationSchema,
);

export default recommendationModel;
