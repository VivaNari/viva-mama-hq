/**
 * Migration step: restore-onboarding-v2.step.ts
 *
 * Takes the PRD section 1 questions back out of onboarding-flow-v2, for a database where
 * the earlier version of update-onboarding-prd-section1 added them in place. The Play Store
 * build runs v2 and cannot show those questions properly.
 *
 * Reports only, unless `apply` is true. Deliberately NOT in run-all: it changes what people
 * part-way through onboarding are asked next, so back up flow_definitions and run it by hand.
 *
 * The intro, name and parity wording stays as it is. Only the database ever held the old
 * English text, so it cannot be restored from here, and the new wording works on every app
 * build.
 */
import { ONBOARDING_SLUG } from "../../../constants/conversationSlugs";
import flowDefinitionModel from "../../../models/flowDefinition.model";
import flowInstanceModel from "../../../models/flowInstance.model";
import { FlowInstanceStateEnum } from "../../../types/chat.types";
import { PRD_SECTION1_NODE_IDS } from "./update-onboarding-prd-section1.step";

export interface IRestoreOnboardingV2Result {
    /** The new questions found in v2. Empty means v2 is clean and nothing is needed. */
    foundNodeIds: string[];
    /** People whose current question is one of them, and so need moving. */
    instancesToMove: number;
    /** False means this v2 predates that step, which should run before v3 is copied. */
    hasFeedingNode: boolean;
    applied: boolean;
}

export async function restore({ apply = false } = {}): Promise<IRestoreOnboardingV2Result> {
    const v2 = await flowDefinitionModel
        .findOne({ slug: ONBOARDING_SLUG, status: "PUBLISHED" })
        .sort({ version: -1, createdAt: -1 })
        .lean();

    if (!v2) {
        console.warn(`No PUBLISHED "${ONBOARDING_SLUG}" found.`);
        return { foundNodeIds: [], instancesToMove: 0, hasFeedingNode: false, applied: false };
    }

    const nodes = (v2 as any).nodes as { id: string; next: string | null }[];
    const removable = new Set(PRD_SECTION1_NODE_IDS);
    const foundNodeIds = nodes.filter((node) => removable.has(node.id)).map((node) => node.id);
    const hasFeedingNode = nodes.some((node) => node.id === "feeding");

    const stranded = {
        flowDefId: v2._id,
        state: FlowInstanceStateEnum.ACTIVE,
        cursorNodeId: { $in: foundNodeIds },
    };
    const instancesToMove = foundNodeIds.length
        ? await flowInstanceModel.countDocuments(stranded)
        : 0;

    if (!apply || foundNodeIds.length === 0) {
        return { foundNodeIds, instancesToMove, hasFeedingNode, applied: false };
    }

    /** The first question at or after this one that stays in the flow. */
    const survivorFrom = (nodeId: string | null): string | null => {
        let current = nodeId;
        while (current && removable.has(current)) {
            const here: string = current;
            current = nodes.find((node) => node.id === here)?.next ?? null;
        }
        return current;
    };

    // People are moved first: if this fails half way, v2 still has every question they
    // could be sitting on, and a re-run picks up where it stopped.
    for (const nodeId of foundNodeIds) {
        await flowInstanceModel.updateMany(
            { ...stranded, cursorNodeId: nodeId },
            { $set: { cursorNodeId: survivorFrom(nodeId) } },
        );
    }

    const kept = nodes
        .filter((node) => !removable.has(node.id))
        .map((node) => ({ ...node, next: survivorFrom(node.next) }));
    const unsetHindi = Object.fromEntries(
        foundNodeIds.map((id) => [`translations.hi.nodes.${id}`, ""]),
    );

    await flowDefinitionModel.updateOne(
        { _id: v2._id },
        { $set: { nodes: kept }, $unset: unsetHindi },
    );

    return { foundNodeIds, instancesToMove, hasFeedingNode, applied: true };
}
