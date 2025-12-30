const twilio = require("twilio");
import env from "../../config/env";

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

async function sendSMS(to: string, message: string) {
    try {
        const response = await client.messages.create({
            body: message,
            from: env.TWILIO_PHONE_NUMBER,
            to: to,
        });
        return true;
    } catch (error) {
        console.error("Error sending SMS:", error);
        return false;
    }
}

export default sendSMS;

// Twilio Sandbox number
const WHATSAPP_FROM = "whatsapp:+14155238886";

const sendWhatsAppMessage = async (to: string, message: string) => {
    // format number properly
    const formattedTo = to.startsWith("+") ? `whatsapp:${to}` : `whatsapp:+91${to}`;

    console.log("[TWILIO] Sending WhatsApp message");
    console.log("[TWILIO] FROM:", WHATSAPP_FROM);
    console.log("[TWILIO] TO:", formattedTo);

    try {
        const response = await client.messages.create({
            from: WHATSAPP_FROM, // ✅ Twilio Sandbox number
            to: formattedTo, // ✅ User / care manager number
            body: message,
        });

        console.log("[TWILIO] Message sent:", response.sid);
        return response;
    } catch (err) {
        console.error("[TWILIO] WhatsApp failed:", err);
        throw err; // let controller handle logging
    }
};

export { sendWhatsAppMessage };
