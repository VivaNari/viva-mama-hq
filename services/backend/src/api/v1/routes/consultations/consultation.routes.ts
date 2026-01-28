import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { ConsultationController } from "../../controllers/consultations/consultation.controller";
import addConsultationRequestValidator from "../../validators/consultations/consultation.validator";

const consultationRouter = Router();
const consultationController = new ConsultationController();

consultationRouter.post(
    "/callback-request",
    authMiddleware(),
    requestValidator(addConsultationRequestValidator),
    consultationController.requestCallback,
);
consultationRouter.put(
    "/admin/consultation/:id/completed",
    authMiddleware(),
    consultationController.completeConsultation,
);
consultationRouter.get(
    "/pending-consultations",
    authMiddleware(),
    consultationController.getPendingConsultations,
);

export default consultationRouter;
