import mongoose, { Model } from "mongoose";
import { IConsultationReview } from "../types/consultation-review.types";
import consultationReviewSchema from "./schema/consultation-review.schema";

const consultationReviewModel: Model<IConsultationReview> = mongoose.model<IConsultationReview>(
    "consultation_reviews",
    consultationReviewSchema,
);

export default consultationReviewModel;
