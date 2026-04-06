import UserModel from "../models/user.model";
import contentModel from "../models/content.model";
import logger from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

export const weeklyContentNotification = async (): Promise<void> => {
    logger.info("Starting weekly content notification job");

    try {
        const users = await UserModel.find({
            FCM_token: { $exists: true, $ne: null },
            user_category: { $ne: null }, // Must have a category
        });

        logger.info({ count: users.length }, "Found users for weekly content notifications");

        for (const user of users) {
            try {
                if (!user.FCM_token || !user.user_category) continue;

                // Get user current week (fallback to 1 if not set)
                const currentWeek = user.current_weekdays.weeks || 1;

                // Find content matching user category and current week
                const content = await contentModel
                    .findOne({
                        category: user.user_category,
                        validWeekStart: { $lte: currentWeek },
                        validWeekEnd: { $gte: currentWeek },
                    })
                    .sort({ createdAt: -1 }); // Get latest matching content

                if (content) {
                    await sendPushNotification({
                        token: user.FCM_token,
                        title: "New relevant content for this week \uD83D\uDCD6",
                        body:
                            content.featuredTitle ||
                            "Check out our latest recommended read for your current week.",
                        data: {
                            type: "WEEKLY_CONTENT_NOTIFICATION",
                            contentId: content._id.toString(),
                        },
                    });

                    logger.info(
                        { userId: user._id, contentId: content._id },
                        "Sent weekly content notification for user",
                    );
                } else {
                    logger.debug(
                        { userId: user._id, category: user.user_category, week: currentWeek },
                        "No valid content found for user this week",
                    );
                }
            } catch (error) {
                logger.error(
                    { error, userId: user._id },
                    "Failed to send weekly content notification for user",
                );
            }
        }

        logger.info("Weekly content notification job completed");
    } catch (error) {
        logger.error({ error }, "Weekly content notification job failed");
    }
};
