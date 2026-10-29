import { Types } from "mongoose";

import motherLogModel from "../../models/mother-log.model";
import motherMedicineModel from "../../models/mother-medicine.model";
import UserModel from "../../models/user.model";
import {
    APPEND_LOG_TYPES,
    IMotherLog,
    IMotherMedicine,
    KICK_GOAL,
    TAppendLogType,
    TDailyLogType,
    TLogSource,
    TMedicineFrequency,
    TMedicinePreset,
    TMotherLogType,
} from "../../types/mother-log.types";
import { ECareModel, EUserCategory } from "../../types/user.types";
import BaseService from "../base.service";
import { getISTCalendarDate } from "../date/date.service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DUPLICATE_KEY = 11000;

/** What a log is stamped with, and what reads need (height for BMI). */
export interface MotherContext {
    careModel: ECareModel | null;
    stage: EUserCategory | null;
    heightCm: number | null;
}

/** BMI to one decimal, or null when her height is not recorded. */
export const bmiFor = (weightKg: number, heightCm: number | null): number | null => {
    if (!heightCm) return null;
    const heightM = heightCm / 100;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
};

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === DUPLICATE_KEY;

class MotherLogService extends BaseService<IMotherLog> {
    constructor() {
        super(motherLogModel);
    }

    /** Her care route, stage and height, read fresh so a log never stamps a stale route. */
    getContext = async (userId: string): Promise<MotherContext> => {
        const user = await UserModel.findById(userId)
            .select("user_category onboarding_data.care_model onboarding_data.height_cm")
            .lean();

        return {
            careModel: (user?.onboarding_data?.care_model as ECareModel | null) ?? null,
            stage: (user?.user_category as EUserCategory | null) ?? null,
            heightCm: user?.onboarding_data?.height_cm ?? null,
        };
    };

    list = async ({
        userId,
        types,
        from,
        to,
        limit,
    }: {
        userId: string;
        types?: TMotherLogType[];
        from?: Date | undefined;
        to?: Date | undefined;
        limit: number;
    }): Promise<IMotherLog[]> => {
        const filter: Record<string, any> = { userId };
        // Toggle types are read through their own endpoints, never as history rows.
        filter.logType = { $in: types?.length ? types : [...APPEND_LOG_TYPES, "water", "kicks"] };
        if (from || to) {
            filter.logDate = {};
            if (from) filter.logDate.$gte = from;
            if (to) filter.logDate.$lte = to;
        }

        const logs = await motherLogModel
            .find(filter)
            .sort({ logDate: -1, loggedAt: -1 })
            .limit(limit)
            .lean();
        return logs as unknown as IMotherLog[];
    };

    append = async ({
        userId,
        logType,
        fields,
        loggedAt,
        source,
        context,
    }: {
        userId: string;
        logType: TAppendLogType;
        fields: Record<string, any>;
        loggedAt: Date;
        source: TLogSource;
        context: MotherContext;
    }) =>
        motherLogModel.create({
            userId,
            logType,
            fields,
            loggedAt,
            logDate: getISTCalendarDate(loggedAt),
            source,
            careModel: context.careModel,
            stage: context.stage,
        });

    /**
     * Set today's running total for a tap counter (water glasses, baby kicks).
     *
     * The client sends the total rather than "+1" so a retried request cannot count a
     * tap twice. Kicks also remember when the count first reached the goal: the time
     * taken to feel ten movements is what a clinician asks about.
     */
    upsertDaily = async ({
        userId,
        logType,
        fields,
        source,
        context,
    }: {
        userId: string;
        logType: TDailyLogType;
        fields: Record<string, any>;
        source: TLogSource;
        context: MotherContext;
    }) => {
        const now = new Date();
        const logDate = getISTCalendarDate(now);
        const filter = { userId, logType, logDate, isDailyTotal: true };

        const write = async () => {
            const existing = await motherLogModel.findOne(filter).lean();
            const nextFields: Record<string, any> = { ...fields };

            if (logType === "kicks") {
                const reachedAt = existing?.fields?.goalReachedAt ?? null;
                nextFields.goalReachedAt =
                    reachedAt ?? (fields.count >= KICK_GOAL ? now : null);
            }

            return motherLogModel.findOneAndUpdate(
                filter,
                {
                    $set: { fields: nextFields, loggedAt: now, source },
                    $setOnInsert: {
                        userId,
                        logType,
                        logDate,
                        isDailyTotal: true,
                        careModel: context.careModel,
                        stage: context.stage,
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true },
            );
        };

        try {
            return await write();
        } catch (err) {
            // Two first taps of the day raced to insert; the loser just updates.
            if (isDuplicateKey(err)) return write();
            throw err;
        }
    };

    findOwn = async (userId: string, id: string): Promise<IMotherLog | null> =>
        (await motherLogModel.findOne({ _id: id, userId }).lean()) as unknown as IMotherLog | null;

    deleteById = async (userId: string, id: string) =>
        motherLogModel.deleteOne({ _id: id, userId });

    // ── ANC schedule ────────────────────────────────────────────────────────────

    ancScheduleDone = async (userId: string): Promise<string[]> => {
        const ticks = await motherLogModel
            .find({ userId, logType: "anc_schedule_item" })
            .select("fields.itemId")
            .lean();
        return ticks.map((tick) => tick.fields.itemId as string);
    };

    setScheduleItem = async ({
        userId,
        itemId,
        done,
        context,
    }: {
        userId: string;
        itemId: string;
        done: boolean;
        context: MotherContext;
    }) => {
        const filter = { userId, logType: "anc_schedule_item", "fields.itemId": itemId };

        if (!done) {
            await motherLogModel.deleteOne(filter);
            return;
        }

        const now = new Date();
        try {
            await motherLogModel.updateOne(
                filter,
                {
                    // `fields.itemId` comes from the filter's equality on insert.
                    $setOnInsert: {
                        userId,
                        logType: "anc_schedule_item",
                        loggedAt: now,
                        logDate: getISTCalendarDate(now),
                        source: "manual",
                        careModel: context.careModel,
                        stage: context.stage,
                    },
                },
                { upsert: true },
            );
        } catch (err) {
            // Ticked twice at once: it is ticked, which is what was asked.
            if (!isDuplicateKey(err)) throw err;
        }
    };

    // ── Medicines ───────────────────────────────────────────────────────────────

    listMedicines = async (userId: string): Promise<IMotherMedicine[]> =>
        (await motherMedicineModel
            .find({ userId, active: true })
            .sort({ createdAt: 1 })
            .lean()) as unknown as IMotherMedicine[];

    findOwnMedicine = async (userId: string, id: string): Promise<IMotherMedicine | null> =>
        (await motherMedicineModel
            .findOne({ _id: id, userId, active: true })
            .lean()) as unknown as IMotherMedicine | null;

    addMedicine = async ({
        userId,
        presetKey,
        name,
        frequency,
    }: {
        userId: string;
        presetKey: TMedicinePreset | null;
        name: string | null;
        frequency: TMedicineFrequency;
    }) => motherMedicineModel.create({ userId, presetKey, name, frequency });

    /** Ids of the medicines marked taken today. */
    takenToday = async (userId: string, medicineIds: Types.ObjectId[]): Promise<Set<string>> => {
        if (!medicineIds.length) return new Set();
        const doses = await motherLogModel
            .find({
                userId,
                logType: "medicine_dose",
                logDate: getISTCalendarDate(),
                "fields.medicineId": { $in: medicineIds },
            })
            .select("fields.medicineId")
            .lean();
        return new Set(doses.map((dose) => String(dose.fields.medicineId)));
    };

    /**
     * Iron-folic acid adherence for the last seven IST days, oldest first and ending
     * today: true where any IFA on her list was marked taken that day.
     */
    ifaWeek = async (userId: string, medicines: IMotherMedicine[]): Promise<boolean[]> => {
        const ifaIds = medicines
            .filter((medicine) => medicine.presetKey === "iron_folic_acid")
            .map((medicine) => medicine._id);
        const today = getISTCalendarDate();
        const days = Array.from(
            { length: 7 },
            (_, i) => new Date(today.getTime() - (6 - i) * MS_PER_DAY),
        );
        if (!ifaIds.length) return days.map(() => false);

        const doses = await motherLogModel
            .find({
                userId,
                logType: "medicine_dose",
                "fields.medicineId": { $in: ifaIds },
                logDate: { $gte: days[0], $lte: today },
            })
            .select("logDate")
            .lean();
        const taken = new Set(doses.map((dose) => dose.logDate.getTime()));
        return days.map((day) => taken.has(day.getTime()));
    };

    setDoseTaken = async ({
        userId,
        medicineId,
        taken,
        source,
        context,
    }: {
        userId: string;
        medicineId: Types.ObjectId;
        taken: boolean;
        source: TLogSource;
        context: MotherContext;
    }) => {
        const now = new Date();
        const logDate = getISTCalendarDate(now);
        const filter = { userId, logType: "medicine_dose", "fields.medicineId": medicineId, logDate };

        if (!taken) {
            await motherLogModel.deleteOne(filter);
            return;
        }

        try {
            await motherLogModel.updateOne(
                filter,
                {
                    // `fields.medicineId` comes from the filter's equality on insert.
                    $setOnInsert: {
                        userId,
                        logType: "medicine_dose",
                        loggedAt: now,
                        logDate,
                        source,
                        careModel: context.careModel,
                        stage: context.stage,
                    },
                },
                { upsert: true },
            );
        } catch (err) {
            // Marked taken twice at once: it is taken, which is what was asked.
            if (!isDuplicateKey(err)) throw err;
        }
    };
}

export default MotherLogService;
