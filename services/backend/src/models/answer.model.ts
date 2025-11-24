import mongoose from "mongoose";
import answerSchema from "./schemas/answer.schema";
import { IAnswer } from "../types";

const AnswerModel = mongoose.model<IAnswer>("answers", answerSchema);

export default AnswerModel;
