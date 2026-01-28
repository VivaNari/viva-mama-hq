import { Schema } from "mongoose";

export interface IBookmark {
    _id: Schema.Types.ObjectId;
    messageId: Schema.Types.ObjectId;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}
