import { WEEKLY_CHECKIN_SLUG } from "./chat";

/**
 * Check-in answers that are clinically urgent enough to raise an alert on the
 * user's dashboard.
 *
 * Keyed by flow slug -> node id -> option `value`.
 *
 * Values, never scores. A `score` is a clinical scoring WEIGHT that options
 * routinely share, so it cannot identify a specific answer — see the docblock
 * on `resolveSelectedOptions` for the bug that caused. `value` is unique within
 * a node and is what `flow_responses.answer.selectedValues` stores.
 *
 * Editing this table is the whole configuration surface: add or remove a value
 * here and the dashboard alert follows on the next completed check-in. Nothing
 * is stored on the flow definition, so no migration is involved.
 */
export const EMERGENCY_ANSWERS: Record<string, Record<string, string[]>> = {
    [WEEKLY_CHECKIN_SLUG]: {
        // Postpartum haemorrhage risk.
        lochia_bleeding: ["heavy_bleeding"],
        // Wound infection / sepsis risk.
        perineal_c_section_wound: ["severe_pain_or_discharge"],
        // Puerperal infection.
        fever_infection_signs: ["fever_or_chills"],
        // Postpartum depression screen.
        mood_emotional_state: ["feeling_sad"],
    },
};

/** Emergency option values configured for a node, or an empty list. */
export const getEmergencyValuesForNode = (flowSlug: string, nodeId: string): string[] =>
    EMERGENCY_ANSWERS[flowSlug]?.[nodeId] ?? [];

/** Whether this specific answer on this node counts as an emergency. */
export const isEmergencyAnswer = (flowSlug: string, nodeId: string, optionValue: string): boolean =>
    getEmergencyValuesForNode(flowSlug, nodeId).includes(optionValue);
