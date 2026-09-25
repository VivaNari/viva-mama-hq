import axios from "axios";
import env from "../../config/env";
import { ConsultationBookingWhatsAppParams } from "../../types/getgabs.types";

const GETGABS_TEMPLATE_ENDPOINT = "https://app.getgabs.com/whatsappbusiness/send-templated-message";

/**
 * The approved Meta templates. Both carry the same nine body parameters and differ only
 * in wording, so they share one sender.
 *
 * Versioned names rather than edits to the originals: editing an approved template sends
 * it back through Meta review, and a rejection would take the live template down with it.
 */
export enum EConsultationBookingTemplate {
    EXPERT = "expert_book_v2",
    CARE_MANAGER = "pp_counsellor_callback_v2",
}

/**
 * Meta rejects a template send outright if any parameter is an empty string, which would
 * lose the whole notification over a missing middle name. A dash keeps the message
 * deliverable and makes the gap obvious to whoever reads it.
 */
const orDash = (value: string | null | undefined): string => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : "—";
};

/**
 * Notifies the coordinator that a consultation has been booked.
 *
 * Parameters are positional — the array order below IS the template contract. See
 * ConsultationBookingWhatsAppParams before changing anything here.
 */
export async function sendWhatsappMessageForConsultationBooking(
    template: EConsultationBookingTemplate,
    {
        to,
        patientName,
        patientContact,
        consultantName,
        bookedOn,
        consultationDate,
        preferredSlot,
        payment,
        joinLink,
        bookingRef,
    }: ConsultationBookingWhatsAppParams,
): Promise<any> {
    const orderedValues = [
        patientName,
        patientContact,
        consultantName,
        bookedOn,
        consultationDate,
        preferredSlot,
        payment,
        joinLink,
        bookingRef,
    ];

    const payload = {
        api_key: env.GETGABS_API_KEY as string,
        sender: env.GETGABS_SENDER as string,
        campaign_id: env.GETGABS_CAMPAIGN_ID as string,
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
            name: template,
            language: { code: "en_US" },
            components: [
                {
                    type: "BODY",
                    parameters: orderedValues.map((value) => ({
                        type: "text",
                        text: orDash(value),
                    })),
                },
            ],
        },
    };

    try {
        const response = await axios.post(GETGABS_TEMPLATE_ENDPOINT, payload, {
            headers: { "Content-Type": "application/json" },
        });

        console.log(`Consultation booking WhatsApp sent [${template}] to ${to}`, orderedValues);
        return response.data;
    } catch (error: any) {
        console.error(
            `Failed to send consultation booking WhatsApp [${template}]:`,
            error.response?.data || error.message,
        );
        throw error;
    }
}
