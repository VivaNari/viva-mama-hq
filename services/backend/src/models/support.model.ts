import mongoose, { Model } from "mongoose";
import { ISupport } from "../types/support-schema.types";
import supportSchema from "./schema/support.schema";

const supportModel: Model<ISupport> = mongoose.model<ISupport>("supports", supportSchema);

export default supportModel;
