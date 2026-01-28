import { Router } from "express";
import FlowNodeController from "../controllers/chat-system/flow-node-category.controller";

const flowNodeCategoryRouter = Router();
const flowNodeController = new FlowNodeController();

flowNodeCategoryRouter.route("/flow-node-categories").post(flowNodeController.create);

export default flowNodeCategoryRouter;
