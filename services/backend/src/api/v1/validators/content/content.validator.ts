import Joi from "joi";
import { IContent, ContentBodyTypeEnum } from "../../../../types/content.types";
import { EUserCategory } from "../../../../types";

const createContentValidator = Joi.object<IContent>({
    featuredImage: Joi.string().optional(),
    featuredTitle: Joi.string().required(),
    category: Joi.string()
        .valid(...Object.values(EUserCategory))
        .required(),
    validWeekStart: Joi.number().required().min(1).max(52),
    validWeekEnd: Joi.number().required().min(1).max(52),
    authors: Joi.array().items(Joi.string().optional()).optional(),
    reviewers: Joi.array().items(Joi.string().optional()).optional(),
    contentBody: Joi.array()
        .items(
            Joi.object({
                contentType: Joi.string()
                    .valid(...Object.values(ContentBodyTypeEnum))
                    .required(),
                body: Joi.string().required(),
            }),
        )
        .default([]),
});

export default createContentValidator;
