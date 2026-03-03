import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { ISupport } from "../../types/support-schema.types";

const supportSchema: Schema<ISupport> = new Schema<ISupport>(
    {
        supportType: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        isResolved: {
            type: Boolean,
            required: true,
            default: false,
        },
        resolvedAt: {
            type: Date,
            required: false,
            default: null,
        },
    },
    generalSchemaOptions,
);

export default supportSchema;
