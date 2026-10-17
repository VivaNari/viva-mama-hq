import mongoose, { Model } from "mongoose";
import { IReferralProgram } from "../types/referral.types";
import referralProgramSchema from "./schema/referral-program.schema";

const referralProgramModel: Model<IReferralProgram> = mongoose.model<IReferralProgram>(
    "referral_programs",
    referralProgramSchema,
);

export default referralProgramModel;
