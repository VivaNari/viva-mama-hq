import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import {
    IMotherLog,
    LOG_SOURCES,
    MOTHER_LOG_TYPES,
} from "../../types/mother-log.types";
import { ECareModel, EUserCategory } from "../../types/user.types";

const motherLogSchema = new Schema<IMotherLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        logType: {
            type: String,
            enum: MOTHER_LOG_TYPES,
            required: true,
        },
        logDate: {
            type: Date,
            required: true,
        },
        loggedAt: {
            type: Date,
            required: true,
        },
        source: {
            type: String,
            enum: LOG_SOURCES,
            default: "manual",
        },
        careModel: {
            type: String,
            enum: [...Object.values(ECareModel), null],
            default: null,
        },
        stage: {
            type: String,
            enum: [...Object.values(EUserCategory), null],
            default: null,
        },
        // Set only on water and kicks, so the one-per-day index can select them.
        isDailyTotal: {
            type: Boolean,
            default: undefined,
        },
        // Shape depends on logType and is enforced by the request validator; a
        // per-type subschema would need one discriminator model per type. No default:
        // the dose and schedule upserts seed `fields.<id>` from their filter, and a
        // default `{}` inserted alongside would collide with it.
        fields: {
            type: Schema.Types.Mixed,
            required: true,
        },
    },
    { ...generalSchemaOptions, minimize: false },
);

// History reads: one type (or a few) for a user, newest day first.
motherLogSchema.index({ userId: 1, logType: 1, logDate: -1, loggedAt: -1 });

// The daily counters keep one document per day; concurrent taps upsert into it.
// Filtered on a marker field rather than `logType: {$in: [...]}`, which partial
// indexes only accept from MongoDB 6.0.
motherLogSchema.index(
    { userId: 1, logType: 1, logDate: 1 },
    {
        unique: true,
        partialFilterExpression: { isDailyTotal: true },
        name: "one_daily_total_per_day",
    },
);

// A medicine is taken at most once per day; marking it again is a no-op.
motherLogSchema.index(
    { userId: 1, "fields.medicineId": 1, logDate: 1 },
    {
        unique: true,
        partialFilterExpression: { logType: "medicine_dose" },
        name: "one_dose_per_medicine_per_day",
    },
);

// An ANC schedule item is either ticked or not, whatever day it was ticked on.
motherLogSchema.index(
    { userId: 1, "fields.itemId": 1 },
    {
        unique: true,
        partialFilterExpression: { logType: "anc_schedule_item" },
        name: "one_tick_per_schedule_item",
    },
);

export default motherLogSchema;
