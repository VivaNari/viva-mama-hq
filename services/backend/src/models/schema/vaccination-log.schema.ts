import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import { VACCINE_KEYS } from "../../constants/vaccine-keys";
import { IVaccinationLog } from "../../types/vaccination-log.types";

const vaccinationLogSchema = new Schema<IVaccinationLog>(
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
        vaccineKey: {
            type: String,
            // Enumerated from the generated schedule rather than left open. The key is half
            // of this collection's primary key; an unrecognised one is a row nothing can
            // ever display and nobody would notice.
            enum: VACCINE_KEYS as unknown as string[],
            required: true,
        },
        givenOn: {
            type: Date,
            required: true,
        },
    },
    generalSchemaOptions,
);

/**
 * One row per dose per child. Recording the same dose twice updates the date it carries
 * rather than adding a second row.
 *
 * The same index serves the read: `find({userId, childId})` for the whole screen.
 */
vaccinationLogSchema.index({ userId: 1, childId: 1, vaccineKey: 1 }, { unique: true });

export default vaccinationLogSchema;
