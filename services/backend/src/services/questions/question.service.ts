import { Response, Request } from "express";
import QuestionModel from "../../models/question.model";

export default class QuestionService {
    saveQuestion = async (req: Request, res: Response) => {
        try {
            const { question, isForOnboarding, answerType, options, frequency, interval } =
                req.body;

            const newQuestion = new QuestionModel({
                question,
                isForOnboarding,
                answerType,
                options,
                frequency,
                interval,
            });

            const savedQuestion = await newQuestion.save();

            res.status(201).json(savedQuestion);
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ message: "Error creating question", error: error.message });
            } else {
                res.status(500).json({ message: "An unknown error occurred" });
            }
        }
    };

    getQuestions = async (req: Request, res: Response) => {
        const { questionType } = req.query;
        try {
            let questions;
            if (questionType === "onboarding") {
                questions = await QuestionModel.find({ isForOnboarding: true });
                res.status(200).json(questions);
            } else {
                questions = await QuestionModel.find({ frequency: questionType });
                res.status(200).json(questions);
            }
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ message: "Error fetching questions", error: error.message });
            } else {
                res.status(500).json({ message: "An unknown error occurred" });
            }
        }
    };
}
