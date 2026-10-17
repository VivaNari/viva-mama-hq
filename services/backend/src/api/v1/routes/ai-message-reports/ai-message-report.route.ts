import { Router } from "express";

import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import AIMessageReportController from "../../controllers/ai-message-report/ai-message-report.controller";
import aiMessageReportValidator from "../../validators/ai-message-report/ai-message-report.validator";

const aiMessageReportRouter = Router();
const aiMessageReportController = new AIMessageReportController();

// Mounted here rather than under /viva-club: reports share a collection and a queue with
// community moderation, but flagging model output is not a community action and does not
// belong behind that prefix.
aiMessageReportRouter.post(
    "/ai-message-reports",
    authMiddleware("header"),
    requestValidator(aiMessageReportValidator),
    aiMessageReportController.createReport,
);

export default aiMessageReportRouter;
