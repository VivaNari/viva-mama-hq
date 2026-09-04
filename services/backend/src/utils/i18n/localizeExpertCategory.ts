import { DEFAULT_FLOW_LANGUAGE, FlowLanguage } from "../../types/chat.types";
import { IExpertCategory } from "../../types/expert-category.types";

/**
 * Convert a Mongoose document (or plain object) to a mutable plain object.
 */
function toPlain(category: IExpertCategory | any): any {
    if (category && typeof category.toObject === "function") {
        return category.toObject();
    }
    return category;
}

/**
 * Return a plain copy of an expert category with translatable display fields
 * replaced by their `lang` translation where available.
 *
 * Structural fields (_id, key, isActive) are untouched. Missing translation
 * fields fall back to the base (English) value, and the `translations` blob
 * is stripped before the object is sent to the client.
 */
export function localizeExpertCategory(
    category: IExpertCategory | any,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): any {
    const plain = toPlain(category);
    if (!plain) return plain;

    const bundle = plain.translations?.[lang];
    delete plain.translations;

    if (lang === DEFAULT_FLOW_LANGUAGE || !bundle) {
        return plain;
    }

    if (bundle.name != null) plain.name = bundle.name;
    if (bundle.description != null) plain.description = bundle.description;
    if (Array.isArray(bundle.coveredAreas) && bundle.coveredAreas.length > 0) {
        plain.coveredAreas = bundle.coveredAreas;
    }

    return plain;
}
