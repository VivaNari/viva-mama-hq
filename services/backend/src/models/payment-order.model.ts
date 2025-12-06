import { model, Model } from "mongoose";
import paymentOrderSchema from "./schema/payment-order.schema";
import { IPaymentOrder } from "../types/payment.types";

const paymentOrderModel: Model<IPaymentOrder> = model<IPaymentOrder>(
    "payment_orders",
    paymentOrderSchema,
);

export default paymentOrderModel;
