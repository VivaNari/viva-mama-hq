import { Request, Response } from "express";
import AnswerModel from "../../models/answer.model";
import mongoose from "mongoose";
import QuestionModel from "../../models/question.model";

export default class AnswerService {
    saveAnswer = async (req: Request, res: Response) => {
        try {
            const { answer, question_object_id, child_object_id } = req.body;

            const user = req.user;

            if (!question_object_id || !child_object_id) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            const question = await QuestionModel.findById(question_object_id)
                .select("question_id")
                .lean();
            if (!question) {
                return res.status(404).json({ message: "Question not found." });
            }

            const today = new Date();
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const diffInMs = today.getTime() - startOfYear.getTime();
            const oneDayInMs = 1000 * 60 * 60 * 24;

            const currentYear = today.getFullYear();
            const dayOfYear = Math.floor(diffInMs / oneDayInMs) + 1;

            const newAnswer = new AnswerModel({
                question_object_id: question_object_id,
                question_id: question.question_id,
                answer: answer,
                child_object_id: child_object_id,
                year: currentYear,
                day: dayOfYear,
                user_id: user?.user_id,
                user_object_id: user?._id,
            });

            const savedAnswer = await newAnswer.save();

            res.status(201).json(savedAnswer);
        } catch (error) {
            console.error("Error saving answer:", error);
            if (error instanceof mongoose.Error.ValidationError) {
                return res.status(400).json({ message: "Validation Error", details: error.errors });
            }
            res.status(500).json({ message: "An internal server error occurred." });
        }
    };
}
