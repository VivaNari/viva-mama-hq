import flowDefintionModel from "../models/flowDefinition.model";
import { FlowLanguage } from "../types/chat.types";
import { IEmergencyAlert, IRecommendationHistory } from "../types/recommendation-history.types";
import { localizeFlowDefinition } from "./i18n/localizeFlowDefinition";

/**
 * Turn a history row's `emergencyFlags` into the alert the dashboard renders,
 * or `null` when there is nothing to show.
 *
 * The row stores only ids, so the wording comes from the flow definition here —
 * localized to `lang` through the existing `localizeFlowDefinition`, which means
 * the alert follows the user's language and any later copy edit for free.
 *
 * Returns `null` (never throws) for: no flags, an already-dismissed alert, a
 * missing flow definition, or a lookup failure. An alert we cannot word is
 * strictly better dropped than shown broken.
 */
export async function buildEmergencyAlert(
    history: IRecommendationHistory & { _id?: unknown },
    lang: FlowLanguage,
): Promise<IEmergencyAlert | null> {
    const flags = history?.emergencyFlags ?? [];

    if (flags.length === 0 || history?.alertDismissedAt || !history?.flowDefId) {
        return null;
    }

    try {
        const definition = await flowDefintionModel.findById(history.flowDefId).lean();
        if (!definition) {
            console.warn(`buildEmergencyAlert: flow definition ${history.flowDefId} not found`);
            return null;
        }

        const localized = localizeFlowDefinition(definition as any, lang);

        const concerns = flags
            .map((flag) => {
                const node = localized.nodes?.find((n) => n.id === flag.nodeId);
                const option = node?.options?.find((o) => String(o.value) === flag.optionValue);

                if (!node || !option) {
                    return null;
                }

                return {
                    nodeId: flag.nodeId,
                    indicator: node.indicator,
                    answerLabel: option.label,
                };
            })
            .filter((c): c is NonNullable<typeof c> => c !== null);

        if (concerns.length === 0) {
            return null;
        }

        return {
            recommendationHistoryId: String(history._id),
            week: history.week,
            concerns,
        };
    } catch (error) {
        console.error("buildEmergencyAlert failed:", error);
        return null;
    }
}
