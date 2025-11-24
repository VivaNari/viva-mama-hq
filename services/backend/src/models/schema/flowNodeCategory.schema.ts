import { Schema } from "mongoose";
import { IFlowNodeCategory } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const flowNodeCategorySchema: Schema<IFlowNodeCategory> = new Schema<IFlowNodeCategory>(
    {
        categoryName: String,
    },
    generalSchemaOptions,
);

export default flowNodeCategorySchema;
