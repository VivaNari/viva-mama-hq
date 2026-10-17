/**
 * Product access, tested against the access rule directly.
 *
 * products.controller.test.ts cannot see any of this: it stubs the controller, so the
 * LOCKED case below — which returned every product UNLOCKED before this change — passed
 * a green suite for as long as it existed.
 */
import {
    applyProductEntitlements,
    isProductUnlocked,
    redactProduct,
} from "../src/services/products/product-access.service";
import {
    EAccess,
    ECapability,
    getRule,
    ICapabilityRule,
} from "../src/services/entitlements/entitlement.config";
import { ESubscriptionTier } from "../src/types/subscription.types";
import { IProduct } from "../src/types/products.types";

const product = (id: string) =>
    ({
        _id: id,
        productName: `p-${id}`,
        productAffiliateLink: "https://buy.example/secret",
        productImageURL: "img",
        userCategory: ["PP"],
        validWeekStart: 1,
        validWeekEnd: 6,
        sortOrder: 0,
        productCategory: "c",
        productDescription: "d",
        productPriceRange: "r",
        safetyFlag: "SAFE",
    }) as unknown as IProduct;

const catalog = () => ["a", "b", "c", "d"].map(product);

const ALLOWED_UNLIMITED: ICapabilityRule = { access: EAccess.ALLOWED, limit: null };
const ALLOWED_TWO: ICapabilityRule = { access: EAccess.ALLOWED, limit: 2 };
/** No `limit` key at all — exactly the shape the entitlement matrix produces. */
const LOCKED: ICapabilityRule = { access: EAccess.LOCKED };

describe("applyProductEntitlements", () => {
    /**
     * The regression test. The old implementation read only `.limit`; a LOCKED rule
     * carries no limit key, so `undefined == null` was true and it fell into the
     * "unlimited" branch — suppression would have shipped every product with its
     * affiliate link intact.
     */
    it("returns nothing when the capability is LOCKED", () => {
        expect(applyProductEntitlements(catalog(), LOCKED)).toEqual([]);
    });

    it("returns everything when unlimited", () => {
        const out = applyProductEntitlements(catalog(), ALLOWED_UNLIMITED);
        expect(out).toHaveLength(4);
        expect(out.every((p) => !p.isLocked)).toBe(true);
        expect(out.every((p) => p.productAffiliateLink)).toBe(true);
    });

    it("unlocks the first N and redacts the rest", () => {
        const out = applyProductEntitlements(catalog(), ALLOWED_TWO);
        expect(out.filter((p) => !p.isLocked)).toHaveLength(2);
        expect(out[0]!._id).toBe("a");
        expect(out[1]!._id).toBe("b");

        for (const locked of out.filter((p) => p.isLocked)) {
            // Blurring in the UI while shipping the link is not a paywall.
            expect(locked.productAffiliateLink).toBeUndefined();
        }
    });

    it("matches the live FREE rule from the matrix", () => {
        const rule = getRule(ESubscriptionTier.FREE, ECapability.PRODUCTS_VIEW);
        const out = applyProductEntitlements(catalog(), rule);
        expect(out.filter((p) => !p.isLocked)).toHaveLength(rule.limit!);
    });
});

describe("isProductUnlocked", () => {
    it("is false for everything when LOCKED", () => {
        for (const id of ["a", "b", "c", "d"]) {
            expect(isProductUnlocked(id, catalog(), LOCKED)).toBe(false);
        }
    });

    it("is true for everything when unlimited", () => {
        expect(isProductUnlocked("d", catalog(), ALLOWED_UNLIMITED)).toBe(true);
    });

    it("respects the slice, and rejects an id outside the visible set", () => {
        expect(isProductUnlocked("a", catalog(), ALLOWED_TWO)).toBe(true);
        expect(isProductUnlocked("c", catalog(), ALLOWED_TWO)).toBe(false);
        // Otherwise the affiliate link is one guessable id away.
        expect(isProductUnlocked("zzz", catalog(), ALLOWED_TWO)).toBe(false);
    });
});

describe("redactProduct", () => {
    it("strips the affiliate link and flags the product", () => {
        const out = redactProduct(product("a"));
        expect(out.productAffiliateLink).toBeUndefined();
        expect(out.isLocked).toBe(true);
        expect(out.productName).toBe("p-a");
    });
});
