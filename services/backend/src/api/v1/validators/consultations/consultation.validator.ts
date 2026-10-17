import Joi from "joi";
import { IConsultationRequest } from "../../../../types/consultation.types";
import { EPreferredSlot } from "../../../../constants/consultation-slots";

const addConsultationRequestValidator = Joi.object<IConsultationRequest>({
    consultatorId: Joi.string().required(),
    preferred_consultation_date: Joi.date().required(),
    preferred_slot: Joi.string()
        .valid(...Object.values(EPreferredSlot))
        .required(),
});

/**
 * Booking with a credit takes no amount and no payment identifiers — the entitlement
 * layer decides whether the user can spend, and the ledger decides whether they have
 * anything to spend.
 */
export const bookWithCreditValidator = Joi.object({
    expertId: Joi.string().required(),
    preferred_consultation_date: Joi.date().required(),
    preferred_slot: Joi.string()
        .valid(...Object.values(EPreferredSlot))
        .required(),
}).unknown(false);

/**
 * The coordinator's confirmed 30-minute start. ISO 8601 with an explicit offset — a bare
 * "2026-07-31T10:30:00" would be read as UTC and land the patient's call five and a half
 * hours late.
 */
export const confirmMeetingTimeValidator = Joi.object({
    confirmedAt: Joi.date().iso().required(),
    /**
     * Set by the panel when it re-submits after the coordinator has seen that the time
     * sits outside the window the patient picked. Absent means "first attempt", which is
     * what lets the server ask before writing.
     *
     * Declared rather than defaulted: `unknown(false)` would reject the acknowledgement
     * outright if the key were missing here, and requestValidator does not write the
     * validated value back to `req.body`, so a Joi default would never reach the
     * controller. The controller coerces the absent case instead.
     */
    acknowledgeOutsideSlot: Joi.boolean().optional(),
}).unknown(false);

export default addConsultationRequestValidator;
