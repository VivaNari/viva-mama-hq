import { localizeExpert, localizeExperts } from "../src/utils/i18n/localizeExpert";
import { FlowLanguageEnum } from "../src/types/chat.types";
import { IExpert } from "../src/types/expert.types";

const baseExpert = (): IExpert =>
    ({
        _id: "e-1",
        name: "Dr Saumya Prasad",
        speciality: "Obstetrician & Gynaecologist",
        qualification: null,
        yearsOfExperience: 10,
        bio: null,
        photograph: "https://assets/x.png",
        remuneration: 800,
        isActive: true,
        translations: {
            hi: {
                name: "डॉ. सौम्या प्रसाद",
                speciality: "प्रसूति एवं स्त्री रोग विशेषज्ञ",
            },
        },
    }) as unknown as IExpert;

describe("localizeExpert", () => {
    it("returns base English (and strips translations) for default lang", () => {
        const out = localizeExpert(baseExpert(), FlowLanguageEnum.EN);
        expect(out.speciality).toBe("Obstetrician & Gynaecologist");
        expect((out as any).translations).toBeUndefined();
    });

    it("overlays Hindi fields, keeps structural fields", () => {
        const out = localizeExpert(baseExpert(), FlowLanguageEnum.HI);
        expect(out.name).toBe("डॉ. सौम्या प्रसाद");
        expect(out.speciality).toBe("प्रसूति एवं स्त्री रोग विशेषज्ञ");
        expect(out.yearsOfExperience).toBe(10);
        expect(out.remuneration).toBe(800);
        expect(out.photograph).toBe("https://assets/x.png");
        expect((out as any).translations).toBeUndefined();
    });

    it("falls back to base when no bundle exists", () => {
        const e = baseExpert();
        delete (e as any).translations;
        const out = localizeExpert(e, FlowLanguageEnum.HI);
        expect(out.speciality).toBe("Obstetrician & Gynaecologist");
    });

    it("localizes a list", () => {
        const out = localizeExperts([baseExpert(), baseExpert()], FlowLanguageEnum.HI);
        expect(out).toHaveLength(2);
        expect(out[1]!.name).toBe("डॉ. सौम्या प्रसाद");
    });
});
