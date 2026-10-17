import { Router } from "express";
import FlowDefinitionController from "../controllers/chat-system/flow-definition.controllers";
import authMiddleware from "../../../middlewares/authorization.middleware";

const flowDefinitionrouter = Router();
const flowDefinitionController = new FlowDefinitionController();

flowDefinitionrouter.route("/flow-definition").post(flowDefinitionController.create);

flowDefinitionrouter.get(
    "/flow-definition/:slug",
    authMiddleware("header"),
    flowDefinitionController.findBySlug,
);

export default flowDefinitionrouter;
