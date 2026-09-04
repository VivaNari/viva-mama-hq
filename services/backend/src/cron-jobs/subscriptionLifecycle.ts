import subscriptionModel from "../models/subscription.model";
import UserModel from "../models/user.model";
import { subscriptionService } from "../services/subscription/subscription.service";
import {
    EBillingMode,
    ESubscriptionGrantSource,
    ESubscriptionStatus,
    ISubscription,
} from "../types/subscription.types";
import logger from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

export interface SubscriptionLifecycleResult {
    expired: number;
    remindersSent: number;
    failures: number;
}

/** Days before the end at which we nudge the user. */
const TRIAL_REMINDER_DAYS_LEFT = [2, 0];
const RENEWAL_REMINDER_DAYS_LEFT = [3, 1];

function startOfUtcDay(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole days from `now` to `target`, by calendar day rather than elapsed hours. */
function daysUntil(target: Date, now: Date): number {
    return Math.round((startOfUtcDay(target) - startOfUtcDay(now)) / 86_400_000);
}

/**
 * Daily subscription lifecycle sweep.
 *
 * Retires lapsed trials and terms, expires unconsumed credits, and sends the reminders
 * around each boundary.
 *
 * IMPORTANT: access control does NOT depend on this job. EntitlementService re-derives
 * the tier from the subscription dates on every request, so a run that is late, skipped
 * or failed delays notifications and leaves a stale snapshot — it never grants a user
 * access they should not have. That is deliberate: a cron is not a security boundary.
 */
export const subscriptionLifecycle = async (
    now: Date = new Date(),
): Promise<SubscriptionLifecycleResult> => {
    const result: SubscriptionLifecycleResult = { expired: 0, remindersSent: 0, failures: 0 };

    // 1. Retire anything whose trial or paid period has elapsed.
    const expirable = await subscriptionService.findExpirable(now);
    console.log("expirable", expirable);
    for (const subscription of expirable) {
        try {
            await subscriptionService.expire(subscription, now);
            result.expired += 1;
        } catch (error) {
            result.failures += 1;
            // Keep going: one bad row must not block every other user's expiry.
            logger.error(
                { error, subscriptionId: subscription._id },
                "Failed to expire subscription",
            );
        }
    }

    // 2. Reminders for boundaries still ahead.
    const upcoming = (await subscriptionModel
        .find({
            isCurrent: true,
            status: {
                $in: [
                    ESubscriptionStatus.TRIALING,
                    ESubscriptionStatus.ACTIVE,
                    ESubscriptionStatus.HALTED,
                ],
            },
        })
        .lean()) as ISubscription[];

    for (const subscription of upcoming) {
        try {
            const sent = await sendReminderIfDue(subscription, now);
            if (sent) result.remindersSent += 1;
        } catch (error) {
            result.failures += 1;
            logger.error(
                { error, subscriptionId: subscription._id },
                "Failed to send subscription reminder",
            );
        }
    }

    logger.info(result, "Subscription lifecycle sweep complete");
    return result;
};

async function sendReminderIfDue(subscription: ISubscription, now: Date): Promise<boolean> {
    const isTrial = subscription.status === ESubscriptionStatus.TRIALING;
    const boundary = isTrial ? subscription.trialEndAt : subscription.currentPeriodEnd;
    if (!boundary) return false;

    const daysLeft = daysUntil(boundary, now);
    const schedule = isTrial ? TRIAL_REMINDER_DAYS_LEFT : RENEWAL_REMINDER_DAYS_LEFT;
    if (!schedule.includes(daysLeft)) return false;

    const user = await UserModel.findById(subscription.user_id).select("FCM_token").lean();
    if (!user?.FCM_token) return false;

    // The copy has to match what will actually happen, and that depends on the mode
    // stamped on THIS row — not on the current env value. Telling a MANUAL trial user
    // they are about to be charged would be simply false; they have no card on file.
    const willAutoCharge = subscription.billingMode === EBillingMode.AUTOPAY;

    let title: string;
    let body: string;

    if (isTrial) {
        title = daysLeft === 0 ? "Your free trial ends today" : "Your free trial is ending soon";
        body = willAutoCharge
            ? "Your subscription starts automatically when the trial ends. Cancel any time before then."
            : "Subscribe to keep your check-ins, unlimited Viva chat and full content library.";
    } else if (subscription.grantSource === ESubscriptionGrantSource.REFERRAL) {
        // A granted term has no payment and no mandate behind it, so neither renewal
        // copy is true — "renews automatically" is plainly false, and "renew" implies
        // she paid for it once. She still needs telling, though: this is the one
        // notification that turns a lapsing free term into a decision.
        title = "Your complimentary access is ending soon";
        body = "Subscribe to keep your check-ins, consultations and full content library.";
    } else {
        title = "Your subscription is ending soon";
        body = willAutoCharge
            ? "Your plan renews automatically. Manage it any time in your profile."
            : "Renew to keep your premium features without interruption.";
    }

    await sendPushNotification({
        token: user.FCM_token,
        title,
        body,
        data: {
            type: "SUBSCRIPTION_REMINDER",
            subscriptionId: String(subscription._id),
            daysLeft: String(daysLeft),
        },
    });

    return true;
}
