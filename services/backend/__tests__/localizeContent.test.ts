import { localizeContent, localizeContents } from "../src/utils/i18n/localizeContent";
import { FlowLanguageEnum } from "../src/types/chat.types";
import { ContentBodyTypeEnum, IContent } from "../src/types/content.types";

const baseContent = (): IContent =>
    ({
        _id: "c-1",
        featuredImage: "https://img/x.jpg",
        featuredTitle: "Lochia and Bleeding After Birth: What Is Normal",
        category: "PP",
        validWeekStart: 1,
        validWeekEnd: 52,
        authors: [],
        reviewers: [],
        contentBody: [
            { contentType: ContentBodyTypeEnum.HEADING, body: "Why Bleeding Can Feel Worrying" },
            { contentType: ContentBodyTypeEnum.PARAGRAPH, body: "Bleeding after childbirth..." },
        ],
        translations: {
            hi: {
                featuredTitle: "प्रसव के बाद लोकिया और रक्तस्राव: क्या सामान्य है",
                contentBody: [
                    {
                        contentType: ContentBodyTypeEnum.HEADING,
                        body: "रक्तस्राव चिंताजनक क्यों लग सकता है",
                    },
                    {
                        contentType: ContentBodyTypeEnum.PARAGRAPH,
                        body: "प्रसव के बाद रक्तस्राव...",
                    },
                ],
            },
        },
    }) as unknown as IContent;

describe("localizeContent", () => {
    it("returns base English (and strips translations) for default lang", () => {
        const out = localizeContent(baseContent(), FlowLanguageEnum.EN);
        expect(out.featuredTitle).toBe("Lochia and Bleeding After Birth: What Is Normal");
        expect((out as any).translations).toBeUndefined();
    });

    it("overlays Hindi title + body, keeps structural fields", () => {
        const out = localizeContent(baseContent(), FlowLanguageEnum.HI);
        expect(out.featuredTitle).toBe("प्रसव के बाद लोकिया और रक्तस्राव: क्या सामान्य है");
        expect(out.contentBody[0]!.body).toBe("रक्तस्राव चिंताजनक क्यों लग सकता है");
        expect(out.contentBody[0]!.contentType).toBe(ContentBodyTypeEnum.HEADING);
        expect(out.featuredImage).toBe("https://img/x.jpg");
        expect((out as any).translations).toBeUndefined();
    });

    it("falls back to English body when only the title is translated", () => {
        const c = baseContent();
        delete (c as any).translations.hi.contentBody;
        const out = localizeContent(c, FlowLanguageEnum.HI);
        expect(out.featuredTitle).toBe("प्रसव के बाद लोकिया और रक्तस्राव: क्या सामान्य है");
        // body falls back to English
        expect(out.contentBody[1]!.body).toBe("Bleeding after childbirth...");
    });

    it("localizes a list", () => {
        const out = localizeContents([baseContent()], FlowLanguageEnum.HI);
        expect(out[0]!.featuredTitle).toBe("प्रसव के बाद लोकिया और रक्तस्राव: क्या सामान्य है");
    });
});
