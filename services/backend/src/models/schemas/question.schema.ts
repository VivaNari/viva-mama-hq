import mongoose, { Schema } from "mongoose";
const AutoIncrement = require("mongoose-sequence")(mongoose);
import { EAnswerType, EQuestionFrequency, IQuestion } from "../../types";

const questionSchema = new Schema<IQuestion>({
    question: { type: String, required: true },
    isForOnboarding: { type: Boolean, required: true },
    answerType: {
        type: String,
        required: true,
        enum: [EAnswerType.TEXT, EAnswerType.SINGLE_CHOICE, EAnswerType.MULTIPLE_CHOICE],
    },
    options: { type: [String], default: [] },
    frequency: {
        type: String,
        enum: [
            EQuestionFrequency.DAILY,
            EQuestionFrequency.WEEKLY,
            EQuestionFrequency.MONTHLY,
            EQuestionFrequency.EVERY_N_HOURS,
        ],
        default: null,
    },
    interval: { type: Number, default: null },
});

questionSchema.plugin(AutoIncrement, { inc_field: "question_id" });

export default questionSchema;
