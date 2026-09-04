import { Schema } from "mongoose";
import { EUserCategory } from "../../types";
import { IProduct } from "../../types/products.types";

export const productSchema = new Schema<IProduct>({
    productImageURL: { type: String, required: true },
    productName: { type: String, required: true },
    productAffiliateLink: { type: String, required: true },
    userCategory: {
        // Enum on the element type, and `required` rejects [] — see content.schema.ts.
        type: [{ type: String, enum: Object.values(EUserCategory) }],
        required: true,
        validate: {
            validator: (value: EUserCategory[]) => Array.isArray(value) && value.length > 0,
            message: "userCategory must contain at least one user category",
        },
    },
    sortOrder: { type: Number, default: 0 },
    validWeekStart: { type: Number, required: true },
    validWeekEnd: { type: Number, required: true },
    productCategory: { type: String, required: true },
    productDescription: { type: String, required: true },
    productPriceRange: { type: String, required: true },
    safetyFlag: { type: String, required: true },
    // i18n bundles keyed by language code (e.g. "hi"). Holds only translatable
    // display strings; fields/keys missing here fall back to the base (English)
    // values. See utils/i18n/localizeProduct.
    translations: { type: Schema.Types.Mixed, default: {} },
});

// Mirrors ProductController.getProducts, plus the tiebreaker the free slice depends on.
productSchema.index({ userCategory: 1, validWeekStart: 1, validWeekEnd: 1 });
productSchema.index({ sortOrder: 1, _id: 1 });
