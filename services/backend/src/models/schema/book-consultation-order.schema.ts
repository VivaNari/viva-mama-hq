import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { EPreferredSlot } from "../../constants/consultation-slots";
import { ConsultationTypeEnum } from "../../types/consultation.types";
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
            // Polymorphic: an expert or a care manager, resolved by consultation_type.
            // Same dynamic-ref pattern as consultations.consultatorId.
            consultant_id: {
                type: Schema.Types.ObjectId,
                ref: function (this: IBookConsultationOrder) {
                    if (this.consultation_type === ConsultationTypeEnum.CARE_MANAGER)
                        return "care_managers";
                    return "experts";
                },
            },
            consultation_type: {
                type: String,
                enum: Object.values(ConsultationTypeEnum),
                default: ConsultationTypeEnum.EXPERT,
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
            preferred_consultation_date: {
                type: Date,
            },
            // Chosen before the payment sheet opens and parked here for the duration of
            // the Razorpay round-trip, because the consultation that will carry it does
            // not exist until the payment verifies.
            preferred_slot: {
                type: String,
                enum: [...Object.values(EPreferredSlot), null],
                default: null,
            },
        },
        generalSchemaOptions,
    );

export default bookConsultationOrderSchema;
