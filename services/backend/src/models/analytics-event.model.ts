import mongoose, { Model } from "mongoose";
import { IAnalyticsEvent } from "../types/analytics.types";
import analyticsEventSchema from "./schema/analytics-event.schema";

const analyticsEventModel: Model<IAnalyticsEvent> = mongoose.model<IAnalyticsEvent>(
    "analytics_events",
    analyticsEventSchema,
);

export default analyticsEventModel;
