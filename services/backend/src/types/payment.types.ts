import { Response } from "express";
import { Schema } from "mongoose";

export interface IPaymentOrder {
    order_id: string;
    receipt: string;
    user_id: Schema.Types.ObjectId;
    plan: string;
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
