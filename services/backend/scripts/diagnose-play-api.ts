/**
 * Diagnose the Play Developer API service account, in isolation from a real purchase.
 *
 * Answers one question: can this service account read this package's subscriptions?
 *
 * It lists the subscription products, which needs the same credentials, package access
 * and account permissions as verifying a purchase, but no purchase token — so the result
 * is unambiguous:
 *
 *   200  PASS. Key, package and permissions are all correct, and the products Google
 *        returns are printed and cross-checked against PLAY_PRODUCTS.
 *   401  the key itself was rejected: wrong/disabled key, or the Android Publisher API
 *        is not enabled on the Cloud project.
 *   403  authenticated but not authorised. Usually the grant has not propagated yet
 *        (Play takes up to 24-48h after a service account is added to a developer
 *        account), or the account permissions are missing, or the service account is
 *        granted on a different Play developer account than the one owning this package.
 *
 * An earlier version probed a purchase-token endpoint with a made-up token, expecting a
 * 404. Google answers 400 "Invalid Value" instead — the token is rejected on format
 * before it is looked up — which proves auth passed but reads like a failure. Listing
 * products avoids the ambiguity entirely.
 *
 * Reads PLAY_DEVELOPER_SA_KEY_JSON and PLAY_PACKAGE_NAME from .env, so it exercises
 * exactly the configuration the server would use. Never prints the private key.
 *
 * Run:  npx ts-node scripts/diagnose-play-api.ts
 */
import * as path from "path";
import dotenv from "dotenv";
import axios from "axios";
import { JWT } from "google-auth-library";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API_ROOT = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

import { PLAY_PRODUCTS } from "../src/services/subscription/billing/play-products";

async function run() {
    const raw = process.env.PLAY_DEVELOPER_SA_KEY_JSON;
    const packageName = process.env.PLAY_PACKAGE_NAME || "com.wellnessemporio.vivamama";

    if (!raw) {
        throw new Error("PLAY_DEVELOPER_SA_KEY_JSON is not set");
    }

    let key: { client_email?: string; private_key?: string; project_id?: string };
    try {
        key = JSON.parse(raw);
    } catch {
        throw new Error("PLAY_DEVELOPER_SA_KEY_JSON is not valid JSON");
    }
    if (!key.client_email || !key.private_key) {
        throw new Error("PLAY_DEVELOPER_SA_KEY_JSON is missing client_email or private_key");
    }

    console.log("Service account:", key.client_email);
    console.log("Cloud project:  ", key.project_id ?? "(not in key)");
    console.log("Package name:   ", packageName);
    console.log("");

    const jwt = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: [ANDROID_PUBLISHER_SCOPE],
    });

    console.log("Requesting an access token...");
    const { token: accessToken } = await jwt.getAccessToken();
    if (!accessToken) throw new Error("No access token returned — the key was rejected");
    console.log("Access token obtained. The key itself is valid.\n");

    const url = `${API_ROOT}/${packageName}/subscriptions`;
    console.log("Listing subscriptions:", url);

    try {
        const { data } = await axios.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const returned: string[] = (data?.subscriptions ?? []).map(
            (s: { productId: string }) => s.productId,
        );
        console.log(`\nHTTP 200 — Google returned ${returned.length} subscription(s).\n`);
        console.log("PASS. Credentials, package name and account permissions are correct.\n");

        // Cross-check against the catalog the server will look up. A product present in
        // Console but absent from PLAY_PRODUCTS (or the reverse) is the failure mode that
        // surfaces at purchase time as PLAY_PRODUCT_UNMAPPED, long after the typo.
        const expected = Object.values(PLAY_PRODUCTS).map((p) => p.productId);
        for (const id of expected) {
            console.log(`  ${returned.includes(id) ? "✓" : "✗ MISSING"}  ${id}`);
        }
        const extra = returned.filter((id) => !expected.includes(id));
        for (const id of extra) {
            console.log(`  ?  ${id}  (in Console, not in PLAY_PRODUCTS)`);
        }

        if (expected.some((id) => !returned.includes(id)) || extra.length > 0) {
            console.log("\nProduct ids do not match PLAY_PRODUCTS. Fix before purchasing.");
            process.exitCode = 1;
        }
        return;
    } catch (error: any) {
        const status: number | undefined = error?.response?.status;
        const detail: string =
            error?.response?.data?.error?.message ?? error?.message ?? "unknown error";

        console.log(`\nHTTP ${status ?? "?"} — ${detail}\n`);

        if (status === 401) {
            console.log("FAIL — the key was rejected (PLAY_AUTH_FAILED / 401).");
            console.log("Check: the key is current and not disabled, and the Android");
            console.log("Publisher API is enabled on the Cloud project above.");
            process.exitCode = 1;
            return;
        }
        if (status === 403) {
            console.log("FAIL — authenticated but not authorised (PLAY_AUTH_FAILED / 403).");
            console.log("Most likely the Play Console grant has not propagated yet; it can");
            console.log("take 24-48h. Otherwise check that the service account is granted");
            console.log("on the developer account that owns this package, with 'View");
            console.log("financial data' and 'Manage orders and subscriptions'.");
            process.exitCode = 1;
            return;
        }
        console.log("Unexpected status. The message above is Google's own.");
        process.exitCode = 1;
    }
}

run().catch((err) => {
    console.error("Diagnosis failed:", err.message ?? err);
    process.exit(1);
});
