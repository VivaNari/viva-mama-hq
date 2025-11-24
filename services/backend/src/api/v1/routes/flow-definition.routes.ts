import { Router } from "express";
import FlowDefinitionController from "../controllers/chat-system/flow-definition.controllers";

const flowDefinitionrouter = Router();
const flowDefinitionController = new FlowDefinitionController();

flowDefinitionrouter.route("/flow-definition").post(flowDefinitionController.create);

export default flowDefinitionrouter;
