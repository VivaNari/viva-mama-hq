import axios from "axios";
import env from "../../config/env";
import { CareManagerWhatsAppParams } from "../../types/getgabs.types";

/**
 * Sends a WhatsApp message for care manager callback request
 * @param to - Recipient phone number (with country code, e.g., "919083457878")
 * @param careManagerName - Name of the care manager
 * @param userId - User ID
 * @param userEmailOrPhone - User's email or phone number
 * @param requestedAt - When the callback was requested
 */
export async function sendWhatsappMessageForCareManager({
    to,
    careManagerName,
    userId,
    userEmailOrPhone,
    requestedAt,
}: CareManagerWhatsAppParams): Promise<any> {
    try {
        const payload = {
            api_key: env.GETGABS_API_KEY as string,
            sender: env.GETGABS_SENDER as string,
            campaign_id: env.GETGABS_CAMPAIGN_ID as string,
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "template",
            template: {
                name: "care_manager_callback",
                language: {
                    code: "en_US",
                },
                components: [
                    {
                        type: "BODY",
                        parameters: [
                            {
                                type: "text",
                                text: careManagerName,
                            },
                            {
                                type: "text",
                                text: userId,
                            },
                            {
                                type: "text",
                                text: userEmailOrPhone,
                            },
                            {
                                type: "text",
                                text: requestedAt,
                            },
                        ],
                    },
                ],
            },
        };

        const response = await axios.post(
            "https://app.getgabs.com/whatsappbusiness/send-templated-message",
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );

        console.log(
            "response.data from getgabs",
            response.data,
            "\n",
            payload,
            "\n",
            payload.template.components[0]?.parameters,
        );
        return response.data;
    } catch (error: any) {
        console.error(
            "Failed to send care manager WhatsApp message:",
            error.response?.data || error.message,
        );
        throw error;
    }
}
