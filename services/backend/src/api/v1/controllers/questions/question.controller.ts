import { Response, Request } from "express";
import QuestionService from "../../../../services/questions/question.service";

const getQuestionService = new QuestionService();

export default class QuestionController {
    saveQuestion = async (req: Request, res: Response) => {
        await getQuestionService.saveQuestion(req, res);
    };
    getQuestions = async (req: Request, res: Response) => {
        await getQuestionService.getQuestions(req, res);
    };
}
