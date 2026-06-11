import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { IPaymentOrder, TPaymentOrderStatus } from "../../types/payment.types";

const paymentOrderSchema: Schema<IPaymentOrder> = new Schema<IPaymentOrder>(
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
        plan: {
            type: String,
        },
        billingCycle: {
            type: String,
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
            enum: ["created", "attempted", "paid", "failed"] as TPaymentOrderStatus[],
        },
    },
    generalSchemaOptions,
);

export default paymentOrderSchema;
