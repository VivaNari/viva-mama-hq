import {
    DEFAULT_FLOW_LANGUAGE,
    FlowLanguage,
    FlowLanguageEnum,
    IFlowDefinition,
    IFlowTranslationBundle,
} from "../../types/chat.types";

const SUPPORTED_LANGUAGES: FlowLanguage[] = Object.values(FlowLanguageEnum);

/**
 * Resolve the effective language from an ordered list of candidates.
 * The first valid, supported value wins; otherwise the default (English).
 *
 * Typical priority: explicit request value -> user.preferred_language -> default.
 */
export function resolveLanguage(...candidates: Array<unknown>): FlowLanguage {
    for (const candidate of candidates) {
        if (typeof candidate !== "string") continue;
        const normalized = candidate.trim().toLowerCase() as FlowLanguage;
        if (SUPPORTED_LANGUAGES.includes(normalized)) {
            return normalized;
        }
    }
    return DEFAULT_FLOW_LANGUAGE;
}

/**
 * Convert a Mongoose document (or plain object) to a mutable plain object,
 * preserving `_id`/ObjectId types where possible.
 */
function toPlain(def: IFlowDefinition | any): IFlowDefinition {
    if (def && typeof def.toObject === "function") {
        return def.toObject();
    }
    return def;
}

/**
 * Return a plain copy of `flowDefinition` with all translatable display
 * strings replaced by their `lang` translations where available.
 *
 * Only display fields are localized — structural/logic fields (ids, option
 * values, scores, branch, calc, next, validWeek*) are untouched, so the same
 * object can drive navigation and scoring exactly as the base definition does.
 *
 * Any missing translation key falls back to the base (English) value, so a
 * partially-translated bundle never breaks a flow.
 */
export function localizeFlowDefinition(
    flowDefinition: IFlowDefinition,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): IFlowDefinition {
    const plain = toPlain(flowDefinition);

    if (!plain || lang === DEFAULT_FLOW_LANGUAGE) {
        if (plain) delete (plain as any).translations;
        return plain;
    }

    const bundle: IFlowTranslationBundle | undefined = plain.translations?.[lang];

    // Strip the (potentially large) translations blob from the served object.
    delete (plain as any).translations;

    if (!bundle) {
        return plain;
    }

    if (bundle.name) {
        plain.name = bundle.name;
    }

    if (Array.isArray(plain.notificationTemplates) && bundle.notificationTemplates) {
        plain.notificationTemplates = plain.notificationTemplates.map((tpl) => {
            const t = bundle.notificationTemplates?.[tpl.notificationType];
            if (!t) return tpl;
            return {
                ...tpl,
                title: t.title ?? tpl.title,
                body: t.body ?? tpl.body,
            };
        });
    }

    if (Array.isArray(plain.nodes) && bundle.nodes) {
        plain.nodes = plain.nodes.map((node) => {
            const tn = bundle.nodes?.[node.id];
            if (!tn) return node;

            const merged = { ...node };
            if (tn.text != null) merged.text = tn.text;
            if (tn.educationalMessage != null) merged.educationalMessage = tn.educationalMessage;
            if (tn.whyThisMatters != null) merged.whyThisMatters = tn.whyThisMatters;
            if (tn.indicator != null) merged.indicator = tn.indicator;

            if (tn.options && Array.isArray(node.options)) {
                merged.options = node.options.map((opt) => {
                    const label = tn.options?.[String(opt.value)];
                    return label != null ? { ...opt, label } : opt;
                });
            }

            return merged;
        });
    }

    if (Array.isArray(plain.outcomes) && bundle.outcomes) {
        plain.outcomes = plain.outcomes.map((outcome) => {
            const to = bundle.outcomes?.[outcome.key];
            if (!to) return outcome;
            return {
                ...outcome,
                title: to.title ?? outcome.title,
                summary: to.summary ?? outcome.summary,
                recommendations: to.recommendations ?? outcome.recommendations,
            };
        });
    }

    return plain;
}
