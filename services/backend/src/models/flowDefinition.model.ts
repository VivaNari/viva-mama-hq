import { model, Model } from "mongoose";
import { IFlowDefinition } from "../types/chat.types";
import flowDefinitionSchema from "./schema/flowDefinition.schema";

const flowDefintionModel: Model<IFlowDefinition> = model<IFlowDefinition>(
    "flow_definitions",
    flowDefinitionSchema,
);

export default flowDefintionModel;
