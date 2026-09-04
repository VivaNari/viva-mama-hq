import { localizeFlowDefinition, resolveLanguage } from "../src/utils/i18n/localizeFlowDefinition";
import { FlowLanguageEnum, IFlowDefinition } from "../src/types/chat.types";

const baseDef = (): IFlowDefinition =>
    ({
        _id: "def-1",
        slug: "weekly-checkin-v1",
        name: "Weekly Postpartum Check-in",
        version: 1,
        status: "PUBLISHED",
        reminderIntervalMins: 40,
        notificationTemplates: [
            { notificationType: "NEW_FLOW_INSTANCE", title: "Time!", body: "Let's go" },
        ],
        startNodeId: "lochia_bleeding",
        nodes: [
            {
                id: "lochia_bleeding",
                categoryId: "cat-1",
                indicator: "Lochia/Bleeding",
                nodeType: "QUESTION_SINGLE",
                text: "How is your bleeding?",
                educationalMessage: "Edu EN",
                whyThisMatters: "Why EN",
                validWeekStart: 1,
                validWeekEnd: 8,
                options: [
                    { label: "Heavy", value: "heavy_bleeding", score: 0 },
                    { label: "Light", value: "light_or_no_bleeding", score: 2 },
                ],
                branch: null,
                calc: null,
                next: "perineal",
            },
        ],
        outcomes: [],
        translations: {
            hi: {
                name: "साप्ताहिक प्रसवोत्तर जाँच",
                notificationTemplates: {
                    NEW_FLOW_INSTANCE: { title: "समय!", body: "चलिए" },
                },
                nodes: {
                    lochia_bleeding: {
                        text: "आपका रक्तस्राव कैसा है?",
                        educationalMessage: "Edu HI",
                        options: { heavy_bleeding: "तेज़" },
                    },
                },
            },
        },
    }) as unknown as IFlowDefinition;

describe("resolveLanguage", () => {
    it("returns the first supported candidate", () => {
        expect(resolveLanguage(undefined, "hi")).toBe(FlowLanguageEnum.HI);
        expect(resolveLanguage("HI")).toBe(FlowLanguageEnum.HI);
    });

    it("falls back to English for missing/unsupported values", () => {
        expect(resolveLanguage(undefined, null)).toBe(FlowLanguageEnum.EN);
        expect(resolveLanguage("fr", "es")).toBe(FlowLanguageEnum.EN);
    });
});

describe("localizeFlowDefinition", () => {
    it("returns base (English) content and strips translations for default lang", () => {
        const out = localizeFlowDefinition(baseDef(), FlowLanguageEnum.EN);
        expect(out.name).toBe("Weekly Postpartum Check-in");
        expect(out.nodes[0]!.text).toBe("How is your bleeding?");
        expect((out as any).translations).toBeUndefined();
    });

    it("overlays Hindi strings while preserving logic fields", () => {
        const out = localizeFlowDefinition(baseDef(), FlowLanguageEnum.HI);
        expect(out.name).toBe("साप्ताहिक प्रसवोत्तर जाँच");
        expect(out.notificationTemplates[0]!.title).toBe("समय!");

        const node = out.nodes[0]!;
        expect(node.text).toBe("आपका रक्तस्राव कैसा है?");
        expect(node.educationalMessage).toBe("Edu HI");
        // logic + untranslated fields untouched
        expect(node.whyThisMatters).toBe("Why EN");
        expect(node.next).toBe("perineal");
        expect(node.options[0]!.score).toBe(0);
        expect(node.options[0]!.value).toBe("heavy_bleeding");
        expect((out as any).translations).toBeUndefined();
    });

    it("falls back to English per-field when a translation key is missing", () => {
        const out = localizeFlowDefinition(baseDef(), FlowLanguageEnum.HI);
        const node = out.nodes[0]!;
        // option without a hi label keeps English
        expect(node.options[1]!.label).toBe("Light");
        // whyThisMatters had no hi value
        expect(node.whyThisMatters).toBe("Why EN");
    });
});
