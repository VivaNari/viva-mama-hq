import { model, Model } from "mongoose";
import { IExpert } from "../types/expert.types";
import expertSchema from "./schema/expert.schema";

const expertModel: Model<IExpert> = model<IExpert>("experts", expertSchema);

export default expertModel;
