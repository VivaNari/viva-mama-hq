import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { ConsultationController } from "../../controllers/consultations/consultation.controller";
import addConsultationRequestValidator, {
    bookWithCreditValidator,
} from "../../validators/consultations/consultation.validator";

const consultationRouter = Router();
const consultationController = new ConsultationController();

consultationRouter.post(
    "/callback-request",
    authMiddleware(),
    requestValidator(addConsultationRequestValidator),
    consultationController.requestCallback,
);
// Books an expert with a subscription credit instead of a payment. The paid route
// (consultation-orders/*) stays for FREE and TRIAL users and for premium users who
// have run out.
consultationRouter.post(
    "/consultations/book-with-credit",
    authMiddleware(),
    requestValidator(bookWithCreditValidator),
    consultationController.bookExpertWithCredit,
);
// The three `/admin/consultation/:id/*` routes that used to live here have moved to
// api/v1/routes/admin/admin.route.ts. They were guarded by the ordinary user JWT, so
// any logged-in patient could confirm or cancel anyone's consultation.
consultationRouter.get(
    "/pending-consultations",
    authMiddleware(),
    consultationController.getPendingConsultations,
);
// The patient's own booking history, stage-tagged for the Upcoming/Ongoing/Past tabs.
consultationRouter.get(
    "/my-consultations",
    authMiddleware(),
    consultationController.getMyConsultations,
);
// Names the consultant on the post-call rating screen, which is opened from a push
// payload carrying only the consultation id.
consultationRouter.get(
    "/consultations/:consultationId/review-context",
    authMiddleware(),
    consultationController.getConsultationReviewContext,
);

export default consultationRouter;
