import { localizeProduct, localizeProducts } from "../src/utils/i18n/localizeProduct";
import { FlowLanguageEnum } from "../src/types/chat.types";
import { IProduct } from "../src/types/products.types";

const baseProduct = (): IProduct =>
    ({
        _id: "p-1",
        productImageURL: "https://img/x.png",
        productName: "Iron Tablets",
        productAffiliateLink: "https://shop/iron",
        userCategory: "NP_WOMEN",
        validWeekStart: 1,
        validWeekEnd: 12,
        productCategory: "Supplement",
        productDescription: "Daily iron supplement.",
        productPriceRange: "₹200 - ₹400",
        safetyFlag: "Safe while breastfeeding",
        translations: {
            hi: {
                productName: "आयरन टैबलेट",
                productDescription: "रोज़ाना आयरन सप्लीमेंट।",
                safetyFlag: "स्तनपान के दौरान सुरक्षित",
            },
        },
    }) as unknown as IProduct;

describe("localizeProduct", () => {
    it("returns base English (and strips translations) for default lang", () => {
        const out = localizeProduct(baseProduct(), FlowLanguageEnum.EN);
        expect(out.productName).toBe("Iron Tablets");
        expect((out as any).translations).toBeUndefined();
    });

    it("overlays Hindi fields, falls back per-field, keeps structural fields", () => {
        const out = localizeProduct(baseProduct(), FlowLanguageEnum.HI);
        expect(out.productName).toBe("आयरन टैबलेट");
        expect(out.productDescription).toBe("रोज़ाना आयरन सप्लीमेंट।");
        expect(out.safetyFlag).toBe("स्तनपान के दौरान सुरक्षित");
        // no hi translation -> English fallback
        expect(out.productCategory).toBe("Supplement");
        // structural fields untouched
        expect(out.productAffiliateLink).toBe("https://shop/iron");
        expect(out.userCategory).toBe("NP_WOMEN");
        expect((out as any).translations).toBeUndefined();
    });

    it("localizes a list", () => {
        const out = localizeProducts([baseProduct(), baseProduct()], FlowLanguageEnum.HI);
        expect(out).toHaveLength(2);
        expect(out[0]!.productName).toBe("आयरन टैबलेट");
    });
});
