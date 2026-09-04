import { IFlowNode } from "../../types/chat.types";

type FlowOption = IFlowNode["options"][number];

export interface SelectionInput {
    /**
     * Option `value` tokens chosen by the user — the authoritative identity of a
     * selection. Unique within a node.
     */
    selectedValues?: string[] | null | undefined;
    /**
     * Legacy identity channel: option scores. Ambiguous whenever a node has two
     * options sharing a score, so only used as a fallback for older app builds.
     */
    selectedKeys?: number[] | null | undefined;
}

/**
 * Resolve which options a user actually selected on a node.
 *
 * `score` is a clinical scoring WEIGHT, not an identifier — options routinely
 * share one (e.g. every pregnancy condition scores 0). Matching on it therefore
 * returns every option with that score, which silently corrupted answers.
 * `value` is unique within a node, so it is the identity we resolve on.
 *
 * Callers derive everything they need from the returned options: `.value` for
 * onboarding_data, `.score` for the persisted answer/scoring, `.label` for the
 * transcript. That keeps scores flowing downstream exactly as before.
 *
 * Falls back to the legacy score match when no values are supplied, so app
 * builds released before this change keep working unchanged.
 */
export const resolveSelectedOptions = (
    node: Pick<IFlowNode, "options">,
    { selectedValues, selectedKeys }: SelectionInput,
): FlowOption[] => {
    const options = node?.options ?? [];
    if (options.length === 0) {
        return [];
    }

    if (selectedValues && selectedValues.length > 0) {
        return options.filter((opt) => selectedValues.includes(String(opt.value)));
    }

    if (selectedKeys && selectedKeys.length > 0) {
        return options.filter((opt) => selectedKeys.includes(opt.score!));
    }

    return [];
};

/** Convenience: the stored answer tokens for the selected options. */
export const resolveSelectedValues = (
    node: Pick<IFlowNode, "options">,
    input: SelectionInput,
): string[] => resolveSelectedOptions(node, input).map((opt) => String(opt.value));

/** Convenience: the scores of the selected options, for persistence & scoring. */
export const resolveSelectedScores = (
    node: Pick<IFlowNode, "options">,
    input: SelectionInput,
): number[] => resolveSelectedOptions(node, input).map((opt) => opt.score as number);

/** Convenience: the localized labels of the selected options, for the transcript. */
export const resolveSelectedLabels = (
    node: Pick<IFlowNode, "options">,
    input: SelectionInput,
): string[] => resolveSelectedOptions(node, input).map((opt) => opt.label);
