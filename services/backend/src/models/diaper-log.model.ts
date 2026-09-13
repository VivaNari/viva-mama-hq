import mongoose, { Model } from "mongoose";

import { IDiaperLog } from "../types/diaper-log.types";
import diaperLogSchema from "./schema/diaper-log.schema";

const diaperLogModel: Model<IDiaperLog> = mongoose.model<IDiaperLog>(
    "diaper_logs",
    diaperLogSchema,
);

export default diaperLogModel;
