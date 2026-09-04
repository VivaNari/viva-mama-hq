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
    // Omitted means off-panel: the schema default decides, not the caller.
    is_empanelled_expert: Joi.boolean().optional(),
    // Country code, no "+" — matches what GetGabs expects on the wire.
    contactWhatsappNumber: Joi.string()
        .pattern(/^\d{10,15}$/)
        .optional()
        .allow(null),
});

export default createExpertValidator;
