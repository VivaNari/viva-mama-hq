import Joi from "joi";
import { IExpert } from "../../../../types/expert.types";

const createExpertValidator = Joi.object<IExpert>({
    name: Joi.string().required(),
    speciality: Joi.string().required(),
    qualification: Joi.string().optional(),
    yearsOfExperience: Joi.number().required(),
    bio: Joi.string().optional(),
    photograph: Joi.string().uri().required(),
    remuneration: Joi.number().required(),
});

export default createExpertValidator;
