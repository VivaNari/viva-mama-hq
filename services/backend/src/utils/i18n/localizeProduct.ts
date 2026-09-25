import { DEFAULT_FLOW_LANGUAGE, FlowLanguage } from "../../types/chat.types";
import { IProduct } from "../../types/products.types";

/**
 * Convert a Mongoose document (or plain object) to a mutable plain object.
 */
function toPlain(product: IProduct | any): IProduct {
    if (product && typeof product.toObject === "function") {
        return product.toObject();
    }
    return product;
}

/**
 * Return a plain copy of a product with translatable display fields replaced by
 * their `lang` translation where available. Structural fields (image, affiliate
 * link, userCategory, validWeek*, _id) are untouched. Missing translation fields
 * fall back to the base (English) value, and the `translations` blob is stripped.
 */
export function localizeProduct(
    product: IProduct,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): IProduct {
    const plain = toPlain(product);
    if (!plain) return plain;

    const bundle = plain.translations?.[lang];
    delete (plain as any).translations;

    if (lang === DEFAULT_FLOW_LANGUAGE || !bundle) {
        return plain;
    }

    if (bundle.productName != null) plain.productName = bundle.productName;
    if (bundle.productDescription != null) plain.productDescription = bundle.productDescription;
    if (bundle.productCategory != null) plain.productCategory = bundle.productCategory;
    if (bundle.productPriceRange != null) plain.productPriceRange = bundle.productPriceRange;
    if (bundle.safetyFlag != null) plain.safetyFlag = bundle.safetyFlag;

    return plain;
}

/**
 * Localize a list of products.
 */
export function localizeProducts(
    products: IProduct[],
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): IProduct[] {
    return products.map((p) => localizeProduct(p, lang));
}
