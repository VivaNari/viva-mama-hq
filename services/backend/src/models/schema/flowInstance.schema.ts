import { Schema } from "mongoose";
import { IFlowInstance } from "../../types/chat.types";
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
        state: String,
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

export default flowInstanceSchema;
