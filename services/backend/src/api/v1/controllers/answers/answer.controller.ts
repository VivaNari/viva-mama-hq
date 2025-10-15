import { Request, Response } from "express";
import AnswerService from "../../../../services/answers/answer.service";

const getAnswerService = new AnswerService();

export default class AnswerController {
    saveQuestionAnswer = async (req: Request, res: Response) => {
        getAnswerService.saveAnswer(req, res);
    };
}
