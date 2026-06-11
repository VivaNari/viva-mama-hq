import UserModel from "../models/user.model";
import logger from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

export const logsReminders = async (): Promise<void> => {
    logger.info("Starting daily logs reminder job");

    try {
        const users = await UserModel.find({
            FCM_token: { $exists: true, $ne: null },
            user_category: { $ne: null }, // Must have a category
        });

        logger.info({ count: users.length }, "Found users for log reminders");

        for (const user of users) {
            try {
                if (!user.FCM_token) continue;

                // Send Mood Log reminder
                await sendPushNotification({
                    token: user.FCM_token,
                    title: "Time to log your mood \uD83D\uDE0A",
                    body: "How are you feeling today? Tap to log your mood and let us know.",
                    data: {
                        type: "MOOD_LOG_REMINDER",
                    },
                });

                // Send Sleep Log reminder
                await sendPushNotification({
                    token: user.FCM_token,
                    title: "How did you sleep? \uD83D\uDE34",
                    body: "We hope you had a restful night. Tap to track your sleep now.",
                    data: {
                        type: "SLEEP_LOG_REMINDER",
                    },
                });

                logger.info({ userId: user._id }, "Sent daily log reminders");
            } catch (error) {
                logger.error({ error, userId: user._id }, "Failed to send log reminders for user");
            }
        }

        logger.info("Daily logs reminder job completed");
    } catch (error) {
        logger.error({ error }, "Daily logs reminder job failed");
    }
};
