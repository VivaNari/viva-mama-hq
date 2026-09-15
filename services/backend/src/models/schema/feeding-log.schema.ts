import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import {
    FEED_SIDES,
    FEED_SOURCES,
    FOOD_REACTIONS,
    IFeedingLog,
} from "../../types/feeding-log.types";
import { FeedingMethodEnum } from "../../types/user.types";

/**
 * One milk feed. Keeps its `_id` — the client removes an individual entry by it, the same
 * reason the diaper log's entries keep theirs.
 *
 * `side`/`minutes` versus `ml` is enforced by the request validator rather than here: a
 * subdocument schema cannot express "required when a sibling holds this value", and
 * splitting into two arrays to get it would make counting feeds a concatenation.
 */
const feedEntrySchema = new Schema(
    {
        source: { type: String, enum: FEED_SOURCES, required: true },
        side: { type: String, enum: FEED_SIDES },
        minutes: { type: Number, min: 1, max: 180 },
        ml: { type: Number, min: 1, max: 500 },
        feedAt: { type: Date, required: true },
    },
    { _id: true },
);

const solidEntrySchema = new Schema(
    {
        food: { type: String, required: true, trim: true, maxlength: 80 },
        reactions: {
            type: [{ type: String, enum: FOOD_REACTIONS }],
            default: [],
        },
        feedAt: { type: Date, required: true },
    },
    { _id: true },
);

const waterEntrySchema = new Schema(
    {
        ml: { type: Number, required: true, min: 1, max: 500 },
        drankAt: { type: Date, required: true },
    },
    { _id: true },
);

const feedingLogSchema = new Schema<IFeedingLog>(
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

        // Stamped from the child when the day is created, so a past day keeps saying what
        // was true then. See the field's comment in feeding-log.types.ts.
        feedingMethod: {
            type: String,
            enum: Object.values(FeedingMethodEnum),
            required: true,
        },

        feeds: { type: [feedEntrySchema], default: [] },
        solids: { type: [solidEntrySchema], default: [] },
        water: { type: [waterEntrySchema], default: [] },
    },
    generalSchemaOptions,
);

/**
 * One document per child per calendar day.
 *
 * The same index serves the history read: Mongo walks an index backwards, so
 * `find({userId, childId}).sort({loggedOn: -1})` needs no second index.
 */
feedingLogSchema.index({ userId: 1, childId: 1, loggedOn: 1 }, { unique: true });

export default feedingLogSchema;
