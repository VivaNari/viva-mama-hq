import { Schema } from "mongoose";
import { IMessage } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const messageSchema: Schema<IMessage> = new Schema<IMessage>(
    {
        conversationId: Schema.Types.ObjectId,
        userId: String,
        role: String,
        type: String,
        text: String,
        rich: {
            type: String,
            default: null,
        },
        attachments: {
            type: [
                {
                    type: String,
                    url: String,
                    meta: Schema.Types.Mixed,
                },
            ],
            default: null,
        },
        ai: {
            type: {
                promptId: String,
                provider: String,
                model: String,
                ragUsed: Boolean,
                citations: [{ title: String, url: String }],
                tokens: { prompt: Number, completion: Number },
                latencyMs: Number,
            },
            default: null,
        },
        guided: {
            type: {
                flowInstanceId: Schema.Types.ObjectId,
                nodeId: String,
                optionKey: String,
            },
            default: null,
        },
    },
    generalSchemaOptions,
);

export default messageSchema;
