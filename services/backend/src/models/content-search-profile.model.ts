import mongoose, { Model } from "mongoose";
import { IContentSearchProfile } from "../types/content-search-profile.types";
import contentSearchProfileSchema from "./schema/content-search-profile.schema";

const contentSearchProfileModel: Model<IContentSearchProfile> =
    mongoose.model<IContentSearchProfile>("content_search_profiles", contentSearchProfileSchema);

export default contentSearchProfileModel;
