import { DEFAULT_FLOW_LANGUAGE, FlowLanguage } from "../../types/chat.types";
import { IContent } from "../../types/content.types";

/**
 * Convert a Mongoose document (or plain object) to a mutable plain object.
 */
function toPlain(content: IContent | any): IContent {
    if (content && typeof content.toObject === "function") {
        return content.toObject();
    }
    return content;
}

/**
 * Return a plain copy of a content article with translatable fields replaced by
 * their `lang` translation where available. Structural fields (featuredImage,
 * category, validWeek*, authors, reviewers, _id) are untouched. Missing
 * translation fields fall back to the base (English) value, and the
 * `translations` blob is stripped.
 */
export function localizeContent(
    content: IContent,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): IContent {
    const plain = toPlain(content);
    if (!plain) return plain;

    const bundle = plain.translations?.[lang];
    delete (plain as any).translations;

    if (lang === DEFAULT_FLOW_LANGUAGE || !bundle) {
        return plain;
    }

    if (bundle.featuredTitle != null) {
        plain.featuredTitle = bundle.featuredTitle;
    }
    if (Array.isArray(bundle.contentBody) && bundle.contentBody.length > 0) {
        plain.contentBody = bundle.contentBody;
    }

    return plain;
}

/**
 * Localize a list of content articles.
 */
export function localizeContents(
    contents: IContent[],
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): IContent[] {
    return contents.map((c) => localizeContent(c, lang));
}
