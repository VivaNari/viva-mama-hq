/**
 * The perinatal rebrand of the two flow intros: what it rewrites, and — just as
 * important — what it leaves alone. Every other "postpartum" in these documents is
 * clinical and must survive untouched.
 */

jest.mock(require.resolve("../src/config/firebase"), () => ({ __esModule: true, default: null }));
jest.mock(require.resolve("../src/config/redis.config"), () => ({ __esModule: true }));

import { clearTestDb, closeTestDb, connectTestDb } from "./helpers/db";
import flowDefinitionModel from "../src/models/flowDefinition.model";
import { migrate } from "../src/services/migration/steps/rebrand-perinatal-flow-copy.step";

jest.setTimeout(120000);

const ONBOARDING = "onboarding-flow-v2";
const CHECKIN = "weekly-checkin-v1";

const CLINICAL_EN = "Heavy postpartum bleeding can signal infection.";
const CLINICAL_HI = "प्रसवोत्तर संक्रमण 5-10% महिलाओं को प्रभावित करते हैं।";

async function seedFlow(slug: string, introText: string, hiIntroText: string) {
    return flowDefinitionModel.create({
        slug,
        name: `${slug} flow`,
        version: 1,
        status: "PUBLISHED",
        startNodeId: "intro",
        nodes: [
            { id: "intro", nodeType: "QUESTION_SINGLE", text: introText, next: "bleeding" },
            // A clinical node, to prove the rewrite is scoped to the intro.
            { id: "bleeding", nodeType: "QUESTION_SINGLE", text: CLINICAL_EN, next: null },
        ],
        translations: {
            hi: {
                nodes: {
                    intro: { text: hiIntroText },
                    bleeding: { text: CLINICAL_HI },
                },
            },
        },
    });
}

const seedBoth = () =>
    Promise.all([
        seedFlow(
            ONBOARDING,
            "Hello Mama! I am Viva, your postpartum care assistant. Ready to begin?",
            "नमस्ते! मैं हूँ Viva, आपकी प्रसवोत्तर देखभाल सहायक। शुरू करें?",
        ),
        seedFlow(
            CHECKIN,
            "Hello Mama! I am Viva, your postpartum care assistant. Shall we start?",
            "नमस्ते मामा! मैं विवा हूँ, आपकी प्रसवोत्तर देखभाल सहायक। क्या हम शुरू करें?",
        ),
    ]);

async function read(slug: string) {
    const doc = (await flowDefinitionModel.findOne({ slug }))!.toObject() as any;
    const node = (id: string) => doc.nodes.find((n: any) => n.id === id);
    return {
        introEn: node("intro").text as string,
        introHi: doc.translations.hi.nodes.intro.text as string,
        clinicalEn: node("bleeding").text as string,
        clinicalHi: doc.translations.hi.nodes.bleeding.text as string,
    };
}

beforeAll(async () => {
    await connectTestDb();
});

afterAll(async () => {
    await closeTestDb();
});

afterEach(async () => {
    await clearTestDb();
});

describe("rebrand-perinatal-flow-copy", () => {
    it("rewrites the identity phrase in both flows, English and Hindi", async () => {
        await seedBoth();

        await expect(migrate()).resolves.toEqual({ updated: 2 });

        for (const slug of [ONBOARDING, CHECKIN]) {
            const flow = await read(slug);
            expect(flow.introEn).toContain("perinatal care assistant");
            expect(flow.introEn).not.toContain("postpartum");
            expect(flow.introHi).toContain("प्रसवकालीन देखभाल सहायक");
            expect(flow.introHi).not.toContain("प्रसवोत्तर");
        }
    });

    it("keeps the rest of the greeting intact", async () => {
        await seedBoth();
        await migrate();

        expect((await read(ONBOARDING)).introEn).toBe(
            "Hello Mama! I am Viva, your perinatal care assistant. Ready to begin?",
        );
    });

    /**
     * The whole reason the step matches a phrase on one node rather than sweeping the
     * document: "postpartum bleeding" is a clinical term, not branding.
     */
    it("leaves clinical copy on other nodes untouched", async () => {
        await seedBoth();
        await migrate();

        const flow = await read(CHECKIN);
        expect(flow.clinicalEn).toBe(CLINICAL_EN);
        expect(flow.clinicalHi).toBe(CLINICAL_HI);
    });

    it("is idempotent — a second run finds nothing to change", async () => {
        await seedBoth();
        await migrate();

        await expect(migrate()).resolves.toEqual({ updated: 0 });
        expect((await read(ONBOARDING)).introEn).toContain("perinatal care assistant");
    });

    /**
     * add-hindi-translations rewrites `translations.hi` wholesale on every run-all. If it
     * ever ships a stale bundle, this step has to put the wording back.
     */
    it("repairs the Hindi after another step restores the old bundle", async () => {
        const [onboarding] = await seedBoth();
        await migrate();

        await flowDefinitionModel.updateOne(
            { _id: onboarding._id },
            {
                $set: {
                    "translations.hi.nodes.intro.text":
                        "नमस्ते! मैं हूँ Viva, आपकी प्रसवोत्तर देखभाल सहायक।",
                },
            },
        );

        await expect(migrate()).resolves.toEqual({ updated: 1 });
        expect((await read(ONBOARDING)).introHi).toContain("प्रसवकालीन देखभाल सहायक");
    });

    it("tolerates a flow with no intro node and one that is absent entirely", async () => {
        await flowDefinitionModel.create({
            slug: ONBOARDING,
            name: "no intro",
            version: 1,
            status: "PUBLISHED",
            startNodeId: "name",
            nodes: [{ id: "name", nodeType: "QUESTION_FREE_TEXT", text: "Name?", next: null }],
        });

        // weekly-checkin-v1 is not seeded at all here.
        await expect(migrate()).resolves.toEqual({ updated: 0 });
    });

    it("ignores a draft flow and only touches the published one", async () => {
        await seedFlow(
            ONBOARDING,
            "Hello Mama! I am Viva, your postpartum care assistant.",
            "नमस्ते! प्रसवोत्तर देखभाल सहायक।",
        );
        const draft = await flowDefinitionModel.create({
            slug: ONBOARDING,
            name: "draft",
            version: 2,
            status: "DRAFT",
            startNodeId: "intro",
            nodes: [
                {
                    id: "intro",
                    nodeType: "QUESTION_SINGLE",
                    text: "I am Viva, your postpartum care assistant.",
                    next: null,
                },
            ],
        });

        await migrate();

        const untouched = (await flowDefinitionModel.findById(draft._id))!.toObject() as any;
        expect(untouched.nodes[0].text).toContain("postpartum care assistant");
    });
});
