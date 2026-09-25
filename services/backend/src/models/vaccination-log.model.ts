import mongoose, { Model } from "mongoose";

import { IVaccinationLog } from "../types/vaccination-log.types";
import vaccinationLogSchema from "./schema/vaccination-log.schema";

const vaccinationLogModel: Model<IVaccinationLog> = mongoose.model<IVaccinationLog>(
    "vaccination_logs",
    vaccinationLogSchema,
);

export default vaccinationLogModel;
