import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { ConsultationController } from "../../controllers/consultations/consultation.controller";
import addConsultationRequestValidator from "../../validators/consultations/consultation.validator";

const consultationRouter = Router();
const getConsultationController = new ConsultationController();

consultationRouter.post(
    "/callback-request",
    authMiddleware(),
    requestValidator(addConsultationRequestValidator),
    getConsultationController.requestCallback,
);
consultationRouter.put(
    "/admin/consultation/:id/completed",
    authMiddleware(),
    getConsultationController.completeConsultation,
);
consultationRouter.get(
    "/active-consultations",
    authMiddleware(),
    getConsultationController.getActiveConsultations,
);

export default consultationRouter;
