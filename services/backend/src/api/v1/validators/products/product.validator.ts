import Joi from "joi";
import { EUserCategory } from "../../../../types";
import { IProduct } from "../../../../types/products.types";

const createProductvalidator = Joi.object<IProduct>({
    productImageURL: Joi.string().uri().required(),
    productName: Joi.string().required(),
    productAffiliateLink: Joi.string().uri().required(),
    // `.single()` keeps the pre-array shape ("PP") accepted and coerced to ["PP"].
    userCategory: Joi.array()
        .items(Joi.string().valid(...Object.values(EUserCategory)))
        .single()
        .min(1)
        .unique()
        .required(),
    sortOrder: Joi.number().optional().default(0),
    validWeekStart: Joi.number().min(1).max(52).required(),
    validWeekEnd: Joi.number().min(1).max(52).required(),
    productCategory: Joi.string().required(),
    productDescription: Joi.string().required(),
    productPriceRange: Joi.string().required(),
    safetyFlag: Joi.string().required(),
});

export default createProductvalidator;
