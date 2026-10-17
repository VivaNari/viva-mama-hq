import mongoose, { Model } from "mongoose";

import { IFeedingLog } from "../types/feeding-log.types";
import feedingLogSchema from "./schema/feeding-log.schema";

const feedingLogModel: Model<IFeedingLog> = mongoose.model<IFeedingLog>(
    "feeding_logs",
    feedingLogSchema,
);

export default feedingLogModel;
