import { Schema } from "mongoose";

export interface IConsultationReview {
    _id: Schema.Types.ObjectId;
    consultationId: Schema.Types.ObjectId;
    review: string;
    rating: number;
    createdAt: Date;
    updatedAt: Date;
}
