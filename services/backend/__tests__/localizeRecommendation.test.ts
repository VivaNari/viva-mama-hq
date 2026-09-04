import { localizeRecommendation } from "../src/utils/i18n/localizeRecommendation";
import { FlowLanguageEnum } from "../src/types/chat.types";
import { IRecommendationLean } from "../src/types/recommendation.types";

const baseRec = (): IRecommendationLean =>
    ({
        _id: "rec-1",
        phase: "1-2",
        zone: "RED",
        category: "physical",
        title: "Red Zone - Extra Support Needed",
        goingWell: "Lactation & Emotional good!",
        needsHelp: "Physical Recovery needs attention",
        tips: ["Rest fully", "book doctor check"],
        createdAt: new Date(),
        updatedAt: new Date(),
        translations: {
            hi: {
                title: "रेड ज़ोन - अतिरिक्त सहयोग की ज़रूरत",
                needsHelp: "शारीरिक रिकवरी पर ध्यान चाहिए",
                tips: ["पूरा आराम करें", "डॉक्टर से जाँच"],
            },
        },
    }) as unknown as IRecommendationLean;

describe("localizeRecommendation", () => {
    it("returns base English content (and strips translations) for default lang", () => {
        const out = localizeRecommendation(baseRec(), FlowLanguageEnum.EN);
        expect(out.title).toBe("Red Zone - Extra Support Needed");
        expect((out as any).translations).toBeUndefined();
    });

    it("overlays Hindi fields and falls back per-field, preserving routing fields", () => {
        const out = localizeRecommendation(baseRec(), FlowLanguageEnum.HI);
        expect(out.title).toBe("रेड ज़ोन - अतिरिक्त सहयोग की ज़रूरत");
        expect(out.needsHelp).toBe("शारीरिक रिकवरी पर ध्यान चाहिए");
        expect(out.tips).toEqual(["पूरा आराम करें", "डॉक्टर से जाँच"]);
        // no hi translation for goingWell -> English fallback
        expect(out.goingWell).toBe("Lactation & Emotional good!");
        // routing fields untouched
        expect(out.phase).toBe("1-2");
        expect(out.zone).toBe("RED");
        expect(out.category).toBe("physical");
        expect((out as any).translations).toBeUndefined();
    });

    it("falls back to base when no bundle exists for the language", () => {
        const rec = baseRec();
        delete (rec as any).translations;
        const out = localizeRecommendation(rec, FlowLanguageEnum.HI);
        expect(out.title).toBe("Red Zone - Extra Support Needed");
    });
});
