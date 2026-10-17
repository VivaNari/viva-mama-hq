import { Response } from "express";
import { Schema } from "mongoose";
import { EPreferredSlot } from "../constants/consultation-slots";
import { ConsultationTypeEnum } from "./consultation.types";

export interface IBookConsultationOrder {
    order_id: string;
    receipt: string;
    user_id: Schema.Types.ObjectId;
    /**
     * The expert or care manager being booked. Was `expert_id` until counsellors gained
     * a pay-per-session route of their own; `consultation_type` says which collection it
     * points at, mirroring how `consultations.consultatorId` already works.
     */
    consultant_id: Schema.Types.ObjectId;
    consultation_type: ConsultationTypeEnum;
    amount: number;
    currency: string;
    razorpay_payment_id: string;
    status: TIBookConsultationOrderOrderStatus;
    preferred_consultation_date: Date;
    /** Parked here through the Razorpay round-trip; copied onto the consultation on verify. */
    preferred_slot: EPreferredSlot | null;
}

export interface ICreateIBookConsultationOrderPayload {
    consultantId: string;
    consultationType: ConsultationTypeEnum;
    /**
     * @deprecated Ignored. The fee is resolved from the consultant's `remuneration`, so
     * a client cannot influence what it is charged. Still accepted on the wire so app
     * builds that predate the change keep working.
     */
    amount?: number;
    date: string;
    preferredSlot: EPreferredSlot;
    userId: string;
    response: Response;
}

export type TIBookConsultationOrderOrderStatus = "created" | "attempted" | "paid" | "failed";
