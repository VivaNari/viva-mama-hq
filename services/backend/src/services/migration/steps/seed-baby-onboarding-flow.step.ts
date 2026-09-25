/**
 * Migration step: seed-baby-onboarding-flow.step.ts
 *
 * Seeds the `baby-onboarding-v1` flow definition — the per-child onboarding questionnaire
 * that runs through ChatWithVivaAI on the same engine as the mother flows.
 *
 * Why a migration: there is no update endpoint for a flow definition (only
 * POST /flow-definition to create and GET /flow-definition/:slug to read), so the
 * established route for getting question copy into the database is a migration step. See
 * add-onboarding-feeding-node.step.ts, which this follows.
 *
 * The document is upserted and then edited IN PLACE on re-runs rather than published as a
 * new version. Flow instances carry `flowDefId` and `version`; bumping either would strand
 * every baby onboarding already in progress on an archived document.
 *
 * Idempotency is mandatory: the runner has no ledger and re-runs every step on each
 * run-all.
 */
import flowDefinitionModel from "../../../models/flowDefinition.model";
import { BABY_ONBOARDING_SLUG } from "../../../constants/chat";
import { ESex, EVaccinationSector } from "../../../types/user.types";

const FLOW_NAME = "Baby Onboarding";
const FLOW_VERSION = 1;

/**
 * Seven linearly-chained nodes. Copy comes from the add-baby designs.
 *
 * {{child_name}} is interpolated at question-build time from flow_instances.variables,
 * which the child projector fills in once the name question is answered.
 *
 * `indicator` values are deliberately distinct from every entry in NP_WOMEN_INDICATORS,
 * NN_WOMEN_INDICATORS, BREASTFEEDING_DEPENDENT_INDICATORS and ELIMINATION_INDICATORS.
 * Those gates early-return "eligible" for unrecognised indicators, so distinct strings are
 * what keeps the mother-specific eligibility rules from silently skipping baby questions.
 *
 * There are no measurement options and no "skip": every question is required, and the
 * three measurements are separate QUESTION_FREE_TEXT nodes because the engine has one
 * question per bubble and no numeric node type.
 */
const NODES = [
    {
        id: "child_name",
        categoryId: null,
        indicator: "Child Name",
        nodeType: "QUESTION_FREE_TEXT",
        text: "Let's add your baby. What's their name?",
        educationalMessage: "",
        whyThisMatters: "Nicknames are fine — this is only shown to you.",
        validWeekStart: null,
        validWeekEnd: null,
        options: [],
        branch: null,
        calc: null,
        next: "child_dob",
    },
    {
        id: "child_dob",
        categoryId: null,
        indicator: "Child Date Of Birth",
        nodeType: "QUESTION_DATE",
        text: "When was {{child_name}} born?",
        educationalMessage: "",
        whyThisMatters:
            "We use the date of birth for growth charts and the vaccination schedule.",
        validWeekStart: null,
        validWeekEnd: null,
        options: [],
        branch: null,
        calc: null,
        next: "child_sex",
    },
    {
        id: "child_sex",
        categoryId: null,
        indicator: "Child Sex",
        nodeType: "QUESTION_SINGLE",
        text: "What is {{child_name}}'s sex at birth?",
        educationalMessage: "",
        whyThisMatters:
            "WHO growth standards differ by sex, so we need this to plot the right chart.",
        validWeekStart: null,
        validWeekEnd: null,
        // Exactly two options. "Other" is intentionally absent: ESex.OTHER survives only
        // for the direct POST /api/v1/child contract and must never be offered here.
        // Values match the ESex enum casing verbatim — the projector writes the option
        // value straight into childs.$.sex, so lowercase would fail schema validation.
        options: [
            { label: "Female", value: ESex.FEMALE, score: null },
            { label: "Male", value: ESex.MALE, score: null },
        ],
        branch: null,
        calc: null,
        next: "child_vaccination_sector",
    },
    {
        id: "child_vaccination_sector",
        categoryId: null,
        indicator: "Child Vaccination Sector",
        nodeType: "QUESTION_SINGLE",
        text: "Where will {{child_name}}'s vaccinations be given?",
        educationalMessage:
            "Schedule source: National Immunization Schedule (NIS) · switchable later",
        whyThisMatters:
            "Public and private schedules differ. We'll load the matching one into the Vaccination Log.",
        validWeekStart: null,
        validWeekEnd: null,
        options: [
            {
                label: "Public sector — government hospital / UWIN centre schedule",
                value: EVaccinationSector.PUBLIC,
                score: null,
            },
            {
                label: "Private sector — paediatrician-administered IAP schedule",
                value: EVaccinationSector.PRIVATE,
                score: null,
            },
        ],
        branch: null,
        calc: null,
        next: "child_birth_head_circumference",
    },
    {
        id: "child_birth_head_circumference",
        categoryId: null,
        indicator: "Child Birth Head Circumference",
        nodeType: "QUESTION_FREE_TEXT",
        text: "What was {{child_name}}'s head circumference at birth, in cm? For example, 34.8",
        educationalMessage: "",
        whyThisMatters:
            "Birth measurements become the day-0 point on the growth chart. Growth is tracked until age 5.",
        validWeekStart: null,
        validWeekEnd: null,
        options: [],
        branch: null,
        calc: null,
        next: "child_birth_length",
    },
    {
        id: "child_birth_length",
        categoryId: null,
        indicator: "Child Birth Length",
        nodeType: "QUESTION_FREE_TEXT",
        text: "And {{child_name}}'s length at birth, in cm? For example, 50.5",
        educationalMessage: "",
        whyThisMatters:
            "Length-for-age is one of the three WHO standards we plot against.",
        validWeekStart: null,
        validWeekEnd: null,
        options: [],
        branch: null,
        calc: null,
        next: "child_birth_weight",
    },
    {
        id: "child_birth_weight",
        categoryId: null,
        indicator: "Child Birth Weight",
        nodeType: "QUESTION_FREE_TEXT",
        text: "Last one — what was {{child_name}}'s weight at birth, in grams? For example, 3250",
        educationalMessage: "",
        whyThisMatters:
            "We'll remind you to update these every 2 weeks and after each vaccination visit.",
        validWeekStart: null,
        validWeekEnd: null,
        options: [],
        branch: null,
        calc: null,
        // Terminal node: a null `next` is what ends the flow and triggers completion.
        next: null,
    },
];

/**
 * Hindi bundle, in the shape of translations.hi.nodes[nodeId].
 *
 * Unlike the mother flow's nodes, ordering against add-hindi-translations does not matter
 * here: that step rewrites translations.hi wholesale but only on `onboarding-flow-v2`.
 *
 * Option keys are the option VALUES, so they stay the capitalised ESex tokens.
 */
const NODES_HI: Record<string, unknown> = {
    child_name: {
        indicator: "बच्चे का नाम",
        text: "चलिए आपके बच्चे को जोड़ते हैं। उनका नाम क्या है?",
        whyThisMatters: "घर का नाम भी चलेगा — यह सिर्फ़ आपको दिखेगा।",
    },
    child_dob: {
        indicator: "बच्चे की जन्म तिथि",
        text: "{{child_name}} का जन्म कब हुआ था?",
        whyThisMatters:
            "जन्म तिथि से हम ग्रोथ चार्ट और टीकाकरण का शेड्यूल तय करते हैं।",
    },
    child_sex: {
        indicator: "बच्चे का लिंग",
        text: "जन्म के समय {{child_name}} का लिंग क्या था?",
        whyThisMatters:
            "WHO के ग्रोथ मानक लिंग के अनुसार अलग होते हैं, इसलिए सही चार्ट बनाने के लिए यह ज़रूरी है।",
        options: {
            [ESex.FEMALE]: "लड़की",
            [ESex.MALE]: "लड़का",
        },
    },
    child_vaccination_sector: {
        indicator: "टीकाकरण कहाँ होगा",
        text: "{{child_name}} के टीके कहाँ लगवाए जाएँगे?",
        educationalMessage:
            "शेड्यूल स्रोत: राष्ट्रीय टीकाकरण कार्यक्रम (NIS) · बाद में बदला जा सकता है",
        whyThisMatters:
            "सरकारी और निजी शेड्यूल अलग होते हैं। हम आपके Vaccination Log में सही शेड्यूल लगा देंगे।",
        options: {
            [EVaccinationSector.PUBLIC]:
                "सरकारी — सरकारी अस्पताल / UWIN केंद्र का शेड्यूल",
            [EVaccinationSector.PRIVATE]:
                "निजी — बाल रोग विशेषज्ञ द्वारा IAP शेड्यूल",
        },
    },
    child_birth_head_circumference: {
        indicator: "जन्म के समय सिर की परिधि",
        text: "जन्म के समय {{child_name}} के सिर की परिधि कितनी थी, सेंटीमीटर में? जैसे 34.8",
        whyThisMatters:
            "जन्म के माप ग्रोथ चार्ट पर day-0 बिंदु बनते हैं। ग्रोथ 5 साल की उम्र तक ट्रैक की जाती है।",
    },
    child_birth_length: {
        indicator: "जन्म के समय लंबाई",
        text: "और जन्म के समय {{child_name}} की लंबाई कितनी थी, सेंटीमीटर में? जैसे 50.5",
        whyThisMatters:
            "उम्र के अनुसार लंबाई उन तीन WHO मानकों में से एक है जिन पर हम चार्ट बनाते हैं।",
    },
    child_birth_weight: {
        indicator: "जन्म के समय वज़न",
        text: "आख़िरी सवाल — जन्म के समय {{child_name}} का वज़न कितना था, ग्राम में? जैसे 3250",
        whyThisMatters:
            "हम आपको हर 2 हफ़्ते में और हर टीकाकरण के बाद ये माप अपडेट करने की याद दिलाएँगे।",
    },
};

export async function migrate(): Promise<{ created: boolean; nodes: number }> {
    console.log(`Seeding the "${BABY_ONBOARDING_SLUG}" flow definition...`);

    const existing = await flowDefinitionModel
        .findOne({ slug: BABY_ONBOARDING_SLUG })
        .sort({ version: -1, createdAt: -1 });

    // $set carries the content this seed owns, so a re-run repairs drift. $setOnInsert
    // carries identity fields, so re-running can never renumber the version or resurrect
    // a document an operator deliberately archived.
    const update = {
        $set: {
            name: FLOW_NAME,
            startNodeId: NODES[0]!.id,
            nodes: NODES,
            outcomes: [],
            "translations.hi": { nodes: NODES_HI },
        },
        $setOnInsert: {
            slug: BABY_ONBOARDING_SLUG,
            version: FLOW_VERSION,
            status: "PUBLISHED",
        },
    };

    await flowDefinitionModel.updateOne({ slug: BABY_ONBOARDING_SLUG }, update, {
        upsert: true,
    });

    const created = !existing;
    console.log(
        created
            ? `Created "${BABY_ONBOARDING_SLUG}" with ${NODES.length} nodes.`
            : `"${BABY_ONBOARDING_SLUG}" already present — copy and Hindi re-applied.`,
    );

    return { created, nodes: NODES.length };
}
