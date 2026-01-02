import { Schema } from "mongoose";
import { EUserCategory } from "../../types";
import { IProduct } from "../../types/products.types";

export const productSchema = new Schema<IProduct>({
    productImageURL: { type: String, required: true },
    productName: { type: String, required: true },
    productAffiliateLink: { type: String, required: true },
    userCategory: {
        type: String,
        required: true,
        enum: Object.values(EUserCategory),
    },
    validWeekStart: { type: Number, required: true },
    validWeekEnd: { type: Number, required: true },
    productCategory: { type: String, required: true },
    productDescription: { type: String, required: true },
    productPriceRange: { type: String, required: true },
    safetyFlag: { type: String, required: true },
});
