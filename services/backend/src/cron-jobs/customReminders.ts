import motherReminderModel from "../models/mother-reminder.model";
import UserModel from "../models/user.model";
import { notificationMessages } from "../constants/messages";
import { isDueOn, istClock, slotsToSend } from "../services/reminders/reminder-schedule";
import { FlowLanguageEnum } from "../types/chat.types";
import { IMotherReminder } from "../types/reminder.types";
import logger, { createModuleLogger } from "../utils/logger";
import { sendPushNotification } from "../utils/sendPushNotification";

const log = createModuleLogger(logger, "customReminders");

export interface ICustomReminderResult {
    due: number;
    sent: number;
    skipped: number;
    errors: number;
}

const pushText = (reminder: IMotherReminder, language: string | null | undefined) => {
    const copy =
        notificationMessages.CUSTOM_REMINDER[
            language === FlowLanguageEnum.HI ? FlowLanguageEnum.HI : FlowLanguageEnum.EN
        ][reminder.category];
    return {
        title: reminder.category === "other" ? (reminder.detail ?? copy.body) : copy.title,
        body: copy.body,
    };
};

/**
 * Pushes the reminders she set on the Reminders screen.
 *
 * Runs every 15 minutes. A reminder goes out once its slot time (REMINDER_SLOT_MINUTES)
 * has passed, at most REMINDER_SEND_TOLERANCE_MINUTES late, and only on days its
 * frequency covers.
 *
 * Each send is claimed first by moving `lastSentDate` to today with a conditional
 * update, the same claim-then-push order as consultationReminders: overlapping runs
 * never send twice, and a push that fails is lost rather than repeated.
 */
export const customReminders = async (now: Date = new Date()): Promise<ICustomReminderResult> => {
    log.info("Starting custom reminder job");

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
        const { today, minutes } = istClock(now);
        const slots = slotsToSend(minutes);
        if (!slots.length) {
            log.info({ minutes }, "No reminder slot is due");
            return { due: 0, sent, skipped, errors };
        }

        const candidates = (await motherReminderModel
            .find({
                timeOfDay: { $in: slots },
                lastSentDate: { $ne: today },
                startDate: { $lte: today },
                $or: [{ endDate: null }, { endDate: { $gte: today } }],
            })
            .lean()) as unknown as IMotherReminder[];

        const due = candidates.filter((reminder) => isDueOn(reminder, today));
        skipped += candidates.length - due.length;

        const users = await UserModel.find({ _id: { $in: due.map((r) => r.userId) } })
            .select("FCM_token preferred_language")
            .lean();
        const byId = new Map(users.map((user) => [String(user._id), user]));

        log.info({ slots, count: due.length }, "Found reminders due");

        for (const reminder of due) {
            try {
                const user = byId.get(String(reminder.userId));
                if (!user?.FCM_token) {
                    skipped++;
                    continue;
                }

                const claim = await motherReminderModel.updateOne(
                    { _id: reminder._id, lastSentDate: { $ne: today } },
                    { $set: { lastSentDate: today } },
                );
                if (claim.modifiedCount === 0) {
                    skipped++;
                    continue;
                }

                const delivered = await sendPushNotification({
                    token: user.FCM_token,
                    ...pushText(reminder, user.preferred_language),
                    data: {
                        type: "CUSTOM_REMINDER",
                        reminderId: String(reminder._id),
                        category: reminder.category,
                    },
                });

                // The helper logs and swallows send failures; count them as errors so
                // the run's result says what actually happened.
                if (!delivered) {
                    errors++;
                    continue;
                }
                sent++;
            } catch (error: any) {
                errors++;
                log.error(
                    { error: error?.message, reminderId: reminder._id },
                    "Failed to send custom reminder",
                );
            }
        }

        log.info({ due: due.length, sent, skipped, errors }, "Custom reminder job completed");
        return { due: due.length, sent, skipped, errors };
    } catch (error) {
        log.error({ error }, "Custom reminder job failed");
        throw error;
    }
};
