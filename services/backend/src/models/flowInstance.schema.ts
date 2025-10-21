import { model, Model } from "mongoose";
import { IFlowInstance } from "../types/chat.types";
import flowInstanceSchema from "./schema/flowInstance.schema";

const flowInstanceModel: Model<IFlowInstance> = model<IFlowInstance>("flow_instances", flowInstanceSchema);

export default flowInstanceModel;