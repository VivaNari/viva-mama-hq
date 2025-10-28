import { Router } from "express";
import FlowDefinitionController from "../controllers/chat-system/flow-definition.controllers";

const router = Router();
const flowDefinitionController = new FlowDefinitionController();

router.route("/flow-definition").post(flowDefinitionController.create);

export default router;
