import crypto from "crypto";
import env from "../../config/env";

const password = env.CRYPTO_PASSWORD as string;
const ivstring = "a2xhcgAAAAAAAAAA";

export const encode = async (data: string) => {
    const key = crypto.scryptSync(password, "salt", 32);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, ivstring);
    const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
    return encrypted.toString("base64");
};

export const decode = async (encrypted: string) => {
    const key = crypto.scryptSync(password, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivstring);
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64")),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
};
