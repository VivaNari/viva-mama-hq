import { Schema } from "mongoose";
import { FlowInstanceStateEnum, IFlowInstance } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const flowInstanceSchema: Schema<IFlowInstance> = new Schema<IFlowInstance>(
    {
        userId: Schema.Types.ObjectId,
        conversationId: Schema.Types.ObjectId,
        flowDefId: Schema.Types.ObjectId,
        flowSlug: String,
        version: Number,
        postpartumWeek: Number,
        postpartumDays: Number,
        // The child this run is about, for per-child flows (baby-onboarding-v1). null for
        // every mother flow, which is what keeps their uniqueness guarantee below intact.
        subjectChildId: {
            type: Schema.Types.ObjectId,
            default: null,
        },
        state: {
            type: String,
            enum: Object.values(FlowInstanceStateEnum),
        },
        cursorNodeId: {
            type: String,
            default: null,
        },
        variables: Object,
        outcome: {
            type: {
                key: String,
                title: String,
                summary: String,
                recommendations: [String],
            },
            default: null,
        },
    },
    generalSchemaOptions,
);

// One instance per user, per flow, per week, PER SUBJECT. This is a correctness guard, not
// just a lookup: the week job's check-then-create is a race, and Cloud Scheduler retries
// the job on a 500, so without this a retry could open a second check-in for the same week.
//
// subjectChildId joined the key when baby onboarding landed: a mother with two children
// legitimately needs two baby-onboarding-v1 instances, which the old three-field key
// forbade. Every mother flow writes null there, so their uniqueness is exactly as before.
//
// Mongoose does NOT drop the superseded three-field index on its own — that is done by the
// reindex-flow-instances-subject migration step.
flowInstanceSchema.index(
    { userId: 1, flowSlug: 1, postpartumWeek: 1, subjectChildId: 1 },
    { unique: true },
);

// Backs the notification job's nightly sweep for open check-ins.
flowInstanceSchema.index({ flowSlug: 1, state: 1 });

export default flowInstanceSchema;
