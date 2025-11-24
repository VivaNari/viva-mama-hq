import { Router } from "express";
import ChatFlowController from "../controllers/chat-system/chat-flow.controller";
import authMiddleware from "../../../middlewares/authorization.middleware";

const chatFlowRouter = Router();
const chatFlowController = new ChatFlowController();

chatFlowRouter.get(
    "/chat-session/:slug",
    authMiddleware("query"),
    chatFlowController.handleSseConnection,
);
chatFlowRouter.post("/chat-flow/answer", authMiddleware("header"), chatFlowController.saveAnswer);

export default chatFlowRouter;
