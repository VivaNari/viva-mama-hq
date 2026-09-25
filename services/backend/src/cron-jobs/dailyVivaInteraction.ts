import UserModel from "../models/user.model";
import logger, { createModuleLogger } from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

const log = createModuleLogger(logger, "dailyVivaInteraction");

export const dailyVivaInteraction = async (): Promise<void> => {
    log.info("Starting daily Viva interaction reminder job");

    try {
        const users = await UserModel.find({
            FCM_token: { $exists: true, $ne: null },
            user_category: { $ne: null }, // Must have a category
        });

        log.info({ count: users.length }, "Found users for Viva interaction reminders");

        for (const user of users) {
            try {
                if (!user.FCM_token) continue;

                // Send Daily Interaction reminder
                await sendPushNotification({
                    token: user.FCM_token,
                    title: "Ask Viva \uD83D\uDCAC",
                    body: "Have a perinatal related question? Our chatbot Viva is here to help you every day! Tap to interact.",
                    data: {
                        type: "DAILY_VIVA_INTERACTION",
                    },
                });
            } catch (error) {
                log.error(
                    { error, userId: user._id },
                    "Failed to send Viva interaction reminder for user",
                );
            }
        }

        log.info("Daily Viva interaction reminder job completed");
    } catch (error) {
        log.error({ error }, "Daily Viva interaction reminder job failed");
    }
};
