import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import addConsultationReviewValidator from "../../validators/consultation-reviews/consultation-review.validator";
import { ConsultationReviewController } from "../../controllers/consultation-reviews/consultation-reviews.controller";

const consultationReviewRouter = Router();
const consultationReviewController = new ConsultationReviewController();

consultationReviewRouter.post(
    "/consultation-review",
    authMiddleware(),
    requestValidator(addConsultationReviewValidator),
    consultationReviewController.createConsultationReview,
);

export default consultationReviewRouter;
