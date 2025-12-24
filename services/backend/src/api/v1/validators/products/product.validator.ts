import Joi from "joi";
import { EUserCategory } from "../../../../types";
import { IProduct } from "../../../../types/products.types";

const createProductvalidator = Joi.object<IProduct>({
    productImageURL: Joi.string().uri().required(),
    productName: Joi.string().required(),
    productAffiliateLink: Joi.string().uri().required(),
    userCategory: Joi.string()
        .valid(...Object.values(EUserCategory))
        .required(),
    validWeeks: Joi.array().items(Joi.number().required().min(1).max(52)).required(),
});

export default createProductvalidator;
