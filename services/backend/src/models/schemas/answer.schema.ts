import mongoose, { Schema } from "mongoose";
import { IAnswer } from "../../types";
const AutoIncrement = require("mongoose-sequence")(mongoose);

const answerSchema = new Schema<IAnswer>({
    question_object_id: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "questions",
    },
    question_id: {
        type: Number,
        required: true,
    },
    answer: {
        type: Schema.Types.Mixed, // array or string
        required: true,
    },
    child_object_id: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    year: {
        type: Number,
        required: true,
    },
    day: {
        type: Number,
        required: true,
    },
    user_id: {
        type: Number,
        required: true,
    },
    user_object_id: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "users",
    },
});

answerSchema.plugin(AutoIncrement, { inc_field: "answer_id" });

export default answerSchema;
