import mongoose, { Model, Schema } from "mongoose";
import { generalSchemaOptions } from "../constants/model";

/**
 * A GCS prefix whose objects still have to be deleted, because deleting them failed
 * during account deletion. Holds only the prefix, not a reference to the (by then
 * deleted) user. The attachment janitor retries these; the bucket's 90-day lifecycle
 * rule is the backstop.
 */
export interface IPendingGcsPurge {
    bucket: string;
    prefix: string;
    attempts: number;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const pendingGcsPurgeSchema = new Schema<IPendingGcsPurge>(
    {
        bucket: { type: String, required: true },
        prefix: { type: String, required: true },
        attempts: { type: Number, default: 0 },
        lastError: { type: String, default: null },
    },
    generalSchemaOptions,
);

const pendingGcsPurgeModel: Model<IPendingGcsPurge> = mongoose.model<IPendingGcsPurge>(
    "pending_gcs_purges",
    pendingGcsPurgeSchema,
);

export default pendingGcsPurgeModel;
