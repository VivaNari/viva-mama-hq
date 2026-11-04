import { Router } from "express";
import ChatFlowController from "../controllers/chat-system/chat-flow.controller";
import authMiddleware from "../../../middlewares/authorization.middleware";
import requestValidator from "../../../middlewares/requestValidator.middleware";
import { speechTextValidator } from "../validators/chat-system/speech-text.validator";

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

/** A Devanagari copy of a Hinglish reply, for reading it aloud. */
chatFlowRouter.post(
    "/chat-flow/speech-text",
    authMiddleware("header"),
    requestValidator(speechTextValidator),
    chatFlowController.getSpeechText,
);

export default chatFlowRouter;
