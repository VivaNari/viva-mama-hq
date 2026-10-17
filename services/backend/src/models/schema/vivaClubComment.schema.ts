import { Schema } from "mongoose";
import { IVivaClubComment } from "../../types/vivaClub.types";
import { moderationStateSchema } from "./vivaClubPost.schema";

const vivaClubCommentSchema = new Schema<IVivaClubComment>(
    {
        post: {
            type: Schema.Types.ObjectId,
            ref: "vivaClubPosts",
            required: true,
        },
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
        moderation: moderationStateSchema,
    },
    {
        timestamps: true,
    },
);

export default vivaClubCommentSchema;
