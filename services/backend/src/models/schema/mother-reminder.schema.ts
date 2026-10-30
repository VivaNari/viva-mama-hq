import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import {
    IMotherReminder,
    REMINDER_CATEGORIES,
    REMINDER_FREQUENCIES,
    REMINDER_TIMES,
} from "../../types/reminder.types";
import { ECareModel } from "../../types/user.types";

/** Reminders she set on the Viva AI Reminders screen. Sent by the custom-reminders job. */
const motherReminderSchema = new Schema<IMotherReminder>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        category: {
            type: String,
            enum: REMINDER_CATEGORIES,
            required: true,
        },
        detail: {
            type: String,
            trim: true,
            maxlength: 80,
            default: null,
        },
        timeOfDay: {
            type: String,
            enum: REMINDER_TIMES,
            required: true,
        },
        frequency: {
            type: String,
            enum: REMINDER_FREQUENCIES,
            required: true,
        },
        weekdays: {
            type: [Number],
            default: [],
        },
        startDate: {
            type: String,
            required: true,
        },
        endDate: {
            type: String,
            default: null,
        },
        careModel: {
            type: String,
            enum: [...Object.values(ECareModel), null],
            default: null,
        },
        lastSentDate: {
            type: String,
            default: null,
        },
    },
    generalSchemaOptions,
);

motherReminderSchema.index({ userId: 1, createdAt: 1 });
// The job's scan: one slot at a time, not yet sent today.
motherReminderSchema.index({ timeOfDay: 1, lastSentDate: 1 });

export default motherReminderSchema;
