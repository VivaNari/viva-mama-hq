import mongoose, { Model } from "mongoose";
import { ICareManager } from "../types/care-manager.types";
import careManagerSchema from "./schema/care-manager.schema";

const caremanagerModel: Model<ICareManager> = mongoose.model<ICareManager>(
    "care_managers",
    careManagerSchema,
);

export default caremanagerModel;
