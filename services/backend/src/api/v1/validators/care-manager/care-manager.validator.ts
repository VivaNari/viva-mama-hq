import Joi from "joi";
import { ICareManager } from "../../../../types/care-manager.types";

const createCareManagerValidator = Joi.object<ICareManager>({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phoneNumber: Joi.string().required(),
    // Country code, no "+" — matches what GetGabs expects on the wire.
    contactWhatsappNumber: Joi.string()
        .pattern(/^\d{10,15}$/)
        .optional()
        .allow(null),
    // Optional on create: the schema default covers it, and the backfill migration owns
    // the real value.
    remuneration: Joi.number().min(0).optional(),
    imageUrl: Joi.string().uri().required(),
});

export default createCareManagerValidator;
