export interface CareManagerWhatsAppParams {
    to: string;
    careManagerName: string;
    userId: string;
    userEmailOrPhone: string;
    requestedAt: string;
}

export interface ExpertConsultationWhatsAppParams {
    to: string;
    expertId: string;
    expertName: string;
    userId: string;
    userEmailOrPhone: string;
}

/**
 * Parameters required to send OTP on WhatsApp through GetGabs template API.
 */
export interface OTPWhatsAppParams {
    to: string;
    otp: string;
}
