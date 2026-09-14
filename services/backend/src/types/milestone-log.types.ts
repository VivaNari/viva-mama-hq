import { Schema } from "mongoose";

/**
 * One developmental milestone a parent has marked their child as having reached.
 *
 * Unlike growth and diaper logs, this collection is **not** keyed on a calendar day. A
 * milestone happens once; the key is the milestone and the date is an attribute of it. That
 * difference drives the whole slice: the unique index is on the milestone rather than the
 * day, and there is no closed-day rule — a parent notices "she rolled over" days after it
 * first happened, and recording it then is the normal case, not a correction.
 */
export interface IMilestoneLog {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    /**
     * Matches `users.childs[]._id`. Deliberately not a Mongoose `ref` — children are
     * embedded subdocuments, so there is no collection to populate from.
     */
    childId: Schema.Types.ObjectId;

    /**
     * A key from the generated catalogue (`constants/milestone-keys.ts`), which is derived
     * from the India MCP card. Validated on the way in, so a stale client cannot store a
     * row that no screen can render.
     */
    milestoneKey: string;

    /** IST start-of-day. Defaults to today, but a parent may date it earlier. */
    achievedOn: Date;

    createdAt: Date;
    updatedAt: Date;
}
