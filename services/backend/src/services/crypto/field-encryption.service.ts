import crypto from "crypto";

import env from "../../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const SALT = "vivamama-field-encryption-v1";

/**
 * Encryption for a single sensitive profile field.
 *
 * Separate from crypto.service.ts, which uses a fixed IV. With a fixed IV two users with
 * the same value get the same ciphertext, which matters for a short identifier like an
 * ABHA number. Every value here gets its own random IV and an authentication tag.
 *
 * Stored as base64 of iv + tag + ciphertext. Throws when CRYPTO_PASSWORD is not set, so
 * nothing can be written unprotected by accident.
 */
const keyOf = (): Buffer => {
    const password = env.CRYPTO_PASSWORD;
    if (!password) throw new Error("CRYPTO_PASSWORD is not configured");
    return crypto.scryptSync(password, SALT, 32);
};

export const encryptField = (plain: string): string => {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, keyOf(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
};

export const decryptField = (stored: string): string => {
    const raw = Buffer.from(stored, "base64");
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + 16);
    const encrypted = raw.subarray(IV_BYTES + 16);
    const decipher = crypto.createDecipheriv(ALGORITHM, keyOf(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};
