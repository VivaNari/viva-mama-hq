import { ReportReason } from "../types/vivaClub.types";

/**
 * Reasons offered when flagging Viva AI output, in the order shown.
 *
 * Mirrors AI_MESSAGE_REPORT_REASONS on the server, which validates against the same
 * list — a reason missing there is rejected, not silently stored.
 *
 * Harm first, accuracy second, OTHER last. SPAM and HARASSMENT are absent by design:
 * they describe what people do to each other, not what a model gets wrong, and offering
 * them would collect reports nobody can act on.
 */
export const AI_REPORT_REASONS: ReportReason[] = [
  "HARMFUL_ADVICE",
  "MISINFORMATION",
  "HATE",
  "SEXUAL",
  "SELF_HARM",
  "OTHER",
];
