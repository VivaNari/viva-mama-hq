import { Schema } from "mongoose";
import { IVivaClubPost } from "../../types/vivaClub.types";

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
    },
    {
        timestamps: true,
    }
);

export default vivaClubPostSchema;
