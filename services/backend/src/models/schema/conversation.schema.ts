import { Schema } from "mongoose";
import { IConversation } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const conversationSchema: Schema<IConversation> = new Schema<IConversation>({
    _id: Schema.Types.ObjectId,
    userId: String,
    title: String,
    chatMode: String,
    lastMessageAt: Date,
    meta: {
        channel: String,
        tags: [String]
    },
    rating: Number,
    createdAt: Date,
    updatedAt: Date,
}, generalSchemaOptions);

export default conversationSchema;