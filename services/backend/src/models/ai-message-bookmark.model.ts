import mongoose, { Model } from "mongoose";
import { IBookmark } from "../types/ai-message-bookmark.types";
import aiMessageBookmarkSchema from "./schema/ai-message-bookmark.schema";

const aiMessageBookmarkModel: Model<IBookmark> = mongoose.model<IBookmark>(
    "ai_message_bookmarks",
    aiMessageBookmarkSchema,
);

export default aiMessageBookmarkModel;
