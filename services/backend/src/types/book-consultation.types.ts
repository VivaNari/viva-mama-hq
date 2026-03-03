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
    preferred_consultation_date: Date;
}

export interface ICreateIBookConsultationOrderPayload {
    expertId: string;
    amount: number;
    date: string;
    userId: string;
    response: Response;
}

export type TIBookConsultationOrderOrderStatus = "created" | "attempted" | "paid" | "failed";
