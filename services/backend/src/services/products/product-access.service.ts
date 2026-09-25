import { IProduct } from "../../types/products.types";
import { EAccess, ICapabilityRule } from "../entitlements/entitlement.config";

/**
 * Applies the resolved product entitlement.
 *
 * FREE sees the first N by (sortOrder, _id); the rest come back locked with the
 * affiliate link stripped. Blurring in the UI while shipping the link in the payload is
 * not a paywall — anyone reading the response gets the product regardless.
 *
 * These take the RESOLVED RULE, not a tier, because a per-user override can suppress
 * products for a referred mother whose tier would otherwise allow them. Passing a tier
 * here would silently skip that check — and it used to do exactly that: reading only
 * `.limit` meant a LOCKED rule (which carries no `limit` key) landed on
 * `undefined == null` and returned every product UNLOCKED. Check `access` first.
 */

export function redactProduct(product: IProduct): Partial<IProduct> {
    const { productAffiliateLink, ...rest } = product;
    void productAffiliateLink;
    return { ...rest, isLocked: true };
}

function toPlain(product: IProduct | any): IProduct {
    return product && typeof product.toObject === "function" ? product.toObject() : product;
}

export function applyProductEntitlements(
    products: IProduct[],
    rule: ICapabilityRule,
): Array<IProduct | Partial<IProduct>> {
    // Suppressed entirely: nothing to slice, nothing to redact. An empty list rather
    // than locked cards, because the app hides the tab for these users — a locked card
    // would advertise something she can never unlock.
    if (rule.access === EAccess.LOCKED) return [];

    const limit = rule.limit;

    if (limit == null) {
        return products.map(toPlain);
    }

    return products.map((raw, index) => {
        const product = toPlain(raw);
        return index < limit ? product : redactProduct(product);
    });
}

export function isProductUnlocked(
    productId: string,
    products: IProduct[],
    rule: ICapabilityRule,
): boolean {
    if (rule.access === EAccess.LOCKED) return false;

    const limit = rule.limit;
    if (limit == null) return true;

    const index = products.findIndex((p) => String(p._id) === String(productId));
    return index > -1 && index < limit;
}
