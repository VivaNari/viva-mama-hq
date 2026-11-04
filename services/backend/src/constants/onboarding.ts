/**
 * Node ids and answer rules for the mother's onboarding questions added for PRD section 1.
 *
 * Numeric answers arrive as QUESTION_FREE_TEXT strings, because the flow engine has no
 * numeric node type. The bounds are mirrored in apps/mobile/src/constants/chat.ts, which
 * checks them before sending. Keep the two in step.
 */
export const ABHA_NODE_ID = "abha";
export const ABHA_METHOD_NODE_ID = "abha_method";
export const ABHA_NUMBER_NODE_ID = "abha_number";
export const ABHA_CARD_NODE_ID = "abha_card";
export const WEIGHT_NODE_ID = "weight";
export const HEIGHT_NODE_ID = "height";
export const CARE_MODEL_NODE_ID = "care_model";
export const CARE_FACILITY_NODE_ID = "care_facility";
export const HEALTH_HISTORY_NODE_ID = "health_history";
export const PREGNANCIES_NODE_ID = "pregnancies";
export const LIVING_CHILDREN_NODE_ID = "living_children";

/** Sent by the app's Skip chip on an optional free-text question. */
export const SKIP_ANSWER = "__skip__";

/** How the app answers `abha_card` once the photo is saved as a health record. */
export const ABHA_RECORD_PREFIX = "record:";

export const WEIGHT_KG_BOUNDS = { min: 30, max: 200 };
export const HEIGHT_CM_BOUNDS = { min: 100, max: 220 };
export const PREGNANCIES_BOUNDS = { min: 2, max: 20 };
export const LIVING_CHILDREN_BOUNDS = { min: 0, max: 20 };
export const CARE_FACILITY_MAX_LENGTH = 120;

/** An ABHA number is 14 digits. People often type it with hyphens or spaces. */
export const normalizeAbhaNumber = (raw: unknown): string | null => {
    if (typeof raw !== "string") return null;
    const digits = raw.replace(/[\s-]/g, "");
    return /^\d{14}$/.test(digits) ? digits : null;
};

/** Parse a typed number, or null when it is not a number inside the bounds. */
export const parseBoundedNumber = (
    raw: unknown,
    bounds: { min: number; max: number },
): number | null => {
    const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? "").trim());
    if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) return null;
    return value;
};

/**
 * What may be written to flow responses and chat messages for this answer.
 *
 * Those collections keep free text as typed, and the profile keeps the ABHA number
 * encrypted, so the number must never reach them in the clear.
 */
export const freeTextForStorage = (
    nodeId: string,
    freeText: string | undefined,
): string | undefined => {
    if (!freeText) return freeText;
    if (nodeId === ABHA_CARD_NODE_ID) {
        // She can type the number here instead of uploading, if the upload does not work.
        const digits = normalizeAbhaNumber(freeText);
        return digits ? `**********${digits.slice(-4)}` : freeText;
    }
    if (nodeId !== ABHA_NUMBER_NODE_ID) return freeText;
    const digits = normalizeAbhaNumber(freeText);
    return digits ? `**********${digits.slice(-4)}` : "**********";
};
