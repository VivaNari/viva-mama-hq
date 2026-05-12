import { Document, Schema } from "mongoose";

export interface IVivaClubPost extends Document {
    user: Schema.Types.ObjectId;
    content: string;
    mediaUrls: string[];
    likes: Schema.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

export interface IVivaClubComment extends Document {
    post: Schema.Types.ObjectId;
    user: Schema.Types.ObjectId;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}
