import mongoose, { Model } from "mongoose";
import { ICallbackRequest } from "../types/callback-request.types";
import callbackRequestSchema from "./schema/callback-request.schema";

const callbackRequestModel: Model<ICallbackRequest> = mongoose.model<ICallbackRequest>(
    "callbackrequests",
    callbackRequestSchema,
);

export default callbackRequestModel;
