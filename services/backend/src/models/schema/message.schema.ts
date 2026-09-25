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
        // Experts the AI recommended in this message, already validated against what
        // the user is allowed to see. The app renders a "Connect" button from these.
        // Stored (rather than sent over SSE only) so the record matches what she was
        // actually shown, and so referral-to-booking conversion stays queryable.
        suggestedExperts: {
            type: [
                {
                    expertId: { type: Schema.Types.ObjectId, ref: "experts" },
                    name: String,
                    speciality: String,
                },
            ],
            default: [],
        },
    },
    generalSchemaOptions,
);

export default messageSchema;
