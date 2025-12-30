import { Types } from "mongoose";

export type CallbackRequestStatus = "PENDING" | "COMPLETED" | "UNHANDLED";

export interface ICallbackRequest extends Document {
    userId: Types.ObjectId;
    careManagerId: Types.ObjectId;
    requestedAt: Date;
    requestStatus: CallbackRequestStatus;
}
