import { Types } from "mongoose";

import feedingLogModel from "../../models/feeding-log.model";
import UserModel from "../../models/user.model";
import {
    IFeedEntry,
    IFeedingLog,
    IFeedingSettings,
    IFeedingTotals,
    ISolidEntry,
    IWaterEntry,
    TFeedingEntryKind,
} from "../../types/feeding-log.types";
import { FeedingMethodEnum, IChild } from "../../types/user.types";
import BaseService from "../base.service";
import { ChildNotFoundError, getOwnedChild } from "../childs/child-ownership";
import { formatDateToISO, getISTCalendarDate } from "../date/date.service";

/** Re-exported for the controller and tests that import it from here. */
export { ChildNotFoundError };

/** Mongo's duplicate-key error. Named rather than inlined so the retry below reads. */
const DUPLICATE_KEY = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === DUPLICATE_KEY;

/**
 * Six completed months, as a day count.
 *
 * 183 days rather than a calendar month arithmetic, matching `isSixMonthsOrOlder` on the
 * client so the two agree about the day a baby becomes eligible for solids. The boundary
 * is clinical guidance — WHO and IAP both say exclusive milk to six completed months — not
 * a birthday, so a day count is the honest unit.
 */
export const SOLIDS_MIN_AGE_DAYS = 183;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole IST days between birth and an instant. Null when the child has no date of birth. */
export const ageInDays = (child: IChild, at: Date = new Date()): number | null => {
    if (!child.date_of_birth) return null;

    const birthDay = getISTCalendarDate(new Date(child.date_of_birth));
    const day = getISTCalendarDate(at);

    return Math.floor((day.getTime() - birthDay.getTime()) / MS_PER_DAY);
};

/** Whether solids and water may be offered or accepted for this child at all. */
export const isOldEnoughForSolids = (child: IChild, at: Date = new Date()): boolean => {
    const days = ageInDays(child, at);
    return days !== null && days >= SOLIDS_MIN_AGE_DAYS;
};

/**
 * The "Today" card's figures. Derived on read; storing them would be a second source of truth.
 *
 * Feeds are sorted before the gap is measured, so a mother who remembers the 06:40 feed
 * after entering the 09:50 one still gets the right answer.
 */
export const totalsFor = (log: Pick<IFeedingLog, "feeds" | "solids" | "water">): IFeedingTotals => {
    const times = (log.feeds ?? [])
        .map((feed) => new Date(feed.feedAt).getTime())
        .sort((a, b) => a - b);

    let longestGapMinutes: number | null = null;
    for (let i = 1; i < times.length; i++) {
        const current = times[i];
        const previous = times[i - 1];
        if (current === undefined || previous === undefined) continue;

        const gap = Math.round((current - previous) / 60000);
        longestGapMinutes = longestGapMinutes === null ? gap : Math.max(longestGapMinutes, gap);
    }

    return {
        feeds: times.length,
        longestGapMinutes,
        solids: (log.solids ?? []).length,
        waterMl: (log.water ?? []).reduce((sum, entry) => sum + (entry.ml ?? 0), 0),
    };
};

/** Which array on the document a given entry kind lives in. */
const ARRAY_FOR_KIND: Record<TFeedingEntryKind, "feeds" | "solids" | "water"> = {
    feed: "feeds",
    solid: "solids",
    water: "water",
};

export type TFeedingEntry = IFeedEntry | ISolidEntry | IWaterEntry;

export interface AddFeedingEntryParams {
    userId: string;
    childId: string;
    kind: TFeedingEntryKind;
    /** Already validated and shaped by the controller. Its `_id` is generated there. */
    entry: TFeedingEntry;
    /** The instant the entry happened. The IST day it files under is derived from it here. */
    at: Date;
    /** The child's current method, stamped on the day if this write creates it. */
    feedingMethod: FeedingMethodEnum;
}

export interface RemoveFeedingEntryParams {
    userId: string;
    childId: string;
    /** IST start-of-day. */
    loggedOn: Date;
    kind: TFeedingEntryKind;
    entryId: string;
}

export interface UpdateFeedingSettingsParams {
    userId: string;
    childId: string;
    feedingMethod?: FeedingMethodEnum;
    /** A date to start, or explicit null to record that solids have not started after all. */
    solidsStartedOn?: Date | null;
}

class FeedingLogService extends BaseService<IFeedingLog> {
    constructor() {
        super(feedingLogModel);
    }

    /** The child, verified to belong to this user. */
    getOwnedChild = (userId: string, childId: string) => getOwnedChild(userId, childId);

    /**
     * The child plus the settings the screen opens with.
     *
     * One query for both halves: the mother's onboarding answer is the fallback for a
     * child who has never had a method set, and reading it separately would be a second
     * round trip for a field sitting in the same document.
     */
    resolveSettings = async (
        userId: string,
        childId: string,
        at: Date = new Date(),
    ): Promise<{ child: IChild; settings: IFeedingSettings }> => {
        if (!Types.ObjectId.isValid(childId)) throw new ChildNotFoundError();

        const user = await UserModel.findOne(
            { _id: userId, "childs._id": new Types.ObjectId(childId) },
            { "childs.$": 1, "onboarding_data.feeding_method": 1 },
        ).lean();

        const child = user?.childs?.[0] as IChild | undefined;
        if (!child) throw new ChildNotFoundError();

        // The fallback chain, in one place. The client never re-derives it.
        const fromOnboarding = user?.onboarding_data?.feeding_method ?? null;

        const feedingMethod =
            child.feeding_method ?? fromOnboarding ?? FeedingMethodEnum.ONLY_BREASTMILK;
        const feedingMethodSource: IFeedingSettings["feedingMethodSource"] = child.feeding_method
            ? "child"
            : fromOnboarding
              ? "onboarding"
              : "default";

        return {
            child,
            settings: {
                feedingMethod,
                feedingMethodSource,
                solidsStartedOn: child.solids_started_on
                    ? formatDateToISO(getISTCalendarDate(new Date(child.solids_started_on)))
                    : null,
                solidsAvailable: isOldEnoughForSolids(child, at),
            },
        };
    };

    /**
     * Append one entry to a day.
     *
     * `$push` inside an upsert rather than reading the day, appending and writing it back.
     * Partner accounts exist in this product, so two people logging the same baby's day at
     * once is ordinary use rather than an edge case, and a read-modify-write would silently
     * drop whichever entry lost the race.
     */
    addEntry = async ({
        userId,
        childId,
        kind,
        entry,
        at,
        feedingMethod,
    }: AddFeedingEntryParams): Promise<{
        entry: TFeedingEntry;
        totals: IFeedingTotals;
        loggedOn: Date;
    }> => {
        const loggedOn = getISTCalendarDate(at);
        const field = ARRAY_FOR_KIND[kind];

        const push = () =>
            feedingLogModel.findOneAndUpdate(
                { userId, childId, loggedOn },
                {
                    $push: { [field]: entry },
                    // feedingMethod is set only on insert: the day records what was true
                    // when it opened, and a later change rewrites it explicitly.
                    $setOnInsert: { userId, childId, loggedOn, feedingMethod },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true },
            );

        let document: IFeedingLog | null;

        try {
            document = (await push()) as IFeedingLog | null;
        } catch (error) {
            // Two writes landing on a day with no document yet can both attempt the insert;
            // the unique index lets exactly one through and the loser sees E11000. The retry
            // finds the document the winner created and simply pushes into it.
            if (!isDuplicateKeyError(error)) throw error;
            document = (await push()) as IFeedingLog | null;
        }

        return {
            entry,
            totals: totalsFor(
                document ?? { feeds: [], solids: [], water: [] },
            ),
            loggedOn,
        };
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
        kind,
        entryId,
    }: RemoveFeedingEntryParams): Promise<{ removed: boolean; totals: IFeedingTotals }> => {
        const empty = { feeds: [], solids: [], water: [] };

        if (!Types.ObjectId.isValid(entryId)) {
            return { removed: false, totals: totalsFor(empty) };
        }

        const field = ARRAY_FOR_KIND[kind];
        const _id = new Types.ObjectId(entryId);

        const document = await feedingLogModel.findOneAndUpdate(
            { userId, childId, loggedOn, [`${field}._id`]: _id },
            { $pull: { [field]: { _id } } },
            { new: true },
        );

        // A null document means the filter matched nothing — either the day has no such
        // entry or it is not this user's. Both are a 404 to the caller, deliberately
        // indistinguishable so an id cannot be probed for existence.
        if (!document) return { removed: false, totals: totalsFor(empty) };

        return { removed: true, totals: totalsFor(document) };
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
    }): Promise<IFeedingLog[]> => {
        const loggedOn: Record<string, Date> = {};
        if (from) loggedOn.$gte = from;
        if (to) loggedOn.$lte = to;

        return feedingLogModel
            .find({
                userId,
                childId,
                ...(Object.keys(loggedOn).length > 0 ? { loggedOn } : {}),
            })
            .sort({ loggedOn: 1 })
            .lean<IFeedingLog[]>();
    };

    /**
     * Write the per-child feeding settings.
     *
     * A positional `$set` on the one child, the pattern `child-onboarding.projection.ts`
     * established: loading the user and mutating `childs[]` would be a read-modify-write on
     * an array shared by every child, so two concurrent writes could lose one another.
     *
     * Nothing user-level is touched. The mother's own `onboarding_data.feeding_method` and
     * the `is_breastfeeding_currently` flag derived from it gate her weekly check-in
     * questions and the score engine, and a baby's log is not the place to move them.
     */
    updateSettings = async ({
        userId,
        childId,
        feedingMethod,
        solidsStartedOn,
    }: UpdateFeedingSettingsParams): Promise<void> => {
        const fields: Record<string, unknown> = {};
        if (feedingMethod !== undefined) fields["childs.$.feeding_method"] = feedingMethod;
        // `undefined` means "not sent"; an explicit null means "solids have not started
        // after all" and has to reach the document, so the two cannot be collapsed.
        if (solidsStartedOn !== undefined) fields["childs.$.solids_started_on"] = solidsStartedOn;

        if (Object.keys(fields).length === 0) return;

        const result = await UserModel.updateOne(
            { _id: userId, "childs._id": new Types.ObjectId(childId) },
            { $set: fields },
        );

        if (result.matchedCount === 0) throw new ChildNotFoundError();

        // Today's row follows the change; earlier days keep the method they were logged
        // under. Best-effort by design — if today has no row yet there is nothing to
        // rewrite, and the next entry will stamp the new method on insert.
        if (feedingMethod !== undefined) {
            await feedingLogModel.updateOne(
                { userId, childId, loggedOn: getISTCalendarDate() },
                { $set: { feedingMethod } },
            );
        }
    };

    /** Every feeding log for one child. Used when a child is removed from a user. */
    deleteForChild = async (userId: string, childId: string): Promise<number> => {
        const result = await feedingLogModel.deleteMany({ userId, childId });
        return result.deletedCount ?? 0;
    };
}

export default FeedingLogService;
