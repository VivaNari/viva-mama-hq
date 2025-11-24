import { model, Model } from "mongoose";
import { IFlowResponse } from "../types/chat.types";
import flowResponseSchema from "./schema/flowResponse.schema";

const flowResponseModel: Model<IFlowResponse> = model<IFlowResponse>("flow_responses", flowResponseSchema);

export default flowResponseModel;