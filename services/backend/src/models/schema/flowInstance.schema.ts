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

// One instance per user, per flow, per week. This is a correctness guard, not just a
// lookup: the week job's check-then-create is a race, and Cloud Scheduler retries the job
// on a 500, so without this a retry could open a second check-in for the same week.
flowInstanceSchema.index({ userId: 1, flowSlug: 1, postpartumWeek: 1 }, { unique: true });

// Backs the notification job's nightly sweep for open check-ins.
flowInstanceSchema.index({ flowSlug: 1, state: 1 });

export default flowInstanceSchema;
