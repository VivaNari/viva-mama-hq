import mongoose, { Model } from "mongoose";

import { IGrowthLog } from "../types/growth-log.types";
import growthLogSchema from "./schema/growth-log.schema";

const growthLogModel: Model<IGrowthLog> = mongoose.model<IGrowthLog>(
    "growth_logs",
    growthLogSchema,
);

export default growthLogModel;
