import flowDefinitionModel from "../models/flowDefinition.model";
import flowInstanceModel from "../models/flowInstance.model";
import UserModel from "../models/user.model";
import conversationModel from "../models/conversation.model";

import { IUser } from "../types";
import {
    FlowInstanceStateEnum,
    IFlowDefinition,
    IFlowInstance,
    WeeklyCheckinState,
} from "../types/chat.types";
import { calculateUserCurrentWeek } from "../utils/functions/calculateUserCurrentWeek";
import logger from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";
import { REMINDER_NOTIFICATION } from "../constants/chat";

// ============================================
// Constants
// ============================================

const WEEKLY_CHECKIN_SLUG = "weekly-checkin-v1";

// ============================================
// Validation
// ============================================

/**
 * Validate if user is eligible for weekly check-in
 */
const validateUser = (user: IUser): { isValid: boolean; reason?: string } => {
    if (!user.FCM_token) {
        return {
            isValid: false,
            reason: "No FCM token",
        };
    }

    if (!user.onboarding_data?.delivery_date) {
        return {
            isValid: false,
            reason: "No delivery date",
        };
    }

    // Must have completed onboarding
    if (!user.is_onboarded?.is_questionnaire_completed) {
        return {
            isValid: false,
            reason: "Onboarding not completed",
        };
    }

    return { isValid: true };
};

// ============================================
// Week Calculation
// ============================================

/**
 * Get user's current week and days
 */
const getUserWeekdays = (user: IUser): { weeks: number; days: number; mode: string } => {
    return calculateUserCurrentWeek(user.onboarding_data.delivery_date as Date);
};

/**
 * Format week and days as decimal (e.g., 5.3)
 */
const formatUserWeek = (weeks: number, days: number): number => {
    return Number(weeks + "." + days);
};

// ============================================
// Flow Instance Management
// ============================================

/**
 * Check if check-in already exists for a specific week
 */
const hasCheckinForWeek = async (userId: string, week: number): Promise<boolean> => {
    const existing = await flowInstanceModel.findOne({
        userId,
        flowSlug: WEEKLY_CHECKIN_SLUG,
        postpartumWeek: week,
    });
    return !!existing;
};

/**
 * Get recent flow instances for weekly check-in only
 */
const getRecentFlowInstances = async ({
    userInstance,
}: {
    userInstance: IUser;
}): Promise<{
    latestFlowInstance: IFlowInstance | null;
    previousFlowInstance: IFlowInstance | null;
}> => {
    // Get latest weekly check-in instance (filter by flowSlug)
    const latestFlowInstances = await flowInstanceModel
        .find({
            userId: userInstance._id,
            flowSlug: WEEKLY_CHECKIN_SLUG, // Only weekly check-in
        })
        .sort({ postpartumWeek: -1 }) // Sort by week, not _id
        .limit(1)
        .lean();

    // Get previous weekly check-in instance
    const previousFlowInstances = await flowInstanceModel
        .find({
            userId: userInstance._id,
            flowSlug: WEEKLY_CHECKIN_SLUG,
        })
        .sort({ postpartumWeek: -1 })
        .skip(1)
        .limit(1)
        .lean();

    const latestFlowInstance =
        latestFlowInstances.length > 0 ? (latestFlowInstances[0] as IFlowInstance) : null;

    const previousFlowInstance =
        previousFlowInstances.length > 0
            ? (previousFlowInstances[0] as IFlowInstance)
            : latestFlowInstance;

    return {
        latestFlowInstance,
        previousFlowInstance,
    };
};

/**
 * Get or create conversation for weekly check-in
 */
const getOrCreateConversation = async (user: IUser): Promise<string> => {
    let conversation = await conversationModel.findOne({
        userId: user._id,
        chatMode: "GUIDED_ONLY",
        "meta.tags": "check-in",
    });

    if (!conversation) {
        conversation = await conversationModel.create({
            userId: user._id,
            title: "Weekly Check-in",
            chatMode: "GUIDED_ONLY",
            lastMessageAt: new Date(),
            meta: {
                channel: "App",
                tags: ["check-in"],
            },
        });
        logger.info({ userId: user._id }, "Created new check-in conversation");
    }

    return conversation._id.toString();
};

/**
 * Create first flow instance for a new user
 */
const createFirstFlowInstance = async (
    user: IUser,
    flowDefinition: IFlowDefinition,
    week: number,
): Promise<IFlowInstance> => {
    const conversationId = await getOrCreateConversation(user);

    const newFlowInstance = await flowInstanceModel.create({
        userId: user._id,
        conversationId,
        flowDefId: flowDefinition._id,
        flowSlug: WEEKLY_CHECKIN_SLUG,
        version: flowDefinition.version,
        postpartumWeek: week,
        state: WeeklyCheckinState.PENDING, // PENDING until user clicks notification
        cursorNodeId: flowDefinition.startNodeId,
        variables: {},
        outcome: null,
    });

    logger.info(
        { userId: user._id, week, flowInstanceId: newFlowInstance._id },
        "Created first weekly check-in flow instance",
    );

    return newFlowInstance;
};

/**
 * Generate new flow instance for a new week with duplicate prevention
 */
const generateNewFlowInstance = async (
    user: IUser,
    latestFlowInstance: IFlowInstance,
    targetWeek: number,
    flowDefinition: IFlowDefinition,
): Promise<IFlowInstance | null> => {
    // DUPLICATE PREVENTION: Check if already exists for this week
    const existingForWeek = await hasCheckinForWeek(user._id.toString(), targetWeek);

    if (existingForWeek) {
        logger.debug(
            { userId: user._id, week: targetWeek },
            "Check-in already exists for this week, skipping creation",
        );
        return null;
    }

    // Create new instance with PENDING state
    const newFlowInstance = await flowInstanceModel.create({
        userId: user._id,
        conversationId: latestFlowInstance.conversationId,
        flowDefId: flowDefinition._id,
        flowSlug: WEEKLY_CHECKIN_SLUG,
        version: flowDefinition.version,
        postpartumWeek: targetWeek,
        state: WeeklyCheckinState.PENDING, // PENDING until user clicks notification
        cursorNodeId: flowDefinition.startNodeId,
        variables: {},
        outcome: null,
    });

    logger.info(
        { userId: user._id, week: targetWeek, flowInstanceId: newFlowInstance._id },
        "Created new weekly check-in flow instance",
    );

    return newFlowInstance;
};

/**
 * Update or create flow instance based on user's current week
 */
const updateFlowInstance = async (
    userInstance: IUser,
    weeks: number,
    days: number,
    flowDefinition: IFlowDefinition,
): Promise<{
    formattedUserWeek: number;
    latestPostpartumWeek: number;
    previousPostpartumWeek: number;
    latestFlowInstance: IFlowInstance;
    isNewInstance: boolean;
}> => {
    let { latestFlowInstance, previousFlowInstance } = await getRecentFlowInstances({
        userInstance,
    });

    const formattedUserWeek = formatUserWeek(weeks, days);
    let isNewInstance = false;

    // First time user - no previous check-in instances
    if (!latestFlowInstance) {
        logger.info({ userId: userInstance._id, week: weeks }, "First weekly check-in for user");

        latestFlowInstance = await createFirstFlowInstance(userInstance, flowDefinition, weeks);

        return {
            formattedUserWeek,
            latestPostpartumWeek: weeks,
            previousPostpartumWeek: weeks,
            latestFlowInstance,
            isNewInstance: true,
        };
    }

    let previousPostpartumWeek =
        previousFlowInstance?.postpartumWeek || latestFlowInstance.postpartumWeek;
    let latestPostpartumWeek = latestFlowInstance.postpartumWeek;

    // Check if we need to create a new instance for a new week
    if (formattedUserWeek > latestPostpartumWeek) {
        logger.debug(
            { userId: userInstance._id, formattedUserWeek, latestPostpartumWeek },
            "User week is greater than latest instance week",
        );

        previousPostpartumWeek = latestPostpartumWeek;
        const targetWeek = latestPostpartumWeek + 1;

        const newFlowInstance = await generateNewFlowInstance(
            userInstance,
            latestFlowInstance,
            targetWeek,
            flowDefinition,
        );

        if (newFlowInstance) {
            latestPostpartumWeek = newFlowInstance.postpartumWeek;
            previousFlowInstance = latestFlowInstance;
            latestFlowInstance = newFlowInstance;
            isNewInstance = true;
        }
    }

    return {
        formattedUserWeek,
        latestPostpartumWeek,
        previousPostpartumWeek,
        latestFlowInstance,
        isNewInstance,
    };
};

// ============================================
// Due Days Calculation
// ============================================

/**
 * Calculate upcoming and previous due days
 */
const calculateUpcomingAndPreviousDueDays = ({
    formattedUserWeek,
    previousPostpartumWeek,
    latestPostpartumWeek,
}: {
    formattedUserWeek: number;
    previousPostpartumWeek: number;
    latestPostpartumWeek: number;
}): { previousDays: number; upcomingDays: number } => {
    const previousDays = Number(
        (formattedUserWeek - previousPostpartumWeek == 1
            ? 0
            : formattedUserWeek - previousPostpartumWeek
        ).toFixed(1),
    );

    const upcomingDays = Number(
        (latestPostpartumWeek - formattedUserWeek - 0.3 < 0
            ? 0
            : latestPostpartumWeek - formattedUserWeek - 0.3
        ).toFixed(1),
    );

    return { previousDays, upcomingDays };
};

/**
 * Update user's due days in database
 */
const updateUserDueDays = async ({
    userInstance,
    previousCheckinDueDays,
    upcomingCheckinDueDays,
    weeks,
    days,
}: {
    userInstance: IUser;
    previousCheckinDueDays: number;
    upcomingCheckinDueDays: number;
    weeks: number;
    days: number;
}): Promise<IUser> => {
    await UserModel.findByIdAndUpdate(
        userInstance._id,
        {
            $set: {
                "current_weekdays.previous_checkin_due_days": previousCheckinDueDays,
                "current_weekdays.upcoming_checkin_due_days": upcomingCheckinDueDays,
                "current_weekdays.weeks": weeks,
                "current_weekdays.days": days,
            },
        },
        { new: true },
    );

    const updatedUserInstance = await UserModel.findById(userInstance._id).lean();
    if (!updatedUserInstance) {
        throw new Error("Failed to fetch updated user instance");
    }

    return updatedUserInstance;
};

// ============================================
// Push Notifications
// ============================================

/**
 * Fire weekly check-in push notification
 * Only fires when upcoming_checkin_due_days === 0
 */
const fireWeeklyCheckinPushNotification = async (
    userInstance: IUser,
    latestFlowInstance: IFlowInstance,
): Promise<boolean> => {
    // Only trigger when it's due (upcoming_checkin_due_days === 0)
    if (userInstance.current_weekdays.upcoming_checkin_due_days !== 0) {
        logger.debug(
            {
                userId: userInstance._id,
                upcomingDays: userInstance.current_weekdays.upcoming_checkin_due_days,
            },
            "Check-in not due yet, skipping notification",
        );
        return false;
    }

    // Don't send notification if already completed for this week
    if (latestFlowInstance.state === FlowInstanceStateEnum.COMPLETED) {
        logger.debug(
            { userId: userInstance._id, week: latestFlowInstance.postpartumWeek },
            "Check-in already completed for this week",
        );
        return false;
    }

    // Get flow definition for notification template
    const flowDefinition = await flowDefinitionModel.findById(latestFlowInstance.flowDefId);
    if (!flowDefinition) {
        logger.error({ flowDefId: latestFlowInstance.flowDefId }, "Flow definition not found");
        return false;
    }

    // Get notification template
    const notificationTemplate = flowDefinition.notificationTemplates?.find(
        (item) => item.notificationType === "NEW_FLOW_INSTANCE",
    );

    if (!notificationTemplate) {
        logger.warn({ flowDefId: flowDefinition._id }, "Notification template not found");
        return false;
    }

    // Send push notification with week info
    try {
        await sendPushNotification({
            token: userInstance.FCM_token,
            title: notificationTemplate.title!,
            body: notificationTemplate.body!,
            data: {
                type: "WEEKLY_CHECKIN",
                flowSlug: flowDefinition.slug,
                week: latestFlowInstance.postpartumWeek.toString(),
                flowInstanceId: latestFlowInstance._id.toString(),
            },
        });

        logger.info(
            {
                userId: userInstance._id,
                week: latestFlowInstance.postpartumWeek,
                flowInstanceId: latestFlowInstance._id,
            },
            "Weekly check-in push notification sent",
        );

        return true;
    } catch (error) {
        logger.error({ error, userId: userInstance._id }, "Failed to send push notification");
        return false;
    }
};

// ============================================
// Main Processing
// ============================================

/**
 * Process result for reporting
 */
interface ProcessUserResult {
    userId: string;
    processed: boolean;
    reason?: string;
    week?: number;
    notificationSent?: boolean;
    isNewInstance?: boolean;
}

/**
 * Process a single user for weekly check-in
 */
const processUser = async (userInstance: IUser): Promise<ProcessUserResult> => {
    const userId = userInstance._id.toString();

    // 1. Validate user
    const validation = validateUser(userInstance);
    if (!validation.isValid) {
        logger.debug({ userId, reason: validation.reason }, "User validation failed");
        return {
            userId,
            processed: false,
            reason: validation.reason as string,
        };
    }

    // 2. Get flow definition
    const flowDefinition = await flowDefinitionModel.findOne({
        slug: WEEKLY_CHECKIN_SLUG,
        status: "PUBLISHED",
    });

    if (!flowDefinition) {
        logger.error("Weekly check-in flow definition not found");
        return {
            userId,
            processed: false,
            reason: "Flow definition not found",
        };
    }

    // 3. Calculate user's current week
    const userWeekdays = getUserWeekdays(userInstance);

    // Skip if user is still pregnant (mode === "pregnancy")
    if (userWeekdays.mode === "pregnancy") {
        logger.debug({ userId }, "User is still pregnant, skipping weekly check-in");
        return {
            userId,
            processed: false,
            reason: "User still pregnant",
        };
    }

    // 4. Update or create flow instance
    const {
        formattedUserWeek,
        latestPostpartumWeek,
        previousPostpartumWeek,
        latestFlowInstance,
        isNewInstance,
    } = await updateFlowInstance(
        userInstance,
        userWeekdays.weeks,
        userWeekdays.days,
        flowDefinition,
    );

    // 5. Calculate due days
    const { previousDays, upcomingDays } = calculateUpcomingAndPreviousDueDays({
        formattedUserWeek,
        previousPostpartumWeek,
        latestPostpartumWeek,
    });

    logger.debug(
        {
            userId,
            formattedUserWeek,
            previousDays,
            upcomingDays,
            latestPostpartumWeek,
        },
        "Calculated due days",
    );

    // 6. Update user's due days
    const updatedUserInstance = await updateUserDueDays({
        userInstance,
        previousCheckinDueDays: previousDays,
        upcomingCheckinDueDays: upcomingDays,
        weeks: userWeekdays.weeks,
        days: userWeekdays.days,
    });

    // 7. Send notification if due
    const notificationSent = await fireWeeklyCheckinPushNotification(
        updatedUserInstance,
        latestFlowInstance,
    );

    return {
        userId,
        processed: true,
        week: latestPostpartumWeek,
        notificationSent,
        isNewInstance,
    };
};

// ============================================
// Cron Job Entry Point
// ============================================

/**
 * Cron job result for monitoring
 */
interface CronJobResult {
    processedCount: number;
    skippedCount: number;
    errorCount: number;
    notificationsSent: number;
    newInstancesCreated: number;
    results: ProcessUserResult[];
}

/**
 * Main cron job: Calculate current week and trigger weekly check-ins
 *
 * Should be scheduled to run daily (e.g., every day at 9 AM)
 *
 * Example with node-cron:
 * cron.schedule('0 9 * * *', currentWeekAndPreviousUpcomingDueDaysCalculator);
 */
export const currentWeekAndPreviousUpcomingDueDaysCalculator = async (): Promise<CronJobResult> => {
    logger.info("Starting weekly check-in cron job");

    const results: ProcessUserResult[] = [];
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let notificationsSent = 0;
    let newInstancesCreated = 0;

    try {
        // Get all users with FCM tokens
        const userInstances = await UserModel.find({
            FCM_token: { $exists: true, $ne: null },
        });

        logger.info({ userCount: userInstances.length }, "Processing users for weekly check-in");

        for (const userInstance of userInstances) {
            try {
                const result = await processUser(userInstance);
                results.push(result);

                if (result.processed) {
                    processedCount++;
                    if (result.notificationSent) {
                        notificationsSent++;
                    }
                    if (result.isNewInstance) {
                        newInstancesCreated++;
                    }
                } else {
                    skippedCount++;
                }
            } catch (error: any) {
                errorCount++;
                logger.error(
                    { error: error.message, userId: userInstance._id },
                    "Failed to process user",
                );
                results.push({
                    userId: userInstance._id.toString(),
                    processed: false,
                    reason: error.message,
                });
            }
        }

        const summary: CronJobResult = {
            processedCount,
            skippedCount,
            errorCount,
            notificationsSent,
            newInstancesCreated,
            results,
        };

        logger.info(
            {
                processedCount,
                skippedCount,
                errorCount,
                notificationsSent,
                newInstancesCreated,
                totalUsers: userInstances.length,
            },
            "Weekly check-in cron job completed",
        );

        return summary;
    } catch (error) {
        logger.error({ error }, "Weekly check-in cron job failed");
        throw error;
    }
};

/**
 * Send reminders for incomplete check-ins
 *
 * Should be scheduled to run later in the day (e.g., 6 PM)
 *
 * Example with node-cron:
 * cron.schedule('0 18 * * *', sendWeeklyCheckinReminders);
 */
export const sendWeeklyCheckinReminders = async (): Promise<void> => {
    logger.info("Starting weekly check-in reminder job");

    try {
        // Find all PENDING or ACTIVE check-ins that haven't been completed
        const incompleteCheckins = await flowInstanceModel
            .find({
                flowSlug: WEEKLY_CHECKIN_SLUG,
                state: { $in: [WeeklyCheckinState.PENDING, FlowInstanceStateEnum.ACTIVE] },
            })
            .lean();

        logger.info({ count: incompleteCheckins.length }, "Found incomplete check-ins");

        const flowDefinition = await flowDefinitionModel.findOne({
            slug: WEEKLY_CHECKIN_SLUG,
            status: "PUBLISHED",
        });

        if (!flowDefinition) {
            logger.error("Flow definition not found for reminders");
            return;
        }

        for (const checkin of incompleteCheckins) {
            try {
                const user = await UserModel.findById(checkin.userId);
                if (!user?.FCM_token) continue;

                // Calculate days since creation
                const daysSinceCreated = Math.floor(
                    (Date.now() - new Date(checkin.createdAt!).getTime()) / (1000 * 60 * 60 * 24),
                );

                // Send reminder on day 1, 3, 5 (configurable)
                if ([1, 3, 5].includes(daysSinceCreated)) {
                    // AFTER (simple)
                    await sendPushNotification({
                        token: user.FCM_token,
                        title: REMINDER_NOTIFICATION.title,
                        body: REMINDER_NOTIFICATION.body,
                        data: {
                            type: "WEEKLY_CHECKIN_REMINDER",
                            flowSlug: WEEKLY_CHECKIN_SLUG,
                            week: checkin.postpartumWeek.toString(),
                            flowInstanceId: checkin._id.toString(),
                        },
                    });

                    logger.info(
                        {
                            userId: user._id,
                            week: checkin.postpartumWeek,
                            daysSinceCreated,
                        },
                        "Sent check-in reminder",
                    );
                }
            } catch (error) {
                logger.error({ error, flowInstanceId: checkin._id }, "Failed to send reminder");
            }
        }

        logger.info("Weekly check-in reminder job completed");
    } catch (error) {
        logger.error({ error }, "Weekly check-in reminder job failed");
    }
};
