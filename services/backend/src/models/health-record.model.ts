import mongoose, { Model } from "mongoose";
import { IHealthRecord } from "../types/health-record.types";
import healthRecordSchema from "./schema/health-record.schema";

const healthRecordModel: Model<IHealthRecord> = mongoose.model<IHealthRecord>(
    "health_records",
    healthRecordSchema,
);

export default healthRecordModel;
