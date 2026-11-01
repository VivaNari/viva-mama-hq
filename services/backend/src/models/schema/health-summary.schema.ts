import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import { EHealthSummaryStatus, IHealthSummary } from "../../types/health-record.types";

/**
 * Every overall health summary she has generated. The latest READY one is what the
 * Dashboard shows; older ones are kept as snapshots of what she may have shared.
 */
const healthSummarySchema = new Schema<IHealthSummary>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "users", required: true },
        status: {
            type: String,
            enum: Object.values(EHealthSummaryStatus),
            default: EHealthSummaryStatus.PENDING,
        },
        lang: { type: String, enum: ["en", "hi"], default: "en" },
        // The records it was built from, to tell when it is out of date.
        sourceRecordIds: { type: [Schema.Types.ObjectId], default: [] },
        content: { type: Schema.Types.Mixed, default: null },
        shareText: { type: String, default: null },
        errorCode: { type: String, default: null },
        quotaRefunded: { type: Boolean, default: false },
    },
    generalSchemaOptions,
);

healthSummarySchema.index({ userId: 1, status: 1, createdAt: -1 });
healthSummarySchema.index({ status: 1, createdAt: 1 });

export default healthSummarySchema;
