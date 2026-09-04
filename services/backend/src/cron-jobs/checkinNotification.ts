import flowInstanceModel from "../models/flowInstance.model";
import UserModel from "../models/user.model";

import {
    CHECKIN_REMINDER_INTERVALS,
    WEEKLY_CHECKIN_SLUG,
    getCheckinNotification,
} from "../constants/chat";
import { entitlementService } from "../services/entitlements/entitlement.service";
import { FlowInstanceStateEnum } from "../types/chat.types";
import { ESubscriptionTier } from "../types/subscription.types";
import {
    calculatePostpartumState,
    daysLeftToAnswer,
    isCheckinEligibleWeek,
} from "../utils/functions/postpartumWeek";
import { resolveLanguage } from "../utils/i18n/localizeFlowDefinition";
import logger from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

export interface ICheckinNotificationResult {
    openCheckins: number;
    sent: number;
    skipped: number;
    errors: number;
}

/**
 * Nudge users whose weekly check-in is open and unfinished.
 *
 * Split out of the week calculation so it can run in the evening while the week rolls
 * over at midnight. It creates nothing and mutates nothing — if it fails or never runs,
 * the check-in is still open and the dashboard still shows it.
 *
 * Replaces `sendWeeklyCheckinReminders`, which was written, exported, and then wired to
 * nothing: no cron schedule and no HTTP route.
 */
export const checkinNotification = async (
    now: Date = new Date(),
): Promise<ICheckinNotificationResult> => {
    logger.info("Starting weekly check-in notification job");

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
        const openCheckins = await flowInstanceModel
            .find({
                flowSlug: WEEKLY_CHECKIN_SLUG,
                state: { $in: [FlowInstanceStateEnum.PENDING, FlowInstanceStateEnum.ACTIVE] },
            })
            .lean();

        logger.info({ count: openCheckins.length }, "Found open check-ins");

        for (const checkin of openCheckins) {
            try {
                const user = await UserModel.findById(checkin.userId).lean();

                if (!user?.FCM_token || !user.onboarding_data?.delivery_date) {
                    skipped++;
                    continue;
                }

                // Re-check the tier at send time. weekProgression skips FREE users, but a
                // subscription that lapses mid-week leaves an already-open instance
                // behind — and nudging her toward a check-in she can no longer open is
                // exactly the dead end this rework set out to remove.
                if (entitlementService.resolveTier(user, now) === ESubscriptionTier.FREE) {
                    skipped++;
                    continue;
                }

                const state = calculatePostpartumState(
                    user.onboarding_data.delivery_date as Date,
                    now,
                );

                // Only nudge about the week she is actually in. Older rows are closed by
                // `weekProgression`; this guards the window between the two jobs.
                if (state.mode !== "postpartum" || checkin.postpartumWeek !== state.weeks) {
                    skipped++;
                    continue;
                }

                // Past the end of the programme there is nothing to nudge toward — the
                // start endpoint would reject the week anyway. weekProgression stops
                // creating instances at the ceiling, so today this is belt and braces;
                // stated explicitly so it does not depend on that job's behaviour.
                if (!isCheckinEligibleWeek(state)) {
                    skipped++;
                    continue;
                }

                const dayInWeek = state.previousCheckinDueDays;
                const isOpeningDay = dayInWeek === 0;
                const isReminderDay = CHECKIN_REMINDER_INTERVALS.includes(dayInWeek);

                if (!isOpeningDay && !isReminderDay) {
                    skipped++;
                    continue;
                }

                const lang = resolveLanguage(user.preferred_language);
                const copy = getCheckinNotification(
                    isOpeningDay ? "NEW_CHECKIN" : "REMINDER",
                    lang,
                );

                await sendPushNotification({
                    token: user.FCM_token,
                    title: copy.title,
                    body: copy.body,
                    data: {
                        type: isOpeningDay ? "WEEKLY_CHECKIN" : "WEEKLY_CHECKIN_REMINDER",
                        // The app's deep-link handler routes on flowSlug; without it the
                        // notification opens the app but lands nowhere.
                        flowSlug: WEEKLY_CHECKIN_SLUG,
                        week: String(checkin.postpartumWeek),
                        flowInstanceId: checkin._id.toString(),
                        daysLeft: String(daysLeftToAnswer(state)),
                    },
                });

                sent++;
                logger.info(
                    { userId: user._id, week: checkin.postpartumWeek, dayInWeek },
                    isOpeningDay ? "Sent check-in opened notification" : "Sent check-in reminder",
                );
            } catch (error: any) {
                errors++;
                logger.error(
                    { error: error?.message, flowInstanceId: checkin._id },
                    "Failed to send check-in notification",
                );
            }
        }

        logger.info(
            { openCheckins: openCheckins.length, sent, skipped, errors },
            "Weekly check-in notification job completed",
        );

        return { openCheckins: openCheckins.length, sent, skipped, errors };
    } catch (error) {
        logger.error({ error }, "Weekly check-in notification job failed");
        throw error;
    }
};
