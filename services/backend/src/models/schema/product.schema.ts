import { Schema } from "mongoose";
import { EUserCategory } from "../../types";

export const productSchema = new Schema({
    productImageURL: { type: String, required: true },
    productName: { type: String, required: true },
    productAffiliateLink: { type: String, required: true },
    userCategory: {
        type: String,
        required: true,
        enum: Object.values(EUserCategory),
    },
    validWeeks: { type: [Number], required: true },
});
