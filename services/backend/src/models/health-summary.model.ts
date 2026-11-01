import mongoose, { Model } from "mongoose";
import { IHealthSummary } from "../types/health-record.types";
import healthSummarySchema from "./schema/health-summary.schema";

const healthSummaryModel: Model<IHealthSummary> = mongoose.model<IHealthSummary>(
    "health_summaries",
    healthSummarySchema,
);

export default healthSummaryModel;
