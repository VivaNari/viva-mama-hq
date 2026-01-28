import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import {
    IBookConsultationOrder,
    TIBookConsultationOrderOrderStatus,
} from "../../types/book-consultation.types";

const bookConsultationOrderSchema: Schema<IBookConsultationOrder> =
    new Schema<IBookConsultationOrder>(
        {
            order_id: {
                type: String,
            },
            receipt: {
                type: String,
            },
            user_id: {
                type: Schema.Types.ObjectId,
            },
            expert_id: {
                type: Schema.Types.ObjectId,
                ref: "experts",
            },
            amount: {
                type: Number,
            },
            currency: {
                type: String,
            },
            razorpay_payment_id: {
                type: String,
                default: null,
            },
            status: {
                type: String,
                enum: [
                    "created",
                    "attempted",
                    "paid",
                    "failed",
                ] as TIBookConsultationOrderOrderStatus[],
            },
        },
        generalSchemaOptions,
    );

export default bookConsultationOrderSchema;
