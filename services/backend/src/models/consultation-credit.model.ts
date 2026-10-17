import mongoose, { Model } from "mongoose";
import { IConsultationCredit } from "../types/subscription.types";
import consultationCreditSchema from "./schema/consultation-credit.schema";

const consultationCreditModel: Model<IConsultationCredit> = mongoose.model<IConsultationCredit>(
    "consultation_credits",
    consultationCreditSchema,
);

export default consultationCreditModel;
