import { Document, Schema } from "mongoose";

import { IModerationState } from "./moderation.types";

export interface IVivaClubPost extends Document {
    user: Schema.Types.ObjectId;
    content: string;
    mediaUrls: string[];
    likes: Schema.Types.ObjectId[];
    /** Absent on rows created before moderation existed — see moderationStateSchema. */
    moderation?: IModerationState;
    createdAt: Date;
    updatedAt: Date;
}

export interface IVivaClubComment extends Document {
    post: Schema.Types.ObjectId;
    user: Schema.Types.ObjectId;
    content: string;
    moderation?: IModerationState;
    createdAt: Date;
    updatedAt: Date;
}
