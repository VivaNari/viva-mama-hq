import { Schema } from "mongoose";
import { IVivaClubComment } from "../../types/vivaClub.types";

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
    },
    {
        timestamps: true,
    }
);

export default vivaClubCommentSchema;
