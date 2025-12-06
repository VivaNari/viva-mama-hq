import { Router } from "express";
import PaymentController from "../../controllers/payments/payment.controller";
import authMiddleware from "../../../../middlewares/authorization.middleware";

const paymentrouter = Router();
const paymentController = new PaymentController();

paymentrouter.post("/orders/create", authMiddleware("header"), paymentController.createOrder);
paymentrouter.post("/orders/verify", authMiddleware("header"), paymentController.verifyPayment);
paymentrouter.post(
    "/subscribe/select-free-plan",
    authMiddleware("header"),
    paymentController.selectFreePlan,
);

export default paymentrouter;
