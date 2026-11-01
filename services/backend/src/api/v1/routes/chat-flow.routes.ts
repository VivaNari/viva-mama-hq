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

chatFlowRouter.post("/chat-flow/answer", authMiddleware("header"), chatFlowController.saveResponse);

/** Fallback for a chatbot reply the stream did not deliver. */
chatFlowRouter.get("/chat-flow/reply", authMiddleware("header"), chatFlowController.getReply);

export default chatFlowRouter;
