import { model, Model } from "mongoose";
import { IExpertCategory } from "../types/expert-category.types";
import expertCategorySchema from "./schema/expert-category.schema";

const expertCategoryModel: Model<IExpertCategory> = model<IExpertCategory>(
    "expert_categories",
    expertCategorySchema,
);

export default expertCategoryModel;
