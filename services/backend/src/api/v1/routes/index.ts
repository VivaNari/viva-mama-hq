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
import callbackRequestRouter from "./callback-request/callback-request.routes";
import expertRouter from "./experts/expert.route";

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
router.use(callbackRequestRouter);
router.use(expertRouter);

export default router;
