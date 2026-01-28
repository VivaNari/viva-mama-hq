import { Router } from "express";
import BookConsultationController from "../../controllers/book-consultation/book-consultation.controller";
import authMiddleware from "../../../../middlewares/authorization.middleware";

const bookConsultationRouter = Router();
const bookConsultationController = new BookConsultationController();

bookConsultationRouter.post(
    "/consultation-orders/create",
    authMiddleware("header"),
    bookConsultationController.createOrder,
);
bookConsultationRouter.post(
    "/consultation-orders/verify",
    authMiddleware("header"),
    bookConsultationController.verifyPayment,
);

export default bookConsultationRouter;
