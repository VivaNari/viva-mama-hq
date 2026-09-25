import mongoose, { Model } from "mongoose";
import { IOrganization } from "../types/referral.types";
import organizationSchema from "./schema/organization.schema";

const organizationModel: Model<IOrganization> = mongoose.model<IOrganization>(
    "organizations",
    organizationSchema,
);

export default organizationModel;
