/**
 * Migration step: add-onboarding-feeding-node.step.ts
 *
 * Inserts the "feeding" question ("How are you feeding your baby right now?") into the
 * published onboarding flow, directly after `delivery_outcome`.
 *
 * Why a migration and not an admin edit: there is no update endpoint for a flow
 * definition — only POST /flow-definition (create) and GET /flow-definition/:slug — so
 * patching the published document in code is the established route. See
 * add-hindi-translations.step.ts, which this follows.
 *
 * The document is edited IN PLACE rather than published as a new version. Flow instances
 * carry `flowDefId` and `version`; bumping either would strand every onboarding already
 * in progress on an archived document. Adding a node and rewiring one `next` pointer is
 * backwards-compatible — a user whose cursor is already past `delivery_outcome` never
 * revisits it, and one sitting on it simply gets the new question next.
 *
 * Who sees the question is NOT decided here. It is decided by the two id lists in
 * ChatFlowService.findNextValidNode, which together make it postpartum-only.
 */
import flowDefinitionModel from "../../../models/flowDefinition.model";

const ONBOARDING_SLUG = "onboarding-flow-v2";
const FEEDING_NODE_ID = "feeding";
const ANCHOR_NODE_ID = "delivery_outcome";

/**
 * The node, minus `next` — that is resolved from the anchor at runtime so this step
 * stays correct if the flow is ever reordered.
 *
 * `score: null` on every option, matching `parity`: onboarding option scores are not
 * read by the score engine, which scores check-ins only. A feeding method is also not a
 * better or worse answer, so scoring one would be meaningless as well as unused.
 */
const FEEDING_NODE = {
    id: FEEDING_NODE_ID,
    categoryId: null,
    indicator: "Feeding Method",
    nodeType: "QUESTION_SINGLE",
    text: "How are you feeding your baby right now?",
    educationalMessage: "",
    whyThisMatters:
        "Feeding method shapes lactation support and which weekly check-in questions you see.",
    validWeekStart: null,
    validWeekEnd: null,
    options: [
        { label: "Only breastmilk", value: "only_breastmilk", score: null },
        { label: "Mixed", value: "mixed", score: null },
        { label: "Not breastfeeding", value: "not_breastfeeding", score: null },
    ],
    branch: null,
    calc: null,
};

/** Hindi bundle for the new node, in the shape of translations.hi.nodes[nodeId]. */
const FEEDING_NODE_HI = {
    indicator: "स्तनपान का तरीका",
    text: "आप अभी अपने बच्चे को कैसे दूध पिला रही हैं?",
    whyThisMatters:
        "दूध पिलाने का तरीका यह तय करता है कि आपको किस तरह की स्तनपान सहायता और साप्ताहिक जाँच के सवाल मिलेंगे।",
    options: {
        only_breastmilk: "केवल माँ का दूध",
        mixed: "मिश्रित (माँ का दूध और फ़ॉर्मूला/ऊपरी दूध)",
        not_breastfeeding: "स्तनपान नहीं करा रही",
    },
};

export async function migrate(): Promise<{ inserted: boolean }> {
    console.log("Starting migration to add the feeding node to onboarding...");

    const onboarding = await flowDefinitionModel
        .findOne({ slug: ONBOARDING_SLUG, status: "PUBLISHED" })
        .sort({ version: -1, createdAt: -1 });

    if (!onboarding) {
        console.warn(`No PUBLISHED "${ONBOARDING_SLUG}" found — skipping feeding node.`);
        return { inserted: false };
    }

    const nodes = (onboarding.toObject() as any).nodes as any[];

    // The Hindi is re-asserted on every run, deliberately, and separately from the node
    // insertion below.
    //
    // add-hindi-translations replaces `translations.hi` WHOLESALE and runs before this
    // step on every run-all. If the Hindi were written only alongside the insertion, the
    // second run would wipe it — that step would drop the bundle, and this one would
    // see the node already present and return early without restoring it. The question
    // would silently revert to English for Hindi users.
    const update: Record<string, unknown> = {
        [`translations.hi.nodes.${FEEDING_NODE_ID}`]: FEEDING_NODE_HI,
    };

    // Idempotent: the runner has no ledger and re-runs every step on each run-all, so a
    // second run must not insert a duplicate or re-point `next` at a node already wired.
    const alreadyPresent = nodes.some((node) => node.id === FEEDING_NODE_ID);
    const anchorIndex = nodes.findIndex((node) => node.id === ANCHOR_NODE_ID);

    if (!alreadyPresent && anchorIndex === -1) {
        console.warn(
            `"${ANCHOR_NODE_ID}" not found in ${ONBOARDING_SLUG} — skipping feeding node.`,
        );
        return { inserted: false };
    }

    let inserted = false;

    if (!alreadyPresent) {
        // Take the anchor's current target as our own, then claim its pointer. Reading it
        // rather than hardcoding "meds_history" means the chain stays intact even if the
        // questions after delivery_outcome are reordered before this runs.
        const anchor = nodes[anchorIndex];
        const feedingNode = { ...FEEDING_NODE, next: anchor.next ?? null };
        anchor.next = FEEDING_NODE_ID;

        // Spliced in after the anchor, not appended: Edit Profile renders the questions
        // in stored array order, so appending would put "feeding" at the end of that form.
        nodes.splice(anchorIndex + 1, 0, feedingNode);
        update.nodes = nodes;
        inserted = true;

        console.log(
            `Inserted "${FEEDING_NODE_ID}" after "${ANCHOR_NODE_ID}" in ${ONBOARDING_SLUG} ` +
                `(${ANCHOR_NODE_ID} -> ${FEEDING_NODE_ID} -> ${feedingNode.next})`,
        );
    } else {
        console.log(`"${FEEDING_NODE_ID}" already present in ${ONBOARDING_SLUG} — Hindi re-applied.`);
    }

    await flowDefinitionModel.updateOne({ _id: onboarding._id }, { $set: update });

    return { inserted };
}
