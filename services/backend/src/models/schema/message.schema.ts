import { Schema } from "mongoose";
import { AttachmentTypeEnum, IMessage } from "../../types/chat.types";
import { generalSchemaOptions } from "../../constants/model";

const messageAttachmentSchema = new Schema(
    {
        attachmentId: { type: Schema.Types.ObjectId, ref: "chat_attachments", required: true },
        kind: { type: String, enum: Object.values(AttachmentTypeEnum), required: true },
        mimeType: { type: String, required: true },
        sizeBytes: { type: Number, default: null },
        width: { type: Number, default: null },
        height: { type: Number, default: null },
        pageCount: { type: Number, default: null },
        originalName: { type: String, default: null },
    },
    { _id: false },
);

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
        // What she attached to this turn. Metadata only: the bytes live in GCS and are
        // reached through chat_attachments, and a URL is minted per read, never stored.
        // (This was once `[{ type: String, ... }]`, which mongoose reads as `[String]`.)
        attachments: {
            type: [messageAttachmentSchema],
            default: null,
        },
        // Set by the app on her turn so a retried POST is recognised, and copied onto
        // the reply as `replyTo` so the app can match (or poll for) the answer.
        clientMessageId: { type: String, default: null },
        replyTo: { type: String, default: null },
        // The chatbot session the reply belongs to, so a reply fetched by polling can
        // continue the same conversation memory.
        sessionId: { type: String, default: null },
        // On a reply that is not an answer: why her turn could not be processed.
        errorCode: { type: String, default: null },
        // Set once when the AI_CHAT unit spent on this turn is given back.
        quotaRefunded: { type: Boolean, default: false },
        // Outcome of the attachment check, on the reply to an attachment turn.
        attachmentVerdict: {
            type: {
                verdict: String,
                category: String,
                subject: String,
                reasonCode: String,
            },
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
        // Logs Viva read out of her message, validated and waiting for her Yes. Kept
        // on the message so the confirm card survives an app restart and so the
        // record shows what she agreed to. See IPendingLog.
        pendingLogs: {
            type: [
                {
                    logType: { type: String, required: true },
                    fields: { type: Schema.Types.Mixed, default: {} },
                    mode: { type: String, enum: ["add", "set", null], default: null },
                    medicineId: { type: Schema.Types.ObjectId, default: null },
                    medicineRef: { type: Schema.Types.Mixed, default: null },
                    status: {
                        type: String,
                        enum: ["pending", "saved", "dismissed", "needs_medicine"],
                        default: "pending",
                    },
                    savedLogId: { type: Schema.Types.ObjectId, default: null },
                },
            ],
            default: [],
        },
    },
    generalSchemaOptions,
);

// A retried POST of the same turn must not create (or pay for) a second one.
messageSchema.index(
    { userId: 1, clientMessageId: 1 },
    { unique: true, partialFilterExpression: { clientMessageId: { $type: "string" } } },
);
messageSchema.index(
    { userId: 1, replyTo: 1 },
    { partialFilterExpression: { replyTo: { $type: "string" } } },
);

export default messageSchema;
