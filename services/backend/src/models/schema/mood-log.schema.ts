import { Schema } from "mongoose";
import { IMoodLog } from "../../types/mood-log.types";
import { generalSchemaOptions } from "../../constants/model";

const moodLogSchema = new Schema<IMoodLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        mood: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        logDate: {
            type: Date,
            required: true,
        },
    },
    generalSchemaOptions,
);

// One editable mood log per user per calendar day.
moodLogSchema.index({ userId: 1, logDate: 1 }, { unique: true });

export default moodLogSchema;
