import Joi from "joi";
import { EUserCategory } from "../../../../types";

const revision = Joi.number().integer().min(0).required();
const sourceHash = Joi.string().hex().length(64).required();
const keywords = Joi.array().items(Joi.string().trim().min(1).max(80)).max(20).required();

export const generateContentProfileValidator = Joi.object({ revision }).unknown(false);

export const approveContentProfileValidator = Joi.object({ revision, sourceHash }).unknown(false);

export const saveContentProfileValidator = Joi.object({
    revision,
    sourceHash,
    summary: Joi.string().trim().min(20).max(2000).required(),
    oneLiner: Joi.string().trim().min(3).max(200).required(),
    keywordsEn: keywords,
    keywordsHi: keywords,
    exampleQuestions: Joi.array()
        .items(
            Joi.object({
                text: Joi.string().trim().min(3).max(300).required(),
                language: Joi.string().valid("en", "hi", "hinglish").required(),
                timestamp: Joi.string()
                    .pattern(/^\d{1,3}:[0-5]\d$/)
                    .allow(null)
                    .optional(),
            }).unknown(false),
        )
        .max(12)
        .required(),
    suitableFor: Joi.array()
        .items(Joi.string().valid(...Object.values(EUserCategory)))
        .unique()
        .required(),
}).unknown(false);
