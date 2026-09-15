/**
 * CRUD for the children embedded on users.childs[].
 *
 * Children are subdocuments rather than their own collection, which is what makes them
 * come along free on GET /api/v1/user and vanish with the user on account deletion. The
 * trade is that every write here is a positional update on the parent document rather
 * than a query on a collection of its own.
 *
 * Rewritten from a version that took (req, res) directly and returned the entire user
 * document on every call. It now takes typed params and returns just the child, so the
 * HTTP layer stays in the controller and the response does not ship the caller's whole
 * profile — subscription snapshot, onboarding answers and all — back on every add.
 */
import { Types } from "mongoose";

import UserModel from "../../models/user.model";
import {
    EChildOnboardingStatus,
    ESex,
    IChild,
    IChildBirthMeasurements,
} from "../../types/user.types";
import logger, { createModuleLogger } from "../../utils/logger";
import DiaperLogService from "../diaper-log/diaper-log.service";
import MilestoneLogService from "../milestone-log/milestone-log.service";
import FeedingLogService from "../feeding-log/feeding-log.service";
import VaccinationLogService from "../vaccination-log/vaccination-log.service";
import GrowthLogService from "../growth-log/growth-log.service";
import { ChildNotFoundError } from "./child-ownership";

const log = createModuleLogger(logger, "child.service");

export interface AddChildParams {
    userId: string;
    name: string;
    date_of_birth: Date | string;
    sex: ESex;
}

export interface UpdateChildParams {
    userId: string;
    childId: string;
    name?: string;
    date_of_birth?: Date | string;
    sex?: ESex;
    birth_measurements?: IChildBirthMeasurements;
}

/**
 * Re-exported so every existing `import { ChildNotFoundError } from ".../child.service"`
 * keeps working. The class itself now lives in `child-ownership` — it used to be declared
 * here *and* again in the growth-log service, which meant two distinct classes with the
 * same name and an `instanceof` check that silently failed across the boundary.
 */
export { ChildNotFoundError };

/** Read one child straight back out of the parent document. */
const readChild = async (userId: string, childId: string): Promise<IChild | null> => {
    const user = await UserModel.findById(userId).select("childs").lean();
    if (!user) return null;

    return (
        (user.childs ?? []).find((child) => child._id?.toString() === childId) ?? null
    );
};

export default class ChildService {
    /**
     * Add a child directly, outside the onboarding chat.
     *
     * Marked COMPLETED rather than DRAFT: the caller supplied everything required in one
     * request, so there is no half-finished run to resume. DRAFT is reserved for children
     * the baby-onboarding flow is still filling in.
     */
    addChild = async ({ userId, name, date_of_birth, sex }: AddChildParams): Promise<IChild> => {
        const childId = new Types.ObjectId();

        const result = await UserModel.updateOne(
            { _id: userId },
            {
                $push: {
                    childs: {
                        _id: childId,
                        name,
                        date_of_birth: new Date(date_of_birth),
                        sex,
                        onboarding_status: EChildOnboardingStatus.COMPLETED,
                        onboarded_at: new Date(),
                    },
                },
            },
        );

        if (result.matchedCount === 0) {
            throw new ChildNotFoundError("User not found");
        }

        log.info({ userId, childId }, "Child added");

        const child = await readChild(userId, childId.toString());
        if (!child) throw new ChildNotFoundError();
        return child;
    };

    /**
     * Partially update one child. Only the fields supplied are touched, so a caller
     * editing the name cannot blank out the birth measurements by omission.
     */
    updateChild = async ({
        userId,
        childId,
        name,
        date_of_birth,
        sex,
        birth_measurements,
    }: UpdateChildParams): Promise<IChild> => {
        if (!Types.ObjectId.isValid(childId)) {
            throw new ChildNotFoundError("Invalid childId");
        }

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates["childs.$.name"] = name;
        if (date_of_birth !== undefined) {
            updates["childs.$.date_of_birth"] = new Date(date_of_birth);
        }
        if (sex !== undefined) updates["childs.$.sex"] = sex;

        // Merged field by field rather than as a whole object: $set on the parent would
        // replace the subdocument, so sending only a new weight would erase the length
        // and head circumference already recorded at birth.
        if (birth_measurements) {
            for (const [key, value] of Object.entries(birth_measurements)) {
                if (value !== undefined) {
                    updates[`childs.$.birth_measurements.${key}`] = value;
                }
            }
        }

        if (Object.keys(updates).length === 0) {
            const unchanged = await readChild(userId, childId);
            if (!unchanged) throw new ChildNotFoundError();
            return unchanged;
        }

        const result = await UserModel.updateOne(
            { _id: userId, "childs._id": childId },
            { $set: updates },
        );

        if (result.matchedCount === 0) {
            throw new ChildNotFoundError();
        }

        log.info({ userId, childId, fields: Object.keys(updates) }, "Child updated");

        // Every stored percentile was computed against this child's date of birth and sex.
        // Correcting either one silently invalidates all of them — and because a stale
        // percentile still looks like a perfectly plausible number, nothing would ever
        // surface the error. Recompute rather than leave history describing a different
        // child.
        //
        // Non-fatal: the edit the mother asked for has already succeeded, so a failure here
        // must not turn into a failed request.
        if (date_of_birth !== undefined || sex !== undefined) {
            try {
                await new GrowthLogService().recomputeForChild(userId, childId);
            } catch (error) {
                log.error(
                    { userId, childId, error },
                    "Failed to recompute growth percentiles after a child correction",
                );
            }
        }

        const child = await readChild(userId, childId);
        if (!child) throw new ChildNotFoundError();
        return child;
    };

    /** Remove one child from the user. */
    deleteChild = async (userId: string, childId: string): Promise<void> => {
        if (!Types.ObjectId.isValid(childId)) {
            throw new ChildNotFoundError("Invalid childId");
        }

        // The child is required by the FILTER, not just the $pull, so matchedCount is a
        // truthful "did this child exist" signal.
        //
        // modifiedCount is not: Mongo reports modifiedCount: 1 for a $pull that removes
        // nothing at all, because it rewrites the array field regardless. Trusting it
        // meant deleting a stray id reported success.
        const result = await UserModel.updateOne(
            { _id: userId, "childs._id": new Types.ObjectId(childId) },
            { $pull: { childs: { _id: new Types.ObjectId(childId) } } },
        );

        if (result.matchedCount === 0) {
            throw new ChildNotFoundError();
        }

        // The child's per-child log collections do not go with it, because they are keyed
        // on childId rather than embedded in the user. Left behind they are orphaned health
        // data about a child the parent believes they deleted — invisible in the app and
        // impossible to reach again, since every read goes through an ownership check that
        // now fails.
        //
        // Non-fatal: the child is already gone from the user's document, and failing the
        // request here would report a deletion that did happen as an error.
        try {
            const [growthLogs, diaperLogs, milestoneLogs, vaccinationLogs, feedingLogs] =
                await Promise.all([
                    new GrowthLogService().deleteForChild(userId, childId),
                    new DiaperLogService().deleteForChild(userId, childId),
                    new MilestoneLogService().deleteForChild(userId, childId),
                    new VaccinationLogService().deleteForChild(userId, childId),
                    new FeedingLogService().deleteForChild(userId, childId),
                ]);

            log.info(
                {
                    userId,
                    childId,
                    growthLogs,
                    diaperLogs,
                    milestoneLogs,
                    vaccinationLogs,
                    feedingLogs,
                },
                "Child logs deleted",
            );
        } catch (error) {
            log.error({ err: error, userId, childId }, "Failed to delete child logs");
        }

        log.info({ userId, childId }, "Child deleted");
    };

    /**
     * Every child on the user.
     *
     * Includes DRAFT rows; filtering them is the caller's call, because the dashboard
     * wants them hidden while a resume check wants them visible.
     */
    listChildren = async (userId: string): Promise<IChild[]> => {
        const user = await UserModel.findById(userId).select("childs").lean();
        if (!user) throw new ChildNotFoundError("User not found");
        return user.childs ?? [];
    };
}
