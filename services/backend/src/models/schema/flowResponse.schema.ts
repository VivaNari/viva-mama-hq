import { Schema } from "mongoose";
import { IFlowResponse } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const flowResponseSchema: Schema<IFlowResponse> = new Schema<IFlowResponse>(
    {
        flowInstanceId: Schema.Types.ObjectId,
        flowDefId: {
            type: Schema.Types.ObjectId,
            ref: "flow_definitions",
            required: true,
        },
        nodeId: String,
        answer: {
            answerType: String,
            selectedKeys: {
                type: [Number],
                default: null,
            },
            freeText: {
                type: String,
                default: null,
            },
        },
        idempotencyKey: {
            type: String,
            default: null,
        },
        computed: {
            type: Object,
            default: null,
        },
    },
    generalSchemaOptions,
);

export default flowResponseSchema;
