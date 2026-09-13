import { Types } from "mongoose";

import {
    GrowthMeasurement,
    Indicator,
    IndicatorResult,
    STANDARD_SOURCE,
    STANDARD_VERSION,
    Sex,
    ageInDaysUtc,
    birthMeasurementsToGrowthPoint,
    evaluateGrowth,
} from "@vivamama/growth-standards";

import growthLogModel from "../../models/growth-log.model";
import UserModel from "../../models/user.model";
import {
    IGrowthLog,
    IGrowthPercentiles,
    IPersistedIndicatorResult,
} from "../../types/growth-log.types";
import { IChild } from "../../types/user.types";
import logger, { createModuleLogger } from "../../utils/logger";
import BaseService from "../base.service";
import { getISTCalendarDate } from "../date/date.service";

const log = createModuleLogger(logger, "growth-log.service");

export class ChildNotFoundError extends Error {
    constructor(message = "Child not found for this user") {
        super(message);
        this.name = "ChildNotFoundError";
    }
}

/** The package's discriminated union flattened for storage. Mongoose has no union type. */
const toPersisted = (result: IndicatorResult): IPersistedIndicatorResult => ({
    status: result.status,
    value: result.value,
    key: result.key,
    z: result.z,
    zRaw: result.zRaw,
    percentile: result.percentile,
});

const toPersistedAll = (
    evaluation: Record<Indicator, IndicatorResult>,
): IGrowthPercentiles => ({
    weight_for_age: toPersisted(evaluation.weight_for_age),
    length_for_age: toPersisted(evaluation.length_for_age),
    head_circumference_for_age: toPersisted(evaluation.head_circumference_for_age),
    weight_for_length: toPersisted(evaluation.weight_for_length),
});

export interface UpsertGrowthLogParams {
    userId: string;
    childId: string;
    /** IST start-of-day. */
    measuredOn: Date;
    measurement: GrowthMeasurement;
}

class GrowthLogService extends BaseService<IGrowthLog> {
    constructor() {
        super(growthLogModel);
    }

    /**
     * The child, verified to belong to this user.
     *
     * Children are embedded subdocuments, so ownership is a filter rather than a join —
     * the same `{_id: userId, "childs._id": childId}` shape ChildService uses. Doing it any
     * other way would let one user address another's child by id.
     */
    getOwnedChild = async (userId: string, childId: string): Promise<IChild> => {
        if (!Types.ObjectId.isValid(childId)) throw new ChildNotFoundError();

        const user = await UserModel.findOne(
            { _id: userId, "childs._id": new Types.ObjectId(childId) },
            { "childs.$": 1 },
        ).lean();

        const child = user?.childs?.[0];
        if (!child) throw new ChildNotFoundError();

        return child as IChild;
    };

    /**
     * Score a set of measurements for a child on a given day.
     *
     * Kept separate from persistence so the recompute path and the write path cannot drift:
     * both produce their numbers here.
     */
    evaluateForChild = (
        child: Pick<IChild, "sex" | "date_of_birth">,
        measuredOn: Date,
        measurement: GrowthMeasurement,
    ) => {
        const ageInDays = child.date_of_birth
            ? ageInDaysUtc(child.date_of_birth, measuredOn)
            : null;

        const evaluation = evaluateGrowth({
            sex: child.sex,
            ageInDays,
            measurement,
        });

        return { ageInDays, evaluation };
    };

    /**
     * Create the growth log for a calendar day, or update it if one already exists.
     *
     * Upsert rather than insert: the unique index is on (user, child, day), and a mother
     * correcting a number she just typed is the normal case, not an error.
     */
    upsertForDate = async ({
        userId,
        childId,
        measuredOn,
        measurement,
    }: UpsertGrowthLogParams): Promise<IGrowthLog> => {
        const child = await this.getOwnedChild(userId, childId);
        const { ageInDays, evaluation } = this.evaluateForChild(child, measuredOn, measurement);

        const document = await growthLogModel.findOneAndUpdate(
            { userId, childId, measuredOn },
            {
                $set: {
                    // ageInDays is null only when the child has no date of birth, which the
                    // validator and baby onboarding both prevent. 0 keeps the schema's
                    // `required` satisfied without inventing an age.
                    ageInDays: ageInDays ?? 0,
                    sex: child.sex as Sex,
                    measurements: {
                        weight_kg: measurement.weight_kg ?? null,
                        length_cm: measurement.length_cm ?? null,
                        head_circumference_cm: measurement.head_circumference_cm ?? null,
                    },
                    percentiles: toPersistedAll(evaluation),
                    standard: { source: STANDARD_SOURCE, version: STANDARD_VERSION },
                },
                $setOnInsert: { userId, childId, measuredOn },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        return document as IGrowthLog;
    };

    /** A child's history, oldest first — the order the chart plots a trajectory in. */
    listForChild = async ({
        userId,
        childId,
        from,
        to,
    }: {
        userId: string;
        childId: string;
        from?: Date;
        to?: Date;
    }): Promise<IGrowthLog[]> => {
        await this.getOwnedChild(userId, childId);

        const measuredOn: Record<string, Date> = {};
        if (from) measuredOn.$gte = from;
        if (to) measuredOn.$lte = to;

        return growthLogModel
            .find({
                userId,
                childId,
                ...(Object.keys(measuredOn).length > 0 ? { measuredOn } : {}),
            })
            .sort({ measuredOn: 1 })
            .lean<IGrowthLog[]>();
    };

    deleteForDate = async ({
        userId,
        childId,
        measuredOn,
    }: {
        userId: string;
        childId: string;
        measuredOn: Date;
    }): Promise<boolean> => {
        await this.getOwnedChild(userId, childId);

        const result = await growthLogModel.deleteOne({ userId, childId, measuredOn });
        return result.deletedCount > 0;
    };

    /**
     * Recompute every stored percentile for a child.
     *
     * Called when the child's date of birth or sex changes. Without it, a mother who fixes a
     * typo'd birthday keeps percentiles computed against the wrong age forever — and because
     * the number looks perfectly plausible, nothing would ever surface the error.
     */
    recomputeForChild = async (userId: string, childId: string): Promise<number> => {
        const child = await this.getOwnedChild(userId, childId);
        const logs = await growthLogModel.find({ userId, childId });

        let updated = 0;

        for (const entry of logs) {
            const { ageInDays, evaluation } = this.evaluateForChild(child, entry.measuredOn, {
                weight_kg: entry.measurements?.weight_kg ?? null,
                length_cm: entry.measurements?.length_cm ?? null,
                head_circumference_cm: entry.measurements?.head_circumference_cm ?? null,
            });

            entry.set({
                ageInDays: ageInDays ?? 0,
                sex: child.sex as Sex,
                percentiles: toPersistedAll(evaluation),
                standard: { source: STANDARD_SOURCE, version: STANDARD_VERSION },
            });

            await entry.save();
            updated += 1;
        }

        if (updated > 0) {
            log.info({ userId, childId, updated }, "Recomputed growth percentiles for child");
        }

        return updated;
    };

    /**
     * Write the child's day-0 point from the birth measurements baby onboarding captured.
     *
     * Runs on onboarding completion so a brand-new child already has a point on the chart,
     * which is what makes the growth card meaningful before the first manual log. An upsert
     * rather than an insert, so re-completing an onboarding cannot throw a duplicate-key
     * error on the unique index.
     *
     * Returns null when there is nothing to record — no date of birth, or no measurements.
     */
    recordBirthMeasurements = async (
        userId: string,
        childId: string,
    ): Promise<IGrowthLog | null> => {
        const child = await this.getOwnedChild(userId, childId);

        if (!child.date_of_birth) return null;

        // grams -> kg goes through the package's converter, never an inline /1000: one
        // audited conversion is what stops the two units drifting apart across the codebase.
        const measurement: GrowthMeasurement = birthMeasurementsToGrowthPoint(
            child.birth_measurements ?? {},
        );

        const hasAny = Object.values(measurement).some(
            (value) => typeof value === "number" && Number.isFinite(value),
        );
        if (!hasAny) return null;

        // The day-0 entry is dated the child's birthday, on the same IST calendar boundary
        // every other log uses — otherwise two rows could describe the same day.
        const measuredOn = getISTCalendarDate(new Date(child.date_of_birth));

        return this.upsertForDate({ userId, childId, measuredOn, measurement });
    };
}

export default GrowthLogService;
