/**
 * Migration step: rebrand-perinatal-flow-copy.step.ts
 *
 * Both flow intros greet the user as "your postpartum care assistant". The product now
 * serves pregnant (NP) and not-yet-pregnant (NN) users as well, so the greeting reads as
 * a phase she has not reached. "Perinatal" spans pregnancy through the postpartum period.
 *
 * This text lives ONLY in MongoDB — there is no English seed for either flow in version
 * control — which is why a migration is the way to change it. See
 * add-onboarding-feeding-node.step.ts for the same pattern.
 *
 * Scope is deliberately narrow: the identity phrase and nothing else. Every other use of
 * "postpartum"/"प्रसवोत्तर" in these documents is clinical ("postpartum bleeding",
 * "postpartum infections affect 5-10% of women") and correct as it stands.
 */
import flowDefinitionModel from "../../../models/flowDefinition.model";

const SLUGS = ["onboarding-flow-v2", "weekly-checkin-v1"];

/**
 * Substring rewrites, applied to the intro node only.
 *
 * Phrases rather than whole sentences: the two flows word their greetings differently
 * ("Hello Mama! I am Viva, …" vs "नमस्ते! मैं हूँ Viva, …"), and matching on the
 * identity phrase alone means this keeps working if the surrounding copy is edited, and
 * quietly does nothing once applied.
 */
const REPLACEMENTS: Array<{ from: string; to: string }> = [
    { from: "postpartum care assistant", to: "perinatal care assistant" },
    // Hindi: translated rather than transliterated, matching how these bundles render
    // every other clinical/descriptive term.
    { from: "प्रसवोत्तर देखभाल सहायक", to: "प्रसवकालीन देखभाल सहायक" },
];

const rebrand = (text: unknown): string | null => {
    if (typeof text !== "string") return null;
    const next = REPLACEMENTS.reduce(
        (acc, { from, to }) => (acc.includes(from) ? acc.split(from).join(to) : acc),
        text,
    );
    return next === text ? null : next;
};

export async function migrate(): Promise<{ updated: number }> {
    console.log("Starting migration to rebrand flow intro copy to perinatal...");

    let updated = 0;

    for (const slug of SLUGS) {
        const flow = await flowDefinitionModel
            .findOne({ slug, status: "PUBLISHED" })
            .sort({ version: -1, createdAt: -1 });

        if (!flow) {
            console.warn(`No PUBLISHED "${slug}" found — skipping.`);
            continue;
        }

        const doc = flow.toObject() as any;
        const update: Record<string, unknown> = {};

        // Base (English) copy on the intro node.
        const nodes = doc.nodes as any[];
        const introIndex = nodes?.findIndex((node) => node.id === "intro") ?? -1;
        if (introIndex !== -1) {
            const rewritten = rebrand(nodes[introIndex].text);
            if (rewritten) {
                nodes[introIndex].text = rewritten;
                update.nodes = nodes;
            }
        }

        // Hindi copy. Also maintained by hand in add-hindi-translations.step.ts, which
        // rewrites `translations.hi` wholesale on every run-all and runs earlier in the
        // registry — this is the belt to that braces, so the wording is correct even on
        // a database that step has not touched yet.
        const hiIntro = doc.translations?.hi?.nodes?.intro?.text;
        const rewrittenHi = rebrand(hiIntro);
        if (rewrittenHi) {
            update["translations.hi.nodes.intro.text"] = rewrittenHi;
        }

        if (Object.keys(update).length === 0) {
            console.log(`"${slug}" intro already reads perinatal — nothing to do.`);
            continue;
        }

        await flowDefinitionModel.updateOne({ _id: flow._id }, { $set: update });
        updated += 1;
        console.log(`Rebranded intro copy for "${slug}".`);
    }

    return { updated };
}
