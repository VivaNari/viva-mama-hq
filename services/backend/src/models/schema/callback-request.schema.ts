import { Schema } from "mongoose";
import { ICallbackRequest } from "../../types/callback-request.types";

const callbackRequestSchema = new Schema<ICallbackRequest>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
        careManagerId: { type: Schema.Types.ObjectId, ref: "caremanagers", required: true },
        requestStatus: {
            type: String,
            enum: ["PENDING", "COMPLETED", "UNHANDLED"],
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

export default callbackRequestSchema;
