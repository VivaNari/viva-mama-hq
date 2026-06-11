import mongoose, { Model } from "mongoose";
import { IMoodLog } from "../types/mood-log.types";
import moodLogSchema from "./schema/mood-log.schema";

const moodLogModel: Model<IMoodLog> = mongoose.model<IMoodLog>("mood_logs", moodLogSchema);

export default moodLogModel;
