import mongoose from "mongoose";
import questionSchema from "./schemas/question.schema";
import { IQuestion } from "../types";

const QuestionModel = mongoose.model<IQuestion>("questions", questionSchema);

export default QuestionModel;
