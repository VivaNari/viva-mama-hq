import { Types } from "mongoose";

import diaperLogModel from "../../models/diaper-log.model";
import {
    IDiaperEntry,
    IDiaperLog,
    IDiaperTotals,
    TDiaperKind,
} from "../../types/diaper-log.types";
import BaseService from "../base.service";
import { ChildNotFoundError, getOwnedChild } from "../childs/child-ownership";
import { getISTCalendarDate } from "../date/date.service";

/** Re-exported for the controller and tests that import it from here. */
export { ChildNotFoundError };

/** Mongo's duplicate-key error. Named rather than inlined so the retry below reads. */
const DUPLICATE_KEY = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === DUPLICATE_KEY;

/** Per-kind counts for one day. Derived on read; storing them would be a second source of truth. */
export const totalsFor = (entries: IDiaperEntry[]): IDiaperTotals => {
    const totals: IDiaperTotals = { wet: 0, dirty: 0, both: 0, total: entries.length };

    for (const entry of entries) {
        totals[entry.kind] += 1;
    }

    return totals;
};

export interface AddDiaperEntryParams {
    userId: string;
    childId: string;
    kind: TDiaperKind;
    /** The instant of the change. The IST day it belongs to is derived from it here. */
    loggedAt: Date;
}

export interface RemoveDiaperEntryParams {
    userId: string;
    childId: string;
    /** IST start-of-day. */
    loggedOn: Date;
    entryId: string;
}

class DiaperLogService extends BaseService<IDiaperLog> {
    constructor() {
        super(diaperLogModel);
    }

    /** The child, verified to belong to this user. */
    getOwnedChild = (userId: string, childId: string) => getOwnedChild(userId, childId);

    /**
     * Record one nappy change.
     *
     * `$push` inside an upsert rather than reading the array, appending and writing it back.
     * This screen is tapped repeatedly and fast — a read-modify-write would drop an entry
     * whenever two taps overlapped, and the parent would have no way of knowing.
     *
     * Returns the created entry alongside the day's totals, which is what the client needs
     * to swap its optimistic row for the real one.
     */
    addEntry = async ({
        userId,
        childId,
        kind,
        loggedAt,
    }: AddDiaperEntryParams): Promise<{ entry: IDiaperEntry; totals: IDiaperTotals; loggedOn: Date }> => {
        await getOwnedChild(userId, childId);

        const loggedOn = getISTCalendarDate(loggedAt);

        // Generated here rather than left to Mongo so the entry can be found in the document
        // that comes back — `$push` gives no pointer to what it just appended.
        const entry = {
            _id: new Types.ObjectId(),
            kind,
            loggedAt,
        } as unknown as IDiaperEntry;

        const push = () =>
            diaperLogModel.findOneAndUpdate(
                { userId, childId, loggedOn },
                {
                    $push: { entries: entry },
                    $setOnInsert: { userId, childId, loggedOn },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true },
            );

        let document: IDiaperLog | null;

        try {
            document = (await push()) as IDiaperLog | null;
        } catch (error) {
            // Two taps landing on a day that has no document yet can both attempt the
            // insert; the unique index lets exactly one through and the loser sees E11000.
            // The retry finds the document the winner created and simply pushes into it.
            if (!isDuplicateKeyError(error)) throw error;
            document = (await push()) as IDiaperLog | null;
        }

        const entries = document?.entries ?? [];

        return { entry, totals: totalsFor(entries), loggedOn };
    };

    /**
     * Remove one entry from a day.
     *
     * `$pull` by entry id, scoped by user and child in the same filter — an entry id alone
     * would be enough to delete from someone else's day.
     */
    removeEntry = async ({
        userId,
        childId,
        loggedOn,
        entryId,
    }: RemoveDiaperEntryParams): Promise<{ removed: boolean; totals: IDiaperTotals }> => {
        await getOwnedChild(userId, childId);

        if (!Types.ObjectId.isValid(entryId)) {
            return { removed: false, totals: totalsFor([]) };
        }

        const document = await diaperLogModel.findOneAndUpdate(
            { userId, childId, loggedOn, "entries._id": new Types.ObjectId(entryId) },
            { $pull: { entries: { _id: new Types.ObjectId(entryId) } } },
            { new: true },
        );

        // A null document means the filter matched nothing — either the day has no such
        // entry or it is not this user's. Both are a 404 to the caller, deliberately
        // indistinguishable so an id cannot be probed for existence.
        if (!document) return { removed: false, totals: totalsFor([]) };

        return { removed: true, totals: totalsFor(document.entries ?? []) };
    };

    /** A child's days, oldest first — the order the date strip reads them in. */
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
    }): Promise<IDiaperLog[]> => {
        await getOwnedChild(userId, childId);

        const loggedOn: Record<string, Date> = {};
        if (from) loggedOn.$gte = from;
        if (to) loggedOn.$lte = to;

        return diaperLogModel
            .find({
                userId,
                childId,
                ...(Object.keys(loggedOn).length > 0 ? { loggedOn } : {}),
            })
            .sort({ loggedOn: 1 })
            .lean<IDiaperLog[]>();
    };

    /** Every diaper log for one child. Used when a child is removed from a user. */
    deleteForChild = async (userId: string, childId: string): Promise<number> => {
        const result = await diaperLogModel.deleteMany({ userId, childId });
        return result.deletedCount ?? 0;
    };
}

export default DiaperLogService;
