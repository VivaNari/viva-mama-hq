import { Router } from "express";
import FlowDefinitionController from "../controllers/chat-system/flow-definition.controllers";

const router = Router();
const flowDefinitionController = new FlowDefinitionController();

router.route("/").post(flowDefinitionController.create);

module.exports = router;