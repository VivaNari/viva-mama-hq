import { Schema } from "mongoose";

import { STANDARD_SOURCE } from "@vivamama/growth-standards";

import { generalSchemaOptions } from "../../constants/model";
import { IGrowthLog } from "../../types/growth-log.types";

/**
 * One indicator's result. `_id: false` because these are value objects, not documents —
 * four of them are embedded in every log and none is ever addressed on its own.
 */
const indicatorResultSchema = new Schema(
    {
        status: {
            type: String,
            enum: ["OK", "OUT_OF_RANGE", "MISSING_INPUT", "NOT_APPLICABLE"],
            required: true,
        },
        value: { type: Number, default: null },
        key: { type: Number, default: null },
        z: { type: Number, default: null },
        zRaw: { type: Number, default: null },
        percentile: { type: Number, default: null },
    },
    { _id: false },
);

const growthLogSchema = new Schema<IGrowthLog>(
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
        measuredOn: {
            type: Date,
            required: true,
        },

        ageInDays: {
            type: Number,
            required: true,
            min: 0,
        },
        // Snapshotted rather than read through to the child, so a later correction to the
        // child's sex is visible as a difference instead of silently reinterpreting history.
        sex: {
            type: String,
            enum: ["Male", "Female"],
            required: true,
        },

        measurements: {
            weight_kg: { type: Number, default: null },
            length_cm: { type: Number, default: null },
            head_circumference_cm: { type: Number, default: null },
        },

        percentiles: {
            weight_for_age: { type: indicatorResultSchema, required: true },
            length_for_age: { type: indicatorResultSchema, required: true },
            head_circumference_for_age: { type: indicatorResultSchema, required: true },
            weight_for_length: { type: indicatorResultSchema, required: true },
        },

        standard: {
            source: { type: String, default: STANDARD_SOURCE },
            // Stamped so rows computed under different rules can be told apart. Without it,
            // a change to the maths silently reinterprets every number already written.
            version: { type: String, required: true },
        },
    },
    generalSchemaOptions,
);

/**
 * One editable growth log per child per calendar day.
 *
 * This single index also serves the history read: Mongo walks an index backwards, so
 * `find({userId, childId}).sort({measuredOn: -1})` uses it without a second index.
 */
growthLogSchema.index({ userId: 1, childId: 1, measuredOn: 1 }, { unique: true });

export default growthLogSchema;
