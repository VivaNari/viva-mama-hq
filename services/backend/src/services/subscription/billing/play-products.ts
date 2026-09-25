import { EPlanCode } from "../../../types/subscription.types";

/**
 * ⚠️ THE ONLY FILE THAT NEEDS EDITING WHEN THE PLAY CONSOLE PRODUCTS EXIST.
 *
 * Eight strings. Everything else — the schema fields, the seed migration, the mapping
 * used to resolve a purchase back to a plan — reads from here, so there is nothing to
 * hunt for elsewhere.
 *
 * The values below are placeholders following a convention. If the products are created
 * in Play Console with exactly these ids, nothing needs changing at all.
 *
 * Play Console constraints, so the real ids do not come back rejected:
 *   - product id:   lowercase letters, digits, underscores and periods; must start with
 *                   a letter or digit; immutable once created
 *   - base plan id: lowercase letters, digits and hyphens; immutable once created
 *
 * Each plan gets exactly one base plan for now. A second base plan on the same product
 * (say a promotional price) would need its own row here, because the base plan id is
 * part of what identifies the purchase.
 */
export interface IPlayProduct {
    productId: string;
    basePlanId: string;
}

export const PLAY_PRODUCTS: Record<EPlanCode, IPlayProduct> = {
    [EPlanCode.LITE]: {
        productId: "vivamama_lite",
        basePlanId: "lite-monthly",
    },
    [EPlanCode.MONTHLY]: {
        productId: "vivamama_monthly",
        basePlanId: "monthly-auto",
    },
    [EPlanCode.QUARTERLY]: {
        productId: "vivamama_quarterly",
        basePlanId: "quarterly-auto",
    },
    [EPlanCode.HALF_YEARLY]: {
        productId: "vivamama_half_yearly",
        basePlanId: "half-yearly-auto",
    },
};

/**
 * Reverse lookup: what Google says was bought -> which plan that is.
 *
 * Keyed on productId alone, not productId+basePlanId. Google reports the base plan in
 * `offerDetails`, but it is absent on some notification paths and on purchases made
 * before an offer existed. Matching on the product alone resolves in every case, and the
 * base plan is then checked separately as a consistency signal rather than a lookup key.
 */
const BY_PRODUCT_ID: ReadonlyMap<string, EPlanCode> = new Map(
    Object.entries(PLAY_PRODUCTS).map(([code, p]) => [p.productId, code as EPlanCode]),
);

/**
 * Resolve a Play product id to a plan code, or null when it is not one of ours.
 *
 * Null must be treated as an error by the caller, never as "use the default plan". A
 * mistyped id that silently resolved to LITE would grant the wrong tier and the wrong
 * credit buckets, and no downstream check would notice.
 */
export function planCodeForPlayProduct(productId: string): EPlanCode | null {
    return BY_PRODUCT_ID.get(productId) ?? null;
}

/** Guards against two plans being pointed at the same Play product by a copy-paste. */
export function assertPlayProductsAreDistinct(): void {
    const ids = Object.values(PLAY_PRODUCTS).map((p) => p.productId);
    if (new Set(ids).size !== ids.length) {
        throw new Error(
            `PLAY_PRODUCTS contains duplicate product ids: ${ids.join(", ")}. ` +
                `Each plan needs its own Play Console product.`,
        );
    }
}
