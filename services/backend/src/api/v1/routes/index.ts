import { Router } from "express";
import flowDefinitionRouter from "./flow-definition.routes";
import flowNodeCategoryRouter from "./flow-node-category.route";
import chatFlowRouter from "./chat-flow.routes";
import recommendationRouter from "./recommendation.routes";
import paymentrouter from "./payments/payment.route";
import recommendationHistoryRouter from "./recommendation-history.routes";
import contentRouter from "./contents/content.route";
import productRouter from "./products/product.route";
import weeklyCheckinRouter from "./weeklyCheckin.routes";
import expertRouter from "./experts/expert.route";
import careManagerRouter from "./care-managers/care-manager.route";
import bookConsultationRouter from "./book-consultation/book-consultation.route";
import consultationRouter from "./consultations/consultation.routes";
import consultationReviewRouter from "./consultation-reviews/consultation-review.route";
import weeklyCheckinV1Router from "./weekly-checkin-v1.routes";
import aiBookmarkRouter from "./ai-message-bookmarks/ai-message-bookmark.route";

const router = Router();

router.use(flowDefinitionRouter);
router.use(flowNodeCategoryRouter);
router.use(chatFlowRouter);
router.use(recommendationRouter);
router.use(paymentrouter);
router.use(recommendationHistoryRouter);
router.use(contentRouter);
router.use(productRouter);
router.use(weeklyCheckinRouter);
router.use(consultationRouter);
router.use(expertRouter);
router.use(careManagerRouter);
router.use(bookConsultationRouter);
router.use(consultationReviewRouter);
router.use(weeklyCheckinV1Router);
router.use(aiBookmarkRouter);

export default router;
