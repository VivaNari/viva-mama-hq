import mongoose, { Model } from "mongoose";
import { IChatAttachment } from "../types/chat-attachment.types";
import chatAttachmentSchema from "./schema/chat-attachment.schema";

const chatAttachmentModel: Model<IChatAttachment> = mongoose.model<IChatAttachment>(
    "chat_attachments",
    chatAttachmentSchema,
);

export default chatAttachmentModel;
