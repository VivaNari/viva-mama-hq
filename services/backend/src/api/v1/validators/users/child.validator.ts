import Joi from "joi";
import { ESex } from "../../../../types";

const childValidator = Joi.object({
    name: Joi.string().required(),
    date_of_birth: Joi.date().less("now").required(),
    sex: Joi.string().valid(ESex.MALE, ESex.FEMALE, ESex.OTHER).required(),
});

export default childValidator;
