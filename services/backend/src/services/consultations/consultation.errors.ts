import { messages } from "../../constants/messages";
import { StatusCodes } from "http-status-codes";

/**
 * Raised when the coordinator's confirmed time lands outside the window the patient
 * picked and the caller has not yet said that is deliberate.
 *
 * This is not a rejection — the coordinator may confirm any time, because the real slot
 * is settled with the consultant over WhatsApp and often moves. It exists so the panel
 * gets exactly one chance to surface the mismatch *before* anything is written, since a
 * time typed as 10:30 without an offset lands at 4:00 PM IST and the patient would be
 * the one to discover it. Re-sending with the acknowledgement goes straight through.
 */
export class OutsideSlotConfirmationRequiredError extends Error {
    constructor(public readonly preferredSlotLabel: string | null) {
        super(
            preferredSlotLabel
                ? `${messages.CONFIRMED_TIME_OUTSIDE_SLOT} (${preferredSlotLabel})`
                : messages.CONFIRMED_TIME_OUTSIDE_SLOT,
        );
        this.name = "OutsideSlotConfirmationRequiredError";
    }
}

/**
 * Raised when a credit booking names an expert it cannot be spent on.
 *
 * Deliberately NOT an EntitlementDeniedError. A 402 opens the paywall and asks the user
 * to subscribe, which is the wrong story here: she is already subscribed and her plan is
 * working exactly as sold — this one expert is simply off-panel. The app makes the same
 * distinction in its own UI and never offers the credit route for an off-panel expert,
 * so this is a backstop rather than a path a user should reach.
 */
export class ExpertBookingError extends Error {
    public readonly statusCode: number;

    constructor(
        public readonly code:
            | "EXPERT_NOT_FOUND"
            | "EXPERT_NOT_EMPANELLED"
            | "EXPERT_IN_PERSON_ONLY",
    ) {
        super(EXPERT_BOOKING_ERROR_MESSAGES[code]);
        this.statusCode =
            code === "EXPERT_NOT_FOUND" ? StatusCodes.NOT_FOUND : StatusCodes.CONFLICT;
        this.name = "ExpertBookingError";
    }
}

const EXPERT_BOOKING_ERROR_MESSAGES = {
    EXPERT_NOT_FOUND: messages.EXPERT_FETCH_FAILED,
    EXPERT_NOT_EMPANELLED: messages.EXPERT_NOT_EMPANELLED,
    // A 409 rather than a 404: the expert is real and the patient may well be hers —
    // the booking route is what does not exist.
    EXPERT_IN_PERSON_ONLY: messages.EXPERT_IN_PERSON_ONLY,
} as const;
