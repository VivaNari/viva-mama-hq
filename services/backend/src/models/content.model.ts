import mongoose from "mongoose";
import { IContent } from "../types/content.types";
import contentSchema from "./schema/content.schema";

const contentModel = mongoose.model<IContent>("contents", contentSchema);

export default contentModel;
