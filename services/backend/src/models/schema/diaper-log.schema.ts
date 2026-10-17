import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import { DIAPER_KINDS, IDiaperLog } from "../../types/diaper-log.types";

/**
 * One nappy change. Keeps its `_id` — the client deletes an individual entry by it, which
 * is why this is not `_id: false` like the growth log's indicator subdocuments.
 */
const diaperEntrySchema = new Schema(
    {
        kind: {
            type: String,
            enum: DIAPER_KINDS,
            required: true,
        },
        loggedAt: {
            type: Date,
            required: true,
        },
    },
    { _id: true },
);

const diaperLogSchema = new Schema<IDiaperLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        // Matches users.childs[]._id. Not a `ref`: children are embedded subdocuments and
        // there is no children collection for populate() to reach.
        childId: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        loggedOn: {
            type: Date,
            required: true,
        },

        entries: {
            type: [diaperEntrySchema],
            default: [],
        },
    },
    generalSchemaOptions,
);

/**
 * One document per child per calendar day.
 *
 * The same index serves the history read: Mongo walks an index backwards, so
 * `find({userId, childId}).sort({loggedOn: -1})` needs no second index.
 */
diaperLogSchema.index({ userId: 1, childId: 1, loggedOn: 1 }, { unique: true });

export default diaperLogSchema;
