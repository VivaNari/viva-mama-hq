/**
 * Migration step: update-onboarding-prd-section1.step.ts
 *
 * Brings the published onboarding flow up to PRD section 1: new intro, name and parity
 * wording, and the ABHA, weight, height, care model, care facility, health history and
 * pregnancy count questions.
 *
 * RELEASE ORDER: run this only after the app build that understands these nodes has been
 * adopted. An older build shows them as plain text boxes with no units, upload or Skip.
 *
 * Follows add-onboarding-feeding-node.step.ts:
 *  - The document is edited in place. A version bump would strand onboardings in progress.
 *  - Idempotent, because the runner has no ledger and re-runs every step on each run-all.
 *  - Hindi is re-applied on every run, and this step must run after add-hindi-translations,
 *    which replaces `translations.hi` wholesale.
 *
 * Who sees each question is decided in code, not here: NN_WOMEN_INDICATORS and
 * isOnboardingNodeUnlocked in constants/chat.ts, plus the id list in ChatFlowService. Those
 * match on `indicator` and `id`, so neither may change without changing them too.
 *
 * Care model and facility sit before `delivery_outcome` on purpose. A stillbirth answer
 * ends the flow there, and she would otherwise never be asked for her care route.
 */
import flowDefinitionModel from "../../../models/flowDefinition.model";

const ONBOARDING_SLUG = "onboarding-flow-v2";

const INTRO_TEXT = `Hi, I'm Viva, your pregnancy and postpartum care guide.
I'll walk the whole journey with you, from pregnancy to your baby turning two.

How I can help you:

• give you the right information, always medically checked
• show you where you are and what's coming next
• keep your logs and send you reminders
• read, explain and organise your reports, all in one place

So you always know what to do and why, nothing slips through, and your journey feels calmer and more in your control.

My promise to you: private, confidential, personalised to you, and always without judgment.

First, let me get to know you.
Shall we begin?`;

const INTRO_TEXT_HI = `नमस्ते, मैं Viva हूँ, गर्भावस्था और प्रसव के बाद की देखभाल में आपकी मार्गदर्शक।
गर्भावस्था से लेकर आपके शिशु के दो साल का होने तक, मैं पूरी यात्रा में आपके साथ रहूँगी।

मैं आपकी मदद ऐसे कर सकती हूँ:

• आपको सही जानकारी देना, जो हमेशा चिकित्सकीय रूप से जाँची हुई हो
• यह दिखाना कि आप अभी कहाँ हैं और आगे क्या आने वाला है
• आपके लॉग रखना और आपको रिमाइंडर भेजना
• आपकी रिपोर्ट पढ़ना, समझाना और एक ही जगह व्यवस्थित रखना

ताकि आपको हमेशा पता रहे कि क्या करना है और क्यों, कुछ भी छूटे नहीं, और आपकी यात्रा शांत और आपके नियंत्रण में महसूस हो।

आपसे मेरा वादा: निजी, गोपनीय, आपके अनुसार, और बिना किसी आलोचना के।

पहले, मैं आपको जान लूँ।
क्या हम शुरू करें?`;

/** Rewording of nodes that already exist. Stored answer values stay the same. */
const EXISTING_NODE_COPY: Record<string, { text: string; options?: Record<string, string> }> = {
    intro: { text: INTRO_TEXT, options: { yes: "Yes, let's begin" } },
    name: { text: "What is your Name?" },
    parity: {
        text: "Is this your first pregnancy?",
        options: { first_time: "Yes, my first", multiparous: "No, I've been pregnant before" },
    },
};

const EXISTING_NODE_COPY_HI: Record<
    string,
    { text: string; options?: Record<string, string> }
> = {
    intro: { text: INTRO_TEXT_HI, options: { yes: "हाँ, चलिए शुरू करते हैं" } },
    name: { text: "आपका नाम क्या है?" },
    parity: {
        text: "क्या यह आपकी पहली गर्भावस्था है?",
        options: { first_time: "हाँ, मेरी पहली", multiparous: "नहीं, मैं पहले भी गर्भवती रही हूँ" },
    },
};

type TNewNode = {
    id: string;
    indicator: string;
    nodeType: "QUESTION_SINGLE" | "QUESTION_MULTI" | "QUESTION_FREE_TEXT";
    text: string;
    educationalMessage?: string;
    options?: { label: string; value: string }[];
    hi: {
        indicator: string;
        text: string;
        educationalMessage?: string;
        options?: Record<string, string>;
    };
};

/** A block of new questions and the existing node they follow. Order inside is the chain. */
const NEW_NODE_GROUPS: { after: string; nodes: TNewNode[] }[] = [
    {
        after: "name",
        nodes: [
            {
                id: "abha",
                indicator: "ABHA",
                nodeType: "QUESTION_SINGLE",
                text: "Do you have an ABHA ID number?",
                options: [
                    { label: "Yes", value: "yes" },
                    { label: "No", value: "no" },
                    { label: "Skip", value: "skip" },
                ],
                hi: {
                    indicator: "आभा",
                    text: "क्या आपके पास ABHA ID नंबर है?",
                    options: { yes: "हाँ", no: "नहीं", skip: "छोड़ें" },
                },
            },
            {
                id: "abha_method",
                indicator: "ABHA Method",
                nodeType: "QUESTION_SINGLE",
                text: "How would you like to add it?",
                options: [
                    { label: "Type the number", value: "type" },
                    { label: "Upload a picture of the card", value: "upload" },
                ],
                hi: {
                    indicator: "आभा का तरीका",
                    text: "आप इसे कैसे जोड़ना चाहेंगी?",
                    options: { type: "नंबर टाइप करें", upload: "कार्ड की फ़ोटो अपलोड करें" },
                },
            },
            {
                id: "abha_number",
                indicator: "ABHA Number",
                nodeType: "QUESTION_FREE_TEXT",
                text: "Please enter your 14-digit ABHA number.",
                hi: {
                    indicator: "आभा नंबर",
                    text: "कृपया अपना 14 अंकों का ABHA नंबर दर्ज करें।",
                },
            },
            {
                id: "abha_card",
                indicator: "ABHA Card",
                nodeType: "QUESTION_FREE_TEXT",
                text: "Please take a photo of your ABHA card, or choose one from your gallery.",
                hi: {
                    indicator: "आभा कार्ड",
                    text: "कृपया अपने ABHA कार्ड की फ़ोटो लें, या गैलरी से चुनें।",
                },
            },
        ],
    },
    {
        after: "delivery_date",
        nodes: [
            {
                id: "weight",
                indicator: "Weight",
                nodeType: "QUESTION_FREE_TEXT",
                text: "What is your weight (last recorded)?",
                hi: { indicator: "वज़न", text: "आपका वज़न कितना है (पिछली बार दर्ज किया गया)?" },
            },
            {
                id: "height",
                indicator: "Height",
                nodeType: "QUESTION_FREE_TEXT",
                text: "What is your height?",
                hi: { indicator: "लंबाई", text: "आपकी लंबाई कितनी है?" },
            },
            {
                id: "care_model",
                indicator: "Care Model",
                nodeType: "QUESTION_SINGLE",
                text: "Where are you seeking care?",
                options: [
                    { label: "Public / Govt Hospital", value: "public" },
                    { label: "Private Hospital", value: "private" },
                ],
                hi: {
                    indicator: "देखभाल का स्थान",
                    text: "आप कहाँ देखभाल ले रही हैं?",
                    options: { public: "सरकारी अस्पताल", private: "निजी अस्पताल" },
                },
            },
            {
                id: "care_facility",
                indicator: "Care Facility",
                nodeType: "QUESTION_FREE_TEXT",
                text: "Name of the hospital you are taking care from?",
                hi: {
                    indicator: "अस्पताल का नाम",
                    text: "आप जिस अस्पताल से देखभाल ले रही हैं, उसका नाम क्या है?",
                },
            },
        ],
    },
    {
        after: "pregnancy_conditions",
        nodes: [
            {
                id: "health_history",
                indicator: "Health History",
                nodeType: "QUESTION_MULTI",
                text: "Have you ever been told you have any of these? (Select all that apply.)",
                options: [
                    { label: "Diabetes during an earlier pregnancy", value: "prior_gdm" },
                    {
                        label: "High blood pressure, now or in the past",
                        value: "chronic_or_past_high_bp",
                    },
                    { label: "Pre-eclampsia", value: "pre_eclampsia" },
                    { label: "Anaemia or low haemoglobin", value: "anaemia_or_low_hb" },
                    { label: "None of the above", value: "history_conditions_none" },
                ],
                hi: {
                    indicator: "स्वास्थ्य इतिहास",
                    text: "क्या आपको कभी इनमें से कुछ बताया गया है? (जो लागू हों, सभी चुनें)",
                    options: {
                        prior_gdm: "पिछली गर्भावस्था में मधुमेह",
                        chronic_or_past_high_bp: "उच्च रक्तचाप, अभी या पहले",
                        pre_eclampsia: "प्री-एक्लेम्पसिया",
                        anaemia_or_low_hb: "एनीमिया या कम हीमोग्लोबिन",
                        history_conditions_none: "इनमें से कोई नहीं",
                    },
                },
            },
        ],
    },
    {
        after: "parity",
        nodes: [
            {
                id: "pregnancies",
                indicator: "Pregnancy Count",
                nodeType: "QUESTION_FREE_TEXT",
                text: "Counting this one, how many times have you been pregnant?",
                hi: {
                    indicator: "गर्भावस्थाओं की संख्या",
                    text: "इसे मिलाकर, आप कितनी बार गर्भवती रही हैं?",
                },
            },
            {
                id: "living_children",
                indicator: "Living Children",
                nodeType: "QUESTION_FREE_TEXT",
                text: "How many children do you have now?",
                hi: { indicator: "बच्चों की संख्या", text: "अभी आपके कितने बच्चे हैं?" },
            },
        ],
    },
];

const toStoredNode = (node: TNewNode, next: string | null) => ({
    id: node.id,
    categoryId: null,
    indicator: node.indicator,
    nodeType: node.nodeType,
    text: node.text,
    educationalMessage: node.educationalMessage ?? "",
    whyThisMatters: "",
    validWeekStart: null,
    validWeekEnd: null,
    // `score: null`, matching `parity`: onboarding scores are not read by the score engine.
    options: (node.options ?? []).map((option) => ({ ...option, score: null })),
    branch: null,
    calc: null,
    next,
});

/** The node-level Hindi, merged over whatever bundle is already stored for that node. */
const hiUpdates = (existingHi: Record<string, any>): Record<string, unknown> => {
    const update: Record<string, unknown> = {};

    for (const [id, copy] of Object.entries(EXISTING_NODE_COPY_HI)) {
        update[`translations.hi.nodes.${id}`] = { ...(existingHi[id] ?? {}), ...copy };
    }
    for (const group of NEW_NODE_GROUPS) {
        for (const node of group.nodes) {
            update[`translations.hi.nodes.${node.id}`] = node.hi;
        }
    }
    return update;
};

export async function migrate(): Promise<{ insertedNodes: number; reworded: number }> {
    console.log("Starting migration to bring onboarding up to PRD section 1...");

    const onboarding = await flowDefinitionModel
        .findOne({ slug: ONBOARDING_SLUG, status: "PUBLISHED" })
        .sort({ version: -1, createdAt: -1 });

    if (!onboarding) {
        console.warn(`No PUBLISHED "${ONBOARDING_SLUG}" found — skipping.`);
        return { insertedNodes: 0, reworded: 0 };
    }

    const doc = onboarding.toObject() as any;
    const nodes = doc.nodes as any[];
    let insertedNodes = 0;
    let reworded = 0;

    for (const [id, copy] of Object.entries(EXISTING_NODE_COPY)) {
        const node = nodes.find((candidate) => candidate.id === id);
        if (!node) continue;

        let changed = false;
        if (node.text !== copy.text) {
            node.text = copy.text;
            changed = true;
        }
        for (const option of node.options ?? []) {
            const label = copy.options?.[option.value];
            if (label && option.label !== label) {
                option.label = label;
                changed = true;
            }
        }
        if (changed) reworded += 1;
    }

    for (const group of NEW_NODE_GROUPS) {
        const missing = group.nodes.filter(
            (node) => !nodes.some((candidate) => candidate.id === node.id),
        );
        if (missing.length === 0) continue;

        const anchorIndex = nodes.findIndex((node) => node.id === group.after);
        if (anchorIndex === -1) {
            console.warn(`"${group.after}" not found in ${ONBOARDING_SLUG} — skipping its nodes.`);
            continue;
        }

        // Take the anchor's current target as the block's exit, then claim its pointer.
        // Spliced in place because Edit Profile renders the questions in stored order.
        const anchor = nodes[anchorIndex];
        const exit = anchor.next ?? null;
        const stored = missing.map((node, index) =>
            toStoredNode(node, missing[index + 1]?.id ?? exit),
        );
        anchor.next = stored[0]!.id;
        nodes.splice(anchorIndex + 1, 0, ...stored);
        insertedNodes += stored.length;
    }

    const update: Record<string, unknown> = {
        ...hiUpdates(doc.translations?.hi?.nodes ?? {}),
    };
    if (insertedNodes > 0 || reworded > 0) update.nodes = nodes;

    await flowDefinitionModel.updateOne({ _id: onboarding._id }, { $set: update });

    console.log(
        `Onboarding PRD section 1: inserted ${insertedNodes} nodes, reworded ${reworded} nodes.`,
    );
    return { insertedNodes, reworded };
}
