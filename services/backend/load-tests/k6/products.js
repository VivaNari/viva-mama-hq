/**
 * k6 load test: Affiliate Products read path (VivaClub Community — Activity 1).
 *
 * Auth: the script obtains a JWT once in setup() and reuses it across all iterations.
 * It does NOT use the OTP/WhatsApp login flow (that handler blocks when messaging
 * credentials are absent). Provide auth one of two ways:
 *
 *   A) Paste a token you already have (e.g. from the running app):
 *        TOKEN="<jwt>" k6 run load-tests/k6/products.js
 *
 *   B) Let k6 sign one from the backend secret (HS256, same payload as generateJWT):
 *        JWT_SECRET="<from server .env>" USER_ID="<seeded onboarded user _id>" \
 *          k6 run load-tests/k6/products.js
 *
 * GET /products reads user.user_category and user.current_weekdays.weeks, so the
 * USER_ID must be an ONBOARDED user, with at least one product seeded for that
 * user's category and current week.
 *
 * Environment:
 *   BASE_URL     — API origin (default http://localhost:4000)
 *   TOKEN        — a ready JWT (option A)
 *   JWT_SECRET + USER_ID — sign a JWT in-script (option B)
 *   VUS, DURATION  (or K6_STAGES JSON array for ramping)
 */

import { check, sleep } from "k6";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import { getLoadProfile } from "./lib/config.js";
import { getProducts, getProductById } from "./lib/vivaClub.js";

const BASE = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/$/, "");

export const options = {
    ...getLoadProfile(),
    setupTimeout: "30s",
    thresholds: {
        http_req_failed: ["rate<0.01"],
        http_req_duration: ["p(95)<2000"],
        "http_req_duration{name:products_list}": ["p(95)<1500"],
    },
};

// Sign an HS256 JWT matching src/utils/functions/generateJWT.ts (no external call).
function signJwt(secret, userId) {
    const now = Math.floor(Date.now() / 1000);
    const header = encoding.b64encode(JSON.stringify({ alg: "HS256", typ: "JWT" }), "rawurl");
    const payload = encoding.b64encode(
        JSON.stringify({
            _id: userId,
            email: null,
            mobile_number: null,
            is_onboarded: true,
            user_id: null,
            iat: now,
            exp: now + 7 * 24 * 60 * 60,
        }),
        "rawurl",
    );
    const data = `${header}.${payload}`;
    const sig = crypto.hmac("sha256", secret, data, "base64rawurl");
    return `${data}.${sig}`;
}

export function setup() {
    if (__ENV.TOKEN) return { token: __ENV.TOKEN };
    if (__ENV.JWT_SECRET && __ENV.USER_ID) return { token: signJwt(__ENV.JWT_SECRET, __ENV.USER_ID) };
    throw new Error(
        "No auth provided. Pass TOKEN=<jwt>, or JWT_SECRET=<secret> USER_ID=<seeded onboarded user _id>.",
    );
}

export default function productsFlow(data) {
    const token = data.token;

    const listRes = getProducts(BASE, token);
    const listOk = check(listRes, {
        "products list status 200": (r) => r.status === 200,
        "products list returns array": (r) => {
            try {
                return Array.isArray(JSON.parse(r.body).data);
            } catch {
                return false;
            }
        },
    });

    if (listOk) {
        try {
            const products = JSON.parse(listRes.body).data;
            if (Array.isArray(products) && products.length > 0) {
                const detailRes = getProductById(BASE, token, products[0]._id);
                check(detailRes, { "product detail status 200": (r) => r.status === 200 });
            }
        } catch {
            // parse failure already counted by the checks above
        }
    }

    sleep(0.2 + Math.random() * 0.3);
}