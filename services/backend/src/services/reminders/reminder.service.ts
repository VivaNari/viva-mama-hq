import motherReminderModel from "../../models/mother-reminder.model";
import UserModel from "../../models/user.model";
import {
    IMotherReminder,
    MAX_ACTIVE_REMINDERS,
    TReminderCategory,
    TReminderFrequency,
    TReminderTime,
} from "../../types/reminder.types";
import { ECareModel } from "../../types/user.types";
import { addDays, istClock, slotPassed } from "./reminder-schedule";

export interface ICreateReminderInput {
    category: TReminderCategory;
    detail?: string;
    timeOfDay: TReminderTime;
    frequency: TReminderFrequency;
    weekdays?: number[];
    /** Null or absent: ongoing. */
    endWeeks?: number | null;
}

/**
 * Her reminders. Start dates are always today (IST) and are set here, not by the app;
 * an expired reminder (end date passed) stays in the collection but no longer shows or
 * sends.
 */
export default class ReminderService {
    /** Reminders that have not ended, oldest first. */
    list = async (userId: string, now: Date = new Date()): Promise<IMotherReminder[]> => {
        const { today } = istClock(now);
        return (await motherReminderModel
            .find({ userId, $or: [{ endDate: null }, { endDate: { $gte: today } }] })
            .sort({ createdAt: 1 })
            .lean()) as unknown as IMotherReminder[];
    };

    /** Returns null when she already has the maximum number of reminders. */
    create = async (
        userId: string,
        input: ICreateReminderInput,
        now: Date = new Date(),
    ): Promise<IMotherReminder | null> => {
        const { today, minutes } = istClock(now);

        const active = await motherReminderModel.countDocuments({
            userId,
            $or: [{ endDate: null }, { endDate: { $gte: today } }],
        });
        if (active >= MAX_ACTIVE_REMINDERS) return null;

        const user = await UserModel.findById(userId).select("onboarding_data.care_model").lean();

        const doc = await motherReminderModel.create({
            userId,
            category: input.category,
            detail: input.category === "other" ? (input.detail ?? "").trim() : null,
            timeOfDay: input.timeOfDay,
            frequency: input.frequency,
            weekdays: input.frequency === "custom" ? [...new Set(input.weekdays ?? [])].sort() : [],
            startDate: today,
            // "Ends in 4 weeks" covers 28 days including today.
            endDate: input.endWeeks ? addDays(today, input.endWeeks * 7 - 1) : null,
            careModel: (user?.onboarding_data?.care_model as ECareModel | null) ?? null,
            // A slot already past today starts tomorrow, rather than firing the moment
            // the next job runs.
            lastSentDate: slotPassed(input.timeOfDay, minutes) ? today : null,
        });

        return doc.toObject() as unknown as IMotherReminder;
    };

    /** False when there is no such reminder of hers. */
    remove = async (userId: string, id: string): Promise<boolean> => {
        const result = await motherReminderModel.deleteOne({ _id: id, userId });
        return result.deletedCount === 1;
    };
}
