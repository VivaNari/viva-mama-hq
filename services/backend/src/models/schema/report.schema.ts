import { Schema } from "mongoose";

import { generalSchemaOptions } from "../../constants/model";
import {
    EReportReason,
    EReportStatus,
    EReportTargetType,
    IReport,
} from "../../types/moderation.types";

const reportSchema = new Schema<IReport>(
    {
        targetType: {
            type: String,
            enum: Object.values(EReportTargetType),
            required: true,
        },
        targetId: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        // Denormalised so the queue can show and ban an author whose content has since
        // been deleted, without a join that would resolve to nothing.
        targetAuthor: {
            type: Schema.Types.ObjectId,
            ref: "users",
            default: null,
        },
        reporter: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        reason: {
            type: String,
            enum: Object.values(EReportReason),
            required: true,
        },
        details: {
            type: String,
            maxlength: 500,
            default: null,
            trim: true,
        },
        snapshot: {
            type: String,
            default: "",
        },
        // The user turn that produced the reported AI reply. Null for community content,
        // where the post stands on its own. Kept out of `snapshot` so that field keeps
        // meaning "the thing being reported" for every target type.
        contextSnapshot: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: Object.values(EReportStatus),
            default: EReportStatus.PENDING,
            index: true,
        },
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: "users",
            default: null,
        },
        reviewedAt: { type: Date, default: null },
        reviewerNote: { type: String, default: null },
    },
    generalSchemaOptions,
);

/**
 * One report per user per item.
 *
 * This is what makes the auto-hide threshold mean "three distinct people", rather than
 * "three taps" — without it a single user could hide any post on their own. A duplicate
 * insert throws 11000, which the service treats as "already reported" and returns as
 * success, the same idempotency shape used for Razorpay webhook events.
 */
reportSchema.index({ targetType: 1, targetId: 1, reporter: 1 }, { unique: true });

/** The queue's default read: oldest pending first, within a status filter. */
reportSchema.index({ status: 1, createdAt: 1 });

export default reportSchema;
