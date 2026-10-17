import { DEFAULT_FLOW_LANGUAGE, FlowLanguage } from "../../types/chat.types";
import { ISubscriptionPlan } from "../../types/subscription.types";

/**
 * Convert a Mongoose document (or plain object) to a mutable plain object.
 */
function toPlain(plan: ISubscriptionPlan | any): ISubscriptionPlan {
    if (plan && typeof plan.toObject === "function") {
        return plan.toObject();
    }
    return plan;
}

/**
 * Return a plain copy of a plan with translatable display fields replaced by their
 * `lang` translation where available. Structural fields (code, amountPaise,
 * durationDays, credits) are untouched, and the `translations` blob is stripped.
 *
 * Prices are never translated — only formatted client-side — so `amountPaise` is
 * deliberately not part of the bundle.
 */
export function localizeSubscriptionPlan(
    plan: ISubscriptionPlan,
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): ISubscriptionPlan {
    const plain = toPlain(plan);
    if (!plain) return plain;

    const bundle = plain.translations?.[lang];
    delete (plain as any).translations;

    if (lang === DEFAULT_FLOW_LANGUAGE || !bundle) {
        return plain;
    }

    if (bundle.displayName != null) plain.displayName = bundle.displayName;
    if (bundle.description != null) plain.description = bundle.description;

    return plain;
}

export function localizeSubscriptionPlans(
    plans: ISubscriptionPlan[],
    lang: FlowLanguage = DEFAULT_FLOW_LANGUAGE,
): ISubscriptionPlan[] {
    return plans.map((p) => localizeSubscriptionPlan(p, lang));
}
