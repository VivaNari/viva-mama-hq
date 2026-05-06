import axios from "axios";
import env from "../../config/env";
import { OTPWhatsAppParams } from "../../types/getgabs.types";

/**
 * Sends an OTP WhatsApp template message via GetGabs.
 * @param to - Recipient phone number with country code (for example: "919083457878")
 * @param otp - One-time password to send to the user
 */
export async function sendWhatsappMessageForOTP({ to, otp }: OTPWhatsAppParams): Promise<unknown> {
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
                name: "send_otp_template",
                language: {
                    code: "en_US",
                },
                components: [
                    {
                        type: "BODY",
                        parameters: [
                            {
                                type: "text",
                                text: otp,
                            },
                        ],
                    },
                    {
                        type: "button",
                        sub_type: "URL",
                        index: 0,
                        parameters: [
                            {
                                type: "text",
                                text: otp,
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

        return response.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error(
                "Failed to send OTP WhatsApp message:",
                error.response?.data || error.message,
            );
            throw error;
        }

        console.error("Failed to send OTP WhatsApp message:", error);
        throw error;
    }
}
