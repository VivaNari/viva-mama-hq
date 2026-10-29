import mongoose, { Model } from "mongoose";
import { IMotherLog } from "../types/mother-log.types";
import motherLogSchema from "./schema/mother-log.schema";

const motherLogModel: Model<IMotherLog> = mongoose.model<IMotherLog>("mother_logs", motherLogSchema);

export default motherLogModel;
