import { Schema } from "mongoose";

export interface IAnswer {
    answer_id: number;
    question_object_id: Schema.Types.ObjectId;
    question_id: number;
    answer: string | string[]; // array or string
    child_object_id: Schema.Types.ObjectId;
    year: number;
    day: number;
    user_id: number;
    user_object_id: Schema.Types.ObjectId;
}
