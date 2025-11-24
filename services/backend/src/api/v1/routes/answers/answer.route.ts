import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import AnswerController from "../../controllers/answers/answer.controller";
import answerValidator from "../../validators/answers/answer.validator";

const answerRouter = Router();
const getAnswerController = new AnswerController();

answerRouter.post(
    "/answers",
    authMiddleware(),
    requestValidator(answerValidator),
    getAnswerController.saveQuestionAnswer,
);

export default answerRouter;
