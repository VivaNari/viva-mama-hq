import mongoose from "mongoose";
import flowResponseModel from "../models/flowResponse.model";
import flowDefintionModel from "../models/flowDefinition.model";
import { getEmergencyValuesForNode } from "../constants/emergency-answers";
import { resolveSelectedOptions } from "./functions/resolveSelectedOptions";
import { IEmergencyFlag } from "../types/recommendation-history.types";

/**
 * Scan a completed flow instance for answers configured as clinically urgent.
 *
 * Only stable ids are returned — the node id and the option `value`. Display
 * text is resolved from the (localized) flow definition at read time, so the
 * dashboard can render the alert in whichever language the user is using.
 *
 * Never throws: an emergency alert is an addition to the score pipeline, and a
 * failure here must not cost the user her recovery score.
 */
export async function getEmergencyFlags(flowInstanceId: string): Promise<IEmergencyFlag[]> {
    try {
        const responses = await flowResponseModel
            .find({ flowInstanceId: new mongoose.Types.ObjectId(flowInstanceId) })
            .select("nodeId answer flowDefId")
            .sort({ createdAt: 1 })
            .lean();

        const flowDefId = responses[0]?.flowDefId;
        if (!flowDefId) {
            return [];
        }

        const flowDefinition = await flowDefintionModel
            .findById(flowDefId)
            .select("slug nodes")
            .lean();

        if (!flowDefinition) {
            console.warn(`getEmergencyFlags: flow definition ${flowDefId} not found`);
            return [];
        }

        const flags: IEmergencyFlag[] = [];

        for (const response of responses) {
            const emergencyValues = getEmergencyValuesForNode(
                flowDefinition.slug,
                response.nodeId,
            );
            if (emergencyValues.length === 0) {
                continue;
            }

            const node = flowDefinition.nodes.find((n) => n.id === response.nodeId);
            if (!node) {
                // Configured for a node this flow version no longer has.
                console.warn(
                    `getEmergencyFlags: node "${response.nodeId}" configured as an ` +
                        `emergency source but missing from ${flowDefinition.slug}`,
                );
                continue;
            }

            // Resolves on `selectedValues`, falling back to score matching for
            // answers stored by app builds released before that field existed.
            const selected = resolveSelectedOptions(node, response.answer ?? {});

            for (const option of selected) {
                const optionValue = String(option.value);
                if (emergencyValues.includes(optionValue)) {
                    flags.push({ nodeId: response.nodeId, optionValue });
                }
            }
        }

        return flags;
    } catch (error) {
        console.error("getEmergencyFlags failed:", error);
        return [];
    }
}
