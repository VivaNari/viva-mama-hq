import { Router } from "express";
import flowDefinitionRouter from "./flow-definition.routes";
import flowNodeCategoryRouter from "./flow-node-category.route";
import chatFlowRouter from "./chat-flow.routes";
import recommendationRouter from "./recommendation.routes";
import testRouter from "./test.route";

const router = Router();

router.use(flowDefinitionRouter);
router.use(flowNodeCategoryRouter);
router.use(chatFlowRouter);
router.use(recommendationRouter);
router.use(testRouter);

export default router;
