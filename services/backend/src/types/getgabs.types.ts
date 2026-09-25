/**
 * The nine body parameters shared by both booking templates.
 *
 * GetGabs passes parameters positionally, so the order of this interface is the contract
 * with the approved Meta template — adding a field in the middle silently shifts every
 * later value into the wrong placeholder. Append only.
 *
 * Every value must be a non-empty string: Meta rejects a send outright if any parameter
 * is blank, which is why the callers substitute a dash rather than passing through an
 * empty email.
 */
export interface ConsultationBookingWhatsAppParams {
    to: string;
    /** 1 — patient's name */
    patientName: string;
    /** 2 — patient's WhatsApp or email, so the prescription can be sent back manually */
    patientContact: string;
    /** 3 — the expert or care manager being booked */
    consultantName: string;
    /** 4 — when the booking was made, IST */
    bookedOn: string;
    /** 5 — the requested consultation date, IST */
    consultationDate: string;
    /** 6 — the preferred window label, e.g. "9:00 AM – 12:00 PM" */
    preferredSlot: string;
    /** 7 — how it was paid for, e.g. "Credit (1 used, 2 left)" or "Paid ₹800" */
    payment: string;
    /** 8 — the Google Meet URL, or a stand-in when generation failed */
    joinLink: string;
    /** 9 — the consultation id, quoted back when reporting the confirmed time */
    bookingRef: string;
}

/**
 * Parameters required to send OTP on WhatsApp through GetGabs template API.
 */
export interface OTPWhatsAppParams {
    to: string;
    otp: string;
}
