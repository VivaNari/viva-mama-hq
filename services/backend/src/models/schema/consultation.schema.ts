import { Schema } from "mongoose";
import { ConsultationTypeEnum, IConsultationRequest } from "../../types/consultation.types";
import { generalSchemaOptions } from "../../constants/model";
import { EConsultationPaymentMode } from "../../types/subscription.types";
import { EPreferredSlot } from "../../constants/consultation-slots";

const consultationSchema = new Schema<IConsultationRequest>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
        consultationType: {
            type: String,
            enum: Object.values(ConsultationTypeEnum),
            required: true,
        },
        consultatorId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: function (this: IConsultationRequest) {
                if (this.consultationType === ConsultationTypeEnum.CARE_MANAGER)
                    return "care_managers";
                return "experts";
            },
        },
        requestStatus: {
            type: String,
            enum: ["PENDING", "COMPLETED", "UNHANDLED"],
            default: null,
        },
        preferred_consultation_date: {
            type: Date,
            required: true,
        },
        // The ~3-hour window the patient asked for. Null on pre-slot bookings.
        preferred_slot: {
            type: String,
            enum: [...Object.values(EPreferredSlot), null],
            default: null,
        },
        // Generated at booking. Nullable on purpose — see IConsultationRequest.meeting_link.
        meeting_link: {
            type: String,
            default: null,
        },
        meeting_space_id: {
            type: String,
            default: null,
        },
        // Set by hand once the coordinator has agreed the exact time; drives the Join
        // button's unlock. Indexed because the pending-consultations query filters on it
        // to keep a banner alive through the call window.
        meeting_confirmed_at: {
            type: Date,
            default: null,
            index: true,
        },
        // Reminder offsets already pushed for this call. See IConsultationRequest —
        // the five-minute cadence of the reminder job needs explicit sent-state rather
        // than the arithmetic dedupe the daily jobs rely on.
        reminders_sent: {
            type: [Number],
            default: [],
        },
        // Null until a booking route sets it explicitly. See IConsultationRequest.
        paymentMode: {
            type: String,
            enum: [...Object.values(EConsultationPaymentMode), null],
            default: null,
        },
        // Refunding on UNHANDLED needs to know which ledger row to reverse.
        credit_ledger_id: {
            type: Schema.Types.ObjectId,
            ref: "consultation_credits",
            default: null,
        },
    },
    generalSchemaOptions,
);

export default consultationSchema;
