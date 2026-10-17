import mongoose, { Model } from "mongoose";
import { IReferralRedemption } from "../types/referral.types";
import referralRedemptionSchema from "./schema/referral-redemption.schema";

const referralRedemptionModel: Model<IReferralRedemption> = mongoose.model<IReferralRedemption>(
    "referral_redemptions",
    referralRedemptionSchema,
);

export default referralRedemptionModel;
