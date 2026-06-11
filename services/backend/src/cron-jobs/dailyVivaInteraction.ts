import UserModel from "../models/user.model";
import logger from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

export const dailyVivaInteraction = async (): Promise<void> => {
    logger.info("Starting daily Viva interaction reminder job");

    try {
        const users = await UserModel.find({
            FCM_token: { $exists: true, $ne: null },
            user_category: { $ne: null }, // Must have a category
        });

        logger.info({ count: users.length }, "Found users for Viva interaction reminders");

        for (const user of users) {
            try {
                if (!user.FCM_token) continue;

                // Send Daily Interaction reminder
                await sendPushNotification({
                    token: user.FCM_token,
                    title: "Ask Viva \uD83D\uDCAC",
                    body: "Have a postpartum related question? Our chatbot Viva is here to help you every day! Tap to interact.",
                    data: {
                        type: "DAILY_VIVA_INTERACTION",
                    },
                });
            } catch (error) {
                logger.error(
                    { error, userId: user._id },
                    "Failed to send Viva interaction reminder for user",
                );
            }
        }

        logger.info("Daily Viva interaction reminder job completed");
    } catch (error) {
        logger.error({ error }, "Daily Viva interaction reminder job failed");
    }
};
