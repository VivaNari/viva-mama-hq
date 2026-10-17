/**
 * Substitute {{token}} placeholders in flow-node copy from the instance's variables bag.
 *
 * Baby onboarding needs this: the questions address the child by name ("When was Aarav
 * born?"), but the name is itself collected by the first question, so it cannot live in
 * the stored flow definition. flow_instances.variables already exists as a per-run bag,
 * and the projector writes child_name into it.
 *
 * Deliberately conservative: an unknown or empty token is left exactly as written rather
 * than replaced with "undefined". A half-built sentence is bad, but "When was undefined
 * born?" is worse.
 */
const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const interpolateFlowText = (
    text: string | null | undefined,
    variables: Record<string, unknown> | null | undefined,
): string => {
    if (!text) return "";
    if (!variables || !text.includes("{{")) return text;

    return text.replace(TOKEN_PATTERN, (match, key: string) => {
        const value = variables[key];
        if (value === null || value === undefined || value === "") {
            return match;
        }
        return String(value);
    });
};
