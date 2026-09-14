import { Schema } from "mongoose";

import { MILESTONE_KEYS } from "../../constants/milestone-keys";
import { generalSchemaOptions } from "../../constants/model";
import { IMilestoneLog } from "../../types/milestone-log.types";

const milestoneLogSchema = new Schema<IMilestoneLog>(
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
        milestoneKey: {
            type: String,
            // Enumerated from the generated catalogue rather than left open. The key is
            // half of this collection's primary key; an unrecognised one is a row nothing
            // can ever display and nobody would notice.
            enum: MILESTONE_KEYS as unknown as string[],
            required: true,
        },
        achievedOn: {
            type: Date,
            required: true,
        },
    },
    generalSchemaOptions,
);

/**
 * One row per milestone per child. Logging the same milestone twice updates the date it
 * carries rather than adding a second row.
 *
 * The same index serves the read: `find({userId, childId})` for the whole screen.
 */
milestoneLogSchema.index({ userId: 1, childId: 1, milestoneKey: 1 }, { unique: true });

export default milestoneLogSchema;
