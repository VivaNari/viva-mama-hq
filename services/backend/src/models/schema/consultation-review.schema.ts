import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { IConsultationReview } from "../../types/consultation-review.types";

const consultationReviewSchema = new Schema<IConsultationReview>(
    {
        consultationId: {
            type: Schema.Types.ObjectId,
            ref: "consultations",
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            enum: [1, 2, 3, 4, 5],
        },
        review: {
            type: String,
            required: false,
            default: null,
        },
    },
    generalSchemaOptions,
);

export default consultationReviewSchema;
