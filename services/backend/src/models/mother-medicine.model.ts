import mongoose, { Model } from "mongoose";
import { IMotherMedicine } from "../types/mother-log.types";
import motherMedicineSchema from "./schema/mother-medicine.schema";

const motherMedicineModel: Model<IMotherMedicine> = mongoose.model<IMotherMedicine>(
    "mother_medicines",
    motherMedicineSchema,
);

export default motherMedicineModel;
