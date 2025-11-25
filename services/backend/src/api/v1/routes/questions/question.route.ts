import { Router } from "express";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import questionValidator from "../../validators/questions/question.validator";
import QuestionController from "../../controllers/questions/question.controller";
import authMiddleware from "../../../../middlewares/authorization.middleware";

const questionRouter = Router();
const getQuestionController = new QuestionController();

questionRouter.post(
    "/questions",
    requestValidator(questionValidator),
    getQuestionController.saveQuestion,
);
questionRouter.get("/questions", authMiddleware("header"), getQuestionController.getQuestions);

export default questionRouter;
