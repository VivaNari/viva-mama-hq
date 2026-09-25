import Joi from "joi";
import { IContent, ContentBodyTypeEnum, EContentGroup } from "../../../../types/content.types";
import { EUserCategory } from "../../../../types";

const createContentValidator = Joi.object<IContent>({
    featuredImage: Joi.string().optional(),
    featuredTitle: Joi.string().required(),
    // `.single()` keeps a bare string like "PP" accepted and coerced to ["PP"], so any
    // caller still posting the pre-array shape keeps working.
    category: Joi.array()
        .items(Joi.string().valid(...Object.values(EUserCategory)))
        .single()
        .min(1)
        .unique()
        .required(),
    // Nullable: content can be created before it is classified. null is the
    // "unclassified" state that content-ops resolves later.
    contentGroup: Joi.string()
        .valid(...Object.values(EContentGroup))
        .allow(null)
        .default(null),
    sortOrder: Joi.number().optional().default(0),
    isFreeOverride: Joi.boolean().optional().default(false),
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
