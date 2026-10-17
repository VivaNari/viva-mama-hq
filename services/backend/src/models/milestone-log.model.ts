import mongoose, { Model } from "mongoose";

import { IMilestoneLog } from "../types/milestone-log.types";
import milestoneLogSchema from "./schema/milestone-log.schema";

const milestoneLogModel: Model<IMilestoneLog> = mongoose.model<IMilestoneLog>(
    "milestone_logs",
    milestoneLogSchema,
);

export default milestoneLogModel;
