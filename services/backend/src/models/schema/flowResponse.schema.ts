import { Schema } from "mongoose";
import { IFlowResponse } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const flowResponseSchema: Schema<IFlowResponse> = new Schema<IFlowResponse>({
    flowInstanceId: Schema.Types.ObjectId,
    nodeId: String,
    answer: {
        type: String,
        selectedKeys: {
            type: [String],
            default: null
        },
        freeText: {
            type: String,
            default: null
        }
    },
    computed: {
        type: Object,
        default: null
    } 
}, generalSchemaOptions);

export default flowResponseSchema;