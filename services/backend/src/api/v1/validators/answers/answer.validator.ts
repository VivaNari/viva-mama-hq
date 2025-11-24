import Joi from "joi";
import { IAnswer } from "../../../../types";

const answerValidator = Joi.object<IAnswer>({
    answer: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).required(),
    question_object_id: Joi.string().required(),
    child_object_id: Joi.string().required(),
});

export default answerValidator;
