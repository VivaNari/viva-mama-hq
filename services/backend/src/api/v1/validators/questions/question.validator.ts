import Joi from "joi";
import { EAnswerType, EQuestionFrequency, IQuestion } from "../../../../types";
const questionValidator = Joi.object<IQuestion>({
    question: Joi.string().required(),

    isForOnboarding: Joi.boolean().required(),

    answerType: Joi.string()
        .valid(EAnswerType.TEXT, EAnswerType.SINGLE_CHOICE, EAnswerType.MULTIPLE_CHOICE)
        .required(),

    options: Joi.array().items(Joi.string()),

    frequency: Joi.string().valid(
        EQuestionFrequency.DAILY,
        EQuestionFrequency.WEEKLY,
        EQuestionFrequency.MONTHLY,
        EQuestionFrequency.EVERY_N_HOURS,
    ),

    interval: Joi.number(),
});

export default questionValidator;
