import { Response } from "express";
import { Schema } from "mongoose";
import { EBillingMode, EPaymentOrderPurpose, EPlanCode } from "./subscription.types";

export interface IPaymentOrder {
    order_id: string;
    receipt: string;
    user_id: Schema.Types.ObjectId;
    /** Always SUBSCRIPTION today; consultations use `bookConsultation_orders`. */
    purpose: EPaymentOrderPurpose;
    /** Set for SUBSCRIPTION orders. The amount is derived from this server-side. */
    planCode: EPlanCode | null;
    subscription_id: Schema.Types.ObjectId | null;
    billingMode: EBillingMode | null;
    /** @deprecated free-text legacy field; `planCode` carries this now. */
    plan: string;
    /** @deprecated the plan's `durationDays` carries this now. */
    billingCycle: string;
    amount: number;
    currency: string;
    razorpay_payment_id: string;
    status: TPaymentOrderStatus;
}

export interface ICreatePaymentOrderPayload {
    plan: string;
    amount: number;
    billingCycle: string;
    userId: string;
    response: Response;
}

export type TPaymentOrderStatus = "created" | "attempted" | "paid" | "failed";
