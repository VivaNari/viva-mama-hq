import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import {
    IMotherMedicine,
    MEDICINE_FREQUENCIES,
    MEDICINE_PRESETS,
} from "../../types/mother-log.types";

/** The medicines and supplements on her list. Doses taken are `medicine_dose` logs. */
const motherMedicineSchema = new Schema<IMotherMedicine>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        presetKey: {
            type: String,
            enum: [...MEDICINE_PRESETS, null],
            default: null,
        },
        name: {
            type: String,
            trim: true,
            maxlength: 60,
            default: null,
        },
        frequency: {
            type: String,
            enum: MEDICINE_FREQUENCIES,
            required: true,
        },
        active: {
            type: Boolean,
            default: true,
        },
    },
    generalSchemaOptions,
);

motherMedicineSchema.index({ userId: 1, active: 1, createdAt: 1 });

export default motherMedicineSchema;
