import motherReminderModel from "../../models/mother-reminder.model";
import UserModel from "../../models/user.model";
import {
    IMotherReminder,
    MAX_ACTIVE_REMINDERS,
    parseReminderTime,
    TReminderCategory,
    TReminderFrequency,
} from "../../types/reminder.types";
import { ECareModel } from "../../types/user.types";
import { addDays, istClock } from "./reminder-schedule";

export interface ICreateReminderInput {
    category: TReminderCategory;
    detail?: string;
    /** "HH:MM", 24-hour, IST. */
    time: string;
    frequency: TReminderFrequency;
    weekdays?: number[];
    /** "YYYY-MM-DD", for "once" only; defaults to today. */
    date?: string;
    /** Null or absent: ongoing. Not for "once". */
    endWeeks?: number | null;
}

export type TCreateReminderResult =
    | { result: "ok"; reminder: IMotherReminder }
    | { result: "limit" }
    | { result: "in_past" };

/** Not ended yet: ongoing, or ending today or later. */
const notEnded = (today: string) => ({ $or: [{ endDate: null }, { endDate: { $gte: today } }] });

/**
 * Her reminders. Repeating reminders always start today (IST), set here rather than by
 * the app; a one-time reminder is for one day, today or later. An ended reminder stays
 * in the collection but no longer shows or sends.
 */
export default class ReminderService {
    /** Reminders that have not ended, oldest first. */
    list = async (userId: string, now: Date = new Date()): Promise<IMotherReminder[]> => {
        const { today } = istClock(now);
        return (await motherReminderModel
            .find({ userId, ...notEnded(today) })
            .sort({ createdAt: 1 })
            .lean()) as unknown as IMotherReminder[];
    };

    create = async (
        userId: string,
        input: ICreateReminderInput,
        now: Date = new Date(),
    ): Promise<TCreateReminderResult> => {
        const { today, minutes } = istClock(now);
        const timeMinutes = parseReminderTime(input.time) as number;
        const once = input.frequency === "once";
        const day = once ? (input.date ?? today) : today;

        // A one-time reminder whose moment has gone would never send.
        if (once && (day < today || (day === today && timeMinutes <= minutes))) {
            return { result: "in_past" };
        }

        const active = await motherReminderModel.countDocuments({ userId, ...notEnded(today) });
        if (active >= MAX_ACTIVE_REMINDERS) return { result: "limit" };

        const user = await UserModel.findById(userId).select("onboarding_data.care_model").lean();

        const doc = await motherReminderModel.create({
            userId,
            category: input.category,
            detail: input.category === "other" ? (input.detail ?? "").trim() : null,
            timeMinutes,
            frequency: input.frequency,
            weekdays: input.frequency === "custom" ? [...new Set(input.weekdays ?? [])].sort() : [],
            startDate: day,
            // "Ends in 4 weeks" covers 28 days including today.
            endDate: once ? day : input.endWeeks ? addDays(today, input.endWeeks * 7 - 1) : null,
            careModel: (user?.onboarding_data?.care_model as ECareModel | null) ?? null,
            // A repeating reminder whose time already passed today starts tomorrow,
            // rather than firing the moment the next job runs.
            lastSentDate: !once && timeMinutes <= minutes ? today : null,
        });

        return { result: "ok", reminder: doc.toObject() as unknown as IMotherReminder };
    };

    /** False when there is no such reminder of hers. */
    remove = async (userId: string, id: string): Promise<boolean> => {
        const result = await motherReminderModel.deleteOne({ _id: id, userId });
        return result.deletedCount === 1;
    };
}
