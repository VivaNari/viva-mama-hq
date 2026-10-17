import crypto from "crypto";

import env from "../../../config/env";
import { TObjectIdLike } from "../../../types/subscription.types";

/**
 * The `obfuscatedAccountId` attached to a Play purchase.
 *
 * Google stores this string against the purchase and returns it on every subsequent
 * lookup, which buys two things:
 *
 *  1. **Purchase binding.** `/subscription/play/verify` is authenticated, so we know who
 *     is calling — but not who *bought*. Without this, a purchase token lifted from
 *     another user (a shared device, a rooted phone, a leaked network log) could be
 *     redeemed by whoever presents it first. The unique index on `playPurchaseToken`
 *     stops the same token being redeemed twice, but not the wrong person redeeming it
 *     first.
 *  2. **Attribution.** A Real-Time Developer Notification carries no user id. When the
 *     row lookup by purchase token fails — a purchase that never completed verification,
 *     say — this is the only remaining thread back to a user.
 *
 * It is a keyed hash, not the raw id: Play stores it, Play support can see it, and it
 * ends up in exported financial reports. HMAC over CRYPTO_PASSWORD means a leaked value
 * is not reversible to a user id and cannot be forged by a client.
 *
 * Google caps this field at 64 characters, which a hex SHA-256 exactly fills.
 */
export function obfuscatedPlayAccountId(userId: TObjectIdLike): string {
    const secret = env.CRYPTO_PASSWORD as string | undefined;
    if (!secret) {
        // Refuse rather than fall back to an unkeyed hash. An unkeyed digest of a Mongo
        // ObjectId is trivially checkable against a guessed id, which would quietly
        // remove the protection this function exists to provide.
        throw new Error("CRYPTO_PASSWORD is required to derive a Play account id");
    }
    return crypto.createHmac("sha256", secret).update(String(userId)).digest("hex");
}

/**
 * Compare in constant time. The value is not quite a secret, but it is the thing an
 * attacker would need to guess to bind a stolen purchase token to their own account, and
 * a byte-by-byte comparison is exactly what makes guessing feasible.
 */
export function playAccountIdMatches(expected: string, actual: string | undefined): boolean {
    if (!actual) return false;
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(actual, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}
