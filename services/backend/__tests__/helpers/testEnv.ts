/**
 * Jest `setupFiles` entry — runs before any test module is imported.
 *
 * `src/config/env.ts` snapshots `process.env` into a plain object at import time, and
 * nothing loads `.env` in a test run (dotenv is bootstrapped from the server entrypoint,
 * which tests never execute). So a value set inside a test file is already too late: the
 * import that reads it has run.
 *
 * Only fills what is unset, so a CI job that exports real values still wins. These are
 * deliberately obvious fakes — nothing here reaches a network.
 */
const TEST_DEFAULTS: Record<string, string> = {
    NODE_ENV: "test",
    // Keys the HMAC behind Play's obfuscatedAccountId. Any stable string works; the
    // property under test is that the digest is stable and non-reversible, not its value.
    CRYPTO_PASSWORD: "test-crypto-password",
    JWT_SECRET: "test-jwt-secret",
    RAZORPAY_API_KEY: "rzp_test_key",
    RAZORPAY_SECRET_KEY: "rzp_test_secret",
    PLAY_PACKAGE_NAME: "com.wellnessemporio.vivamama",
};

for (const [key, value] of Object.entries(TEST_DEFAULTS)) {
    if (!process.env[key]) process.env[key] = value;
}
