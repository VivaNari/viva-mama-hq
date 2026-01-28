import mongoose, { Model } from "mongoose";
import { IConsultationRequest } from "../types/consultation.types";
import consultationSchema from "./schema/consultation.schema";

const consultationModel: Model<IConsultationRequest> = mongoose.model<IConsultationRequest>(
    "consultations",
    consultationSchema,
);

export default consultationModel;
