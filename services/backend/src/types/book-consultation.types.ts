import { Response } from "express";
import { Schema } from "mongoose";

export interface IBookConsultationOrder {
    order_id: string;
    receipt: string;
    user_id: Schema.Types.ObjectId;
    expert_id: Schema.Types.ObjectId;
    amount: number;
    currency: string;
    razorpay_payment_id: string;
    status: TIBookConsultationOrderOrderStatus;
}

export interface ICreateIBookConsultationOrderPayload {
    expertId: string;
    amount: number;
    userId: string;
    response: Response;
}

export type TIBookConsultationOrderOrderStatus = "created" | "attempted" | "paid" | "failed";
