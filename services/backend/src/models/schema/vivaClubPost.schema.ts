import { Schema } from "mongoose";
import { IVivaClubPost } from "../../types/vivaClub.types";
import { EModerationStatus } from "../../types/moderation.types";

/**
 * Visibility state, shared by posts and comments.
 *
 * `status` has no `required` and rows written before this field existed simply lack the
 * whole `moderation` object. Read filters therefore have to ask "not hidden, not
 * removed" rather than "is VISIBLE", or every pre-existing post drops out of the feed.
 */
export const moderationStateSchema = {
    status: {
        type: String,
        enum: Object.values(EModerationStatus),
        default: EModerationStatus.VISIBLE,
    },
    reportCount: {
        type: Number,
        default: 0,
    },
    hiddenAt: {
        type: Date,
        default: null,
    },
};

const vivaClubPostSchema = new Schema<IVivaClubPost>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "users",
            required: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
        },
        mediaUrls: {
            type: [String],
            default: [],
        },
        likes: [
            {
                type: Schema.Types.ObjectId,
                ref: "users",
            },
        ],
        moderation: moderationStateSchema,
    },
    {
        timestamps: true,
    },
);

export default vivaClubPostSchema;
