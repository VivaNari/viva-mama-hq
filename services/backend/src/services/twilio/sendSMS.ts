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
