import { DEFAULT_FLOW_LANGUAGE, FlowLanguage } from "../../types/chat.types";
import { IRecommendationLean } from "../../types/recommendation.types";

/**
 * Return a copy of a recommendation with translatable display fields replaced
 * by their `lang` translation where available. Structural/routing fields
 * (phase, zone, category, _id) are untouched. Missing translation fields fall
 * back to the base (English) value, and the `translations` blob is stripped
 * from the returned object.
 */
export function localizeRecommendation<T extends IRecommendationLean>(
    rec: T,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): T {
    if (!rec) return rec;

    const { translations, ...base } = rec as T & {
        translations?: IRecommendationLean["translations"];
    };

    if (lang === DEFAULT_FLOW_LANGUAGE) {
        return base as T;
    }

    const bundle = translations?.[lang];
    if (!bundle) {
        return base as T;
    }

    return {
        ...base,
        title: bundle.title ?? base.title,
        goingWell: bundle.goingWell ?? base.goingWell,
        needsHelp: bundle.needsHelp ?? base.needsHelp,
        celebrate: bundle.celebrate ?? base.celebrate,
        tips: bundle.tips ?? base.tips,
        next: bundle.next ?? base.next,
    } as T;
}
