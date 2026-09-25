import { FlowLanguage } from "../../types/chat.types";
import {
    IRecommendationHistory,
    IRecommendationHistoryRecText,
    IRecommendationHistoryTranslationBundle,
} from "../../types/recommendation-history.types";
import { IRecommendationLean, IRecommendationResponse } from "../../types/recommendation.types";

/**
 * Coerce a list-style field to a string array. Source recommendations store
 * `tips`/`next`/`celebrate` as a single string in English but as arrays in the
 * translations; the UI calls `.join()`, so we always emit an array. A non-empty
 * string becomes a one-element array (matching how the typed `[String]` base
 * field already coerces); empty/undefined become `[]`.
 */
export function toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value as string[];
    if (typeof value === "string") return value.length ? [value] : [];
    return [];
}

/** Pull just the display text out of a (already-localized) recommendation. */
function toRecText(rec: IRecommendationLean | null): IRecommendationHistoryRecText {
    if (!rec) return {};
    const out: IRecommendationHistoryRecText = {
        title: rec.title,
        goingWell: rec.goingWell,
    };
    if (rec.needsHelp !== undefined) out.needsHelp = rec.needsHelp;
    if (rec.celebrate !== undefined) out.celebrate = toStringArray(rec.celebrate);
    if (rec.tips !== undefined) out.tips = toStringArray(rec.tips);
    if (rec.next !== undefined) out.next = toStringArray(rec.next);
    return out;
}

/**
 * Build a single-language history bundle from a (localized) recommendation
 * response — the same mapping the write handler uses to fill the base snapshot.
 * Call once per language to assemble the `translations` map.
 */
export function buildHistoryTranslationBundle(
    rec: IRecommendationResponse,
): IRecommendationHistoryTranslationBundle {
    return {
        tagline: rec.overall.title,
        individualRecommendations: {
            physical: toRecText(rec.individual.physical),
            lactation: toRecText(rec.individual.lactation),
            emotional: toRecText(rec.individual.emotional),
        },
    };
}

/** Convert a Mongoose document (or plain object) to a mutable plain object. */
function toPlain<T>(doc: T | any): T {
    if (doc && typeof doc.toObject === "function") {
        return doc.toObject();
    }
    return doc;
}

/** Drop keys whose value is `undefined` so they don't overwrite base values. */
function definedOnly<T extends object>(obj?: T): Partial<T> {
    if (!obj) return {};
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Overlay localized text onto one category, keeping its score/zone. */
function mergeCategory(baseCat: any, text?: IRecommendationHistoryRecText) {
    if (!baseCat || !text) return baseCat;
    return {
        ...baseCat,
        recommendation: {
            ...baseCat.recommendation,
            ...definedOnly(text),
        },
    };
}

/** Force a category's list fields to arrays so the UI's `.join()` never fails. */
function normalizeCategory(cat: any) {
    if (!cat || !cat.recommendation) return cat;
    return {
        ...cat,
        recommendation: {
            ...cat.recommendation,
            tips: toStringArray(cat.recommendation.tips),
            next: toStringArray(cat.recommendation.next),
            celebrate: toStringArray(cat.recommendation.celebrate),
        },
    };
}

/**
 * Return a plain copy of a recommendation-history snapshot with its display
 * text (`tagline` and each category's `recommendation`) swapped to `lang` using
 * the stored `translations` bundle. Logic fields (scores, zones, week, etc.)
 * are untouched, and `translations` is stripped from the result.
 *
 * If no bundle exists for `lang` (e.g. an un-backfilled record), the base
 * document is returned as-is — never empty or broken.
 */
export function localizeRecommendationHistory(
    doc: IRecommendationHistory | any,
    lang: FlowLanguage,
): IRecommendationHistory {
    const plain = toPlain<IRecommendationHistory>(doc);
    if (!plain) return plain;

    const { translations, ...base } = plain as IRecommendationHistory & {
        translations?: IRecommendationHistory["translations"];
    };

    const result = { ...base } as IRecommendationHistory;

    const bundle = translations?.[lang];
    if (bundle) {
        if (bundle.tagline !== undefined) {
            result.tagline = bundle.tagline;
        }

        const ir = bundle.individualRecommendations;
        if (ir && base.individualRecommendations) {
            result.individualRecommendations = {
                physical: mergeCategory(base.individualRecommendations.physical, ir.physical),
                lactation: mergeCategory(base.individualRecommendations.lactation, ir.lactation),
                emotional: mergeCategory(base.individualRecommendations.emotional, ir.emotional),
            } as IRecommendationHistory["individualRecommendations"];
        }
    }

    // Always coerce list fields to arrays — the base snapshot may hold strings
    // (English source values, or a `Mixed` translation bundle), and the UI calls
    // `.join()`. This makes the response safe with or without a translation.
    if (result.individualRecommendations) {
        result.individualRecommendations = {
            physical: normalizeCategory(result.individualRecommendations.physical),
            lactation: normalizeCategory(result.individualRecommendations.lactation),
            emotional: normalizeCategory(result.individualRecommendations.emotional),
        } as IRecommendationHistory["individualRecommendations"];
    }

    return result;
}
