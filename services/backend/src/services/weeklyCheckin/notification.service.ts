import admin from "../../config/firebase";
import { sendPushNotification } from "../../utils/sendPushNotification";
import { IFlowDefinition, IFlowInstance, IFlowNode } from "../../types/chat.types";
import { IUser } from "../../types";
import { WEEKLY_CHECKIN_NOTIFICATIONS, CHECKIN_SSE_EVENTS } from "../../constants/chat";
import logger from "../../utils/logger";

/**
 * Silent push payload
 */
interface SilentPushPayload {
    type: string;
    questionData: string;
}

/**
 * NotificationService - Single Responsibility: Handle push notifications
 *
 * Features:
 * - Send new check-in notifications
 * - Send reminder notifications
 * - Send silent push for pending questions
 */
class NotificationService {
    // ============================================
    // Standard Notifications
    // ============================================

    /**
     * Send new check-in available notification
     */
    async sendNewCheckinNotification(
        user: IUser,
        week: number,
        flowInstanceId: string,
    ): Promise<boolean> {
        if (!user.FCM_token) {
            logger.warn({ userId: user._id }, "No FCM token for new check-in notification");
            return false;
        }

        try {
            await sendPushNotification({
                token: user.FCM_token,
                title: WEEKLY_CHECKIN_NOTIFICATIONS.NEW_CHECKIN.title,
                body: WEEKLY_CHECKIN_NOTIFICATIONS.NEW_CHECKIN.body,
                data: {
                    type: "WEEKLY_CHECKIN",
                    week: week.toString(),
                    flowInstanceId,
                },
            });

            logger.info(
                { userId: user._id, week, flowInstanceId },
                "New check-in notification sent",
            );

            return true;
        } catch (error) {
            logger.error({ error, userId: user._id }, "Failed to send new check-in notification");
            return false;
        }
    }

    /**
     * Send reminder notification
     */
    async sendReminderNotification(
        user: IUser,
        week: number,
        flowInstanceId: string,
    ): Promise<boolean> {
        if (!user.FCM_token) {
            logger.warn({ userId: user._id }, "No FCM token for reminder notification");
            return false;
        }

        try {
            await sendPushNotification({
                token: user.FCM_token,
                title: WEEKLY_CHECKIN_NOTIFICATIONS.REMINDER.title,
                body: WEEKLY_CHECKIN_NOTIFICATIONS.REMINDER.body,
                data: {
                    type: "WEEKLY_CHECKIN_REMINDER",
                    week: week.toString(),
                    flowInstanceId,
                },
            });

            logger.info({ userId: user._id, week, flowInstanceId }, "Reminder notification sent");

            return true;
        } catch (error) {
            logger.error({ error, userId: user._id }, "Failed to send reminder notification");
            return false;
        }
    }

    /**
     * Send completion notification
     */
    async sendCompletionNotification(user: IUser, week: number): Promise<boolean> {
        if (!user.FCM_token) {
            return false;
        }

        try {
            await sendPushNotification({
                token: user.FCM_token,
                title: WEEKLY_CHECKIN_NOTIFICATIONS.COMPLETED.title,
                body: WEEKLY_CHECKIN_NOTIFICATIONS.COMPLETED.body,
                data: {
                    type: "WEEKLY_CHECKIN_COMPLETED",
                    week: week.toString(),
                },
            });

            logger.info({ userId: user._id, week }, "Completion notification sent");

            return true;
        } catch (error) {
            logger.error({ error, userId: user._id }, "Failed to send completion notification");
            return false;
        }
    }

    // ============================================
    // Silent Push Notifications
    // ============================================

    /**
     * Build question payload for silent push
     */
    private buildQuestionPayload(
        node: IFlowNode,
        flowInstance: IFlowInstance,
        week: number,
    ): object {
        return {
            type: CHECKIN_SSE_EVENTS.QUESTION,
            id: node.id,
            flowInstanceId: flowInstance._id.toString(),
            week,
            text: node.text || "",
            educationalMessage: node.educationalMessage || "",
            whyThisMatters: node.whyThisMatters || "",
            options: node.options.map((opt) => ({
                id: opt.value,
                label: opt.label,
                value: opt.value,
                score: opt.score,
            })),
            nodeType: node.nodeType,
        };
    }

    /**
     * Send silent push notification for pending question
     * This allows the app to fetch the question when user returns
     */
    async sendSilentPush(
        user: IUser,
        flowInstance: IFlowInstance,
        currentNode: IFlowNode,
        week: number,
    ): Promise<boolean> {
        if (!user.FCM_token) {
            logger.warn({ userId: user._id }, "No FCM token for silent push");
            return false;
        }

        try {
            const questionPayload = this.buildQuestionPayload(currentNode, flowInstance, week);

            const message = {
                data: {
                    type: "NEW_CHECKIN_QUESTION",
                    questionData: JSON.stringify(questionPayload),
                },
                token: user.FCM_token,
                apns: {
                    headers: {
                        "apns-push-type": "background",
                        "apns-priority": "5",
                    },
                    payload: {
                        aps: {
                            "content-available": 1,
                        },
                    },
                },
                android: {
                    priority: "high" as const,
                },
            };

            await admin!.messaging().send(message);

            logger.info({ userId: user._id, nodeId: currentNode.id, week }, "Silent push sent");

            return true;
        } catch (error) {
            logger.error({ error, userId: user._id }, "Failed to send silent push");
            return false;
        }
    }

    // ============================================
    // Batch Notifications
    // ============================================

    /**
     * Send notifications to multiple users
     */
    async sendBatchNotifications(
        users: Array<{ user: IUser; week: number; flowInstanceId: string }>,
        type: "new" | "reminder",
    ): Promise<{ sent: number; failed: number }> {
        let sent = 0;
        let failed = 0;

        for (const { user, week, flowInstanceId } of users) {
            const success =
                type === "new"
                    ? await this.sendNewCheckinNotification(user, week, flowInstanceId)
                    : await this.sendReminderNotification(user, week, flowInstanceId);

            if (success) {
                sent++;
            } else {
                failed++;
            }
        }

        logger.info({ type, sent, failed, total: users.length }, "Batch notifications complete");

        return { sent, failed };
    }
}

export default NotificationService;
