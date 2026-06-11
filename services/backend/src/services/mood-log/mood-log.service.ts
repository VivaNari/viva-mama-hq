import moodLogModel from "../../models/mood-log.model";
import UserModel from "../../models/user.model";
import { IMoodLog } from "../../types/mood-log.types";
import { getISTCalendarDate } from "../date/date.service";
import BaseService from "../base.service";

class MoodLogService extends BaseService<IMoodLog> {
    constructor() {
        super(moodLogModel);
    }

    /**
     * Earliest calendar day a user may backdate a mood log to: the IST calendar
     * day they joined the platform (onboarding date, falling back to account
     * creation if onboarding date is not set). Returns null if user not found.
     */
    getBackdatingFloor = async (userId: string): Promise<Date | null> => {
        const user = await UserModel.findById(userId)
            .select("onboarding_data.onboarded_at createdAt")
            .lean();

        if (!user) return null;

        const joinedAt = user.onboarding_data?.onboarded_at ?? (user as any).createdAt;
        return getISTCalendarDate(new Date(joinedAt));
    };

    /**
     * Create the mood log for a given calendar day, or update it if one already
     * exists (one editable log per user per day).
     */
    upsertForDate = async ({
        userId,
        mood,
        logDate,
    }: {
        userId: string;
        mood: number;
        logDate: Date;
    }) => {
        return moodLogModel.findOneAndUpdate(
            { userId, logDate },
            { $set: { mood }, $setOnInsert: { userId, logDate } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
    };
}

export default MoodLogService;
