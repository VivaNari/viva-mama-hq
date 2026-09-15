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
import {
    IGrowthLog,
    IGrowthPercentiles,
    IPersistedIndicatorResult,
} from "../../types/growth-log.types";
import { IChild } from "../../types/user.types";
import logger, { createModuleLogger } from "../../utils/logger";
import BaseService from "../base.service";
import { ChildNotFoundError, getOwnedChild } from "../childs/child-ownership";
import { getISTCalendarDate } from "../date/date.service";

const log = createModuleLogger(logger, "growth-log.service");

/** Re-exported for the controller and tests that already import it from here. */
export { ChildNotFoundError };

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
     * Delegates to the shared ownership check — the diaper log asks the same question, and
     * two copies of an authorization filter is one copy too many. Kept as a method so the
     * existing call sites and tests read unchanged.
     */
    getOwnedChild = (userId: string, childId: string): Promise<IChild> =>
        getOwnedChild(userId, childId);

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

    /** Every growth log for one child. Used when a child is removed from a user. */
    deleteForChild = async (userId: string, childId: string): Promise<number> => {
        const result = await growthLogModel.deleteMany({ userId, childId });
        return result.deletedCount ?? 0;
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
     * Every stored percentile was scored against the child's date of birth and sex. Change
     * either and all of them are quietly wrong — and because a stale percentile looks
     * exactly as plausible as a correct one, nothing else would ever surface it.
     *
     * NO CALLER IN THE APPLICATION, deliberately. It used to run from
     * `ChildService.updateChild`; both fields are now set at baby onboarding and frozen
     * after, so no request can change one and there is nothing for it to repair. It is kept
     * because the correction did not stop being possible — only the route did. An operator
     * editing a birthday directly in the database is now the only way it happens, and this
     * is the repair for it. `__tests__/growthLog.test.ts` exercises it against exactly that
     * scenario rather than through an API path that no longer exists.
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
