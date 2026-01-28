import mongoose, { Model } from "mongoose";
import { IBookConsultationOrder } from "../types/book-consultation.types";
import bookConsultationOrderSchema from "./schema/book-consultation-order.schema";

const bookConsultationOrderModel: Model<IBookConsultationOrder> =
    mongoose.model<IBookConsultationOrder>("bookConsultation_orders", bookConsultationOrderSchema);

export default bookConsultationOrderModel;
