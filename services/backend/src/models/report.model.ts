import mongoose, { Model } from "mongoose";

import reportSchema from "./schema/report.schema";
import { IReport } from "../types/moderation.types";

const reportModel: Model<IReport> = mongoose.model<IReport>("reports", reportSchema);

export default reportModel;
