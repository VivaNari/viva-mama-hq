import { Schema } from "mongoose";
import { generalSchemaOptions } from "../../constants/model";
import { EBillingProvider, IWebhookEvent } from "../../types/subscription.types";

/**
 * Idempotency record for provider webhooks (AUTOPAY).
 *
 * Razorpay retries delivery until it gets a 2xx, so the same `subscription.charged`
 * event can arrive several times. Without this, a redelivery would grant a second set
 * of consultation credits. The unique index on providerEventId is the guard: the
 * handler inserts first and treats a duplicate-key error as "already processed".
 *
 * Created now, ahead of the AUTOPAY provider, so the webhook route has somewhere to
 * write from its first commit.
 */
const webhookEventSchema = new Schema<IWebhookEvent>(
    {
        providerEventId: { type: String, required: true, unique: true },
        provider: {
            type: String,
            enum: Object.values(EBillingProvider),
            required: true,
        },
        type: { type: String, required: true },
        payload: { type: Schema.Types.Mixed, default: {} },
        // Null until the handler finishes: an insert with processedAt null that is
        // never filled in marks an event that crashed mid-handling, so failures are
        // visible rather than silently swallowed.
        processedAt: { type: Date, default: null },
        error: { type: String, default: null },
    },
    generalSchemaOptions,
);

export default webhookEventSchema;
