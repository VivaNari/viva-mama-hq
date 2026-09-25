import mongoose, { Model } from "mongoose";
import { IWebhookEvent } from "../types/subscription.types";
import webhookEventSchema from "./schema/webhook-event.schema";

const webhookEventModel: Model<IWebhookEvent> = mongoose.model<IWebhookEvent>(
    "webhook_events",
    webhookEventSchema,
);

export default webhookEventModel;
