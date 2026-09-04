import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { IPaymentOrder, TPaymentOrderStatus } from "../../types/payment.types";
import { EBillingMode, EPaymentOrderPurpose, EPlanCode } from "../../types/subscription.types";

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
        // Every row here is a subscription purchase today — consultation bookings use
        // their own `bookConsultation_orders` collection. This is recorded explicitly so
        // the distinction survives if the two ever converge, and so a reader does not
        // have to infer it.
        purpose: {
            type: String,
            enum: Object.values(EPaymentOrderPurpose),
            default: EPaymentOrderPurpose.SUBSCRIPTION,
        },
        planCode: {
            type: String,
            enum: [...Object.values(EPlanCode), null],
            default: null,
        },
        subscription_id: {
            type: Schema.Types.ObjectId,
            ref: "subscriptions",
            default: null,
        },
        billingMode: {
            type: String,
            enum: [...Object.values(EBillingMode), null],
            default: null,
        },
        // Legacy free-text fields, superseded by planCode. Kept so old rows still read
        // back; new writes should not set them.
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
