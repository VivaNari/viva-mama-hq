import { Schema } from "mongoose";

/**
 * A day of nappy changes for one child.
 *
 * Stored as one document per child per calendar day with the changes in an array, rather
 * than one document per change. Three reasons:
 *
 *  - it matches `mood_logs` and `growth_logs` — every log collection in this codebase is
 *    keyed on (user, day) and carries a unique index saying so;
 *  - the numbers the UI actually renders ("4 today", "12 total", the dashboard tile) are
 *    then a single-document read rather than an aggregation over a range;
 *  - the array is bounded by physiology. A newborn is changed 8-12 times a day; an
 *    event-per-document model would be ~7,000 rows per child over two years to answer
 *    "how many today".
 */

export type TDiaperKind = "wet" | "dirty" | "both";

export const DIAPER_KINDS: TDiaperKind[] = ["wet", "dirty", "both"];

/**
 * One change. Keeps its default `_id`, unlike the growth log's indicator subdocuments —
 * here the id is the handle the client deletes an individual entry by.
 */
export interface IDiaperEntry {
    _id: Schema.Types.ObjectId;
    kind: TDiaperKind;
    /**
     * The instant of the change, not of the request. The client sends it so that a tap
     * recorded while offline and flushed later keeps the time it actually happened.
     */
    loggedAt: Date;
}

export interface IDiaperLog {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    /**
     * Matches `users.childs[]._id`. Deliberately not a Mongoose `ref` — children are
     * embedded subdocuments, so there is no collection to populate from.
     */
    childId: Schema.Types.ObjectId;

    /**
     * IST start-of-day, derived on the server from `loggedAt`.
     *
     * Derived rather than accepted from the client: if the phone decided which day an entry
     * belonged to, a device in another timezone would file it against a day the server reads
     * as a different one, and the unique index would stop meaning what it says.
     */
    loggedOn: Date;

    entries: IDiaperEntry[];

    createdAt: Date;
    updatedAt: Date;
}

/** Per-kind counts plus the total, derived on read — never stored. */
export interface IDiaperTotals {
    wet: number;
    dirty: number;
    both: number;
    total: number;
}
