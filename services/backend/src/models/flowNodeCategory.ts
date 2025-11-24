import { model, Model } from "mongoose";
import { IFlowNodeCategory } from "../types/chat.types";
import flowNodeCategorySchema from "./schema/flowNodeCategory.schema";

const flowNodeCategory: Model<IFlowNodeCategory> = model<IFlowNodeCategory>(
    "flow_node_categories",
    flowNodeCategorySchema,
);

export default flowNodeCategory;
