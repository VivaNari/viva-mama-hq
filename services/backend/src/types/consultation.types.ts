import { Schema } from "mongoose";
import { ICareManager } from "./care-manager.types";
import { IUser } from "./user.types";
import { EConsultationPaymentMode } from "./subscription.types";
import { EPreferredSlot } from "../constants/consultation-slots";

export type CallbackRequestStatus = "PENDING" | "COMPLETED" | "UNHANDLED";

export enum CallbackRequestStatusEnum {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    UNHANDLED = "UNHANDLED",
}

export interface IConsultationRequest {
    userId: Schema.Types.ObjectId;
    consultatorId: Schema.Types.ObjectId;
    consultationType: ConsultationTypeEnum;
    requestStatus: CallbackRequestStatus;
    preferred_consultation_date: Date;
    /**
     * The ~3-hour window the patient asked for. Null on bookings made before slots
     * existed — those have a date and nothing finer.
     */
    preferred_slot: EPreferredSlot | null;
    /**
     * The Google Meet room, generated once at booking time.
     *
     * Nullable by design, and every reader must handle null: a Meet API failure must
     * never roll back a booking that has already been paid for with money or a credit.
     * When it is null, ops paste a link in by hand and nothing else about the flow
     * changes.
     */
    meeting_link: string | null;
    /** The Meet API's own handle for the room ("spaces/xxx"), kept for later inspection. */
    meeting_space_id: string | null;
    /**
     * The exact 30-minute start the coordinator agreed with the consultant, set by hand
     * after the booking. Until this is set the patient sees the slot they asked for and
     * the Join button stays locked — there is no time to unlock against yet.
     */
    meeting_confirmed_at: Date | null;
    /**
     * Which pre-call reminder offsets (in minutes before `meeting_confirmed_at`) have
     * already been pushed.
     *
     * The other scheduled jobs dedupe by arithmetic — they run once a day, so
     * `daysUntil(x) === 3` can only be true on one run. The reminder job runs every five
     * minutes, where that trick would re-send the same notification repeatedly, so what
     * has been sent is recorded explicitly instead.
     *
     * Cleared whenever the coordinator re-confirms a time, so a rescheduled call re-arms
     * both reminders.
     */
    reminders_sent: number[];
    /**
     * Whether a credit was spent or the user paid per session. Null means the booking
     * predates the credit system (the care-manager callback was free and ungated), so
     * there is no settlement to record — deliberately not defaulted to PAID, which
     * would misreport a free booking as a purchase.
     */
    paymentMode: EConsultationPaymentMode | null;
    /**
     * The CONSUME ledger row to reverse if this consultation ends up UNHANDLED.
     * Null for PAID bookings, which refund through the payment gateway instead.
     */
    credit_ledger_id: Schema.Types.ObjectId | null;
}

export enum ConsultationTypeEnum {
    CARE_MANAGER = "CARE_MANAGER",
    EXPERT = "EXPERT",
}

/**
 * Which tab a booking belongs under on the patient's consultation history.
 *
 * Derived rather than stored: a booking crosses from UPCOMING to ONGOING purely by the
 * clock passing its start, with nothing written to the row. Computed server-side so the
 * app never has to reason about timezones — it just renders the bucket it is given.
 */
export enum EConsultationStage {
    /** Still to happen: not settled, and its start is in the future. */
    UPCOMING = "UPCOMING",
    /** Started but never closed off — the coordinator has yet to mark it COMPLETED. */
    ONGOING = "ONGOING",
    /** Settled: COMPLETED, or UNHANDLED and refunded. */
    PAST = "PAST",
}

export type IValidateRequestCallBackParamsError = {
    isValid: false;
    errorMessage: string;
};
export type IValidateRequestCallBackParams = {
    isValid: true;
    userInstance: IUser;
    consultatorInstance: ICareManager;
};
