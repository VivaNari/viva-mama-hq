import { DEFAULT_FLOW_LANGUAGE, FlowLanguage } from "../../types/chat.types";
import { IExpert } from "../../types/expert.types";
import { localizeExpertCategory } from "./localizeExpertCategory";

/**
 * Convert a Mongoose document (or plain object) to a mutable plain object.
 */
function toPlain(expert: IExpert | any): IExpert {
    if (expert && typeof expert.toObject === "function") {
        return expert.toObject();
    }
    return expert;
}

/**
 * Return a plain copy of an expert with translatable display fields replaced by
 * their `lang` translation where available. Structural fields (photograph,
 * remuneration, yearsOfExperience, isActive, _id) are untouched. Missing
 * translation fields fall back to the base (English) value, and the
 * `translations` blob is stripped.
 *
 * `referralCode` is stripped here too. It is not a display field and no client has any
 * use for it — but a referral code can now carry a free subscription, so serving every
 * expert's code to every logged-in user would be handing out an oracle for them.
 */
export function localizeExpert(
    expert: IExpert,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): IExpert {
    const plain = toPlain(expert);
    if (!plain) return plain;

    const bundle = plain.translations?.[lang];
    delete (plain as any).translations;
    delete (plain as any).referralCode;

    if (lang === DEFAULT_FLOW_LANGUAGE || !bundle) {
        // Even on the default language the populated category object still carries
        // its own translations blob — strip it before serving.
        if (
            plain.category &&
            typeof plain.category === "object" &&
            !Array.isArray(plain.category)
        ) {
            plain.category = localizeExpertCategory(plain.category, lang);
        }
        return plain;
    }

    if (bundle.name != null) plain.name = bundle.name;
    if (bundle.speciality != null) plain.speciality = bundle.speciality;
    if (bundle.qualification != null) plain.qualification = bundle.qualification;
    if (bundle.bio != null) plain.bio = bundle.bio;

    // Localize the populated category object for non-default languages.
    if (plain.category && typeof plain.category === "object" && !Array.isArray(plain.category)) {
        plain.category = localizeExpertCategory(plain.category, lang);
    }

    return plain;
}

/**
 * Localize a list of experts.
 */
export function localizeExperts(
    experts: IExpert[],
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): IExpert[] {
    return experts.map((e) => localizeExpert(e, lang));
}
