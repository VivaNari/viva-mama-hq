import mongoose, { Model } from "mongoose";
import { IUsageCounter } from "../types/subscription.types";
import usageCounterSchema from "./schema/usage-counter.schema";

const usageCounterModel: Model<IUsageCounter> = mongoose.model<IUsageCounter>(
    "usage_counters",
    usageCounterSchema,
);

export default usageCounterModel;
