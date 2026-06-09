/**
 * k6 load test: VivaClub discussion forum (VivaClub Community — Activity 2).
 *
 * Auth: the script obtains a JWT once in setup() and reuses it across all iterations.
 * It does NOT use the OTP/WhatsApp login flow (that handler blocks when messaging
 * credentials are absent). Provide auth one of two ways:
 *
 *   A) Paste a token you already have (e.g. from the running app):
 *        TOKEN="<jwt>" k6 run load-tests/k6/viva-club.js
 *
 *   B) Let k6 sign one from the backend secret (HS256, same payload as generateJWT):
 *        JWT_SECRET="<from server .env>" USER_ID="<seeded user _id>" \
 *          k6 run load-tests/k6/viva-club.js
 *
 * Seed at least one post so the like/comment paths exercise on iteration 1
 * (the script also creates posts, so the feed fills regardless).
 *
 * Environment:
 *   BASE_URL     — API origin (default http://localhost:4000)
 *   TOKEN        — a ready JWT (option A)
 *   JWT_SECRET + USER_ID — sign a JWT in-script (option B)
 *   WRITE_RATIO  — fraction of iterations that create a post (default 0.2)
 *   VUS, DURATION  (or K6_STAGES JSON array)
 */

import { check, sleep } from "k6";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import { getLoadProfile } from "./lib/config.js";
import { getPosts, createPost, addComment, toggleLike, firstPostId } from "./lib/vivaClub.js";

const BASE = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const WRITE_RATIO = parseFloat(__ENV.WRITE_RATIO || "0.2");

export const options = {
    ...getLoadProfile(),
    setupTimeout: "30s",
    thresholds: {
        http_req_failed: ["rate<0.01"],
        http_req_duration: ["p(95)<2000"],
        "http_req_duration{name:vivaclub_posts_list}": ["p(95)<1500"],
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
        "No auth provided. Pass TOKEN=<jwt>, or JWT_SECRET=<secret> USER_ID=<seeded user _id>.",
    );
}

export default function vivaClubFlow(data) {
    const token = data.token;

    // Read the feed (most common action).
    const feedRes = getPosts(BASE, token, 1, 10);
    check(feedRes, {
        "feed status 200": (r) => r.status === 200,
        "feed has posts array": (r) => {
            try {
                return Array.isArray(JSON.parse(r.body).data.posts);
            } catch {
                return false;
            }
        },
    });

    // A minority of users create a post.
    if (Math.random() < WRITE_RATIO) {
        const createRes = createPost(BASE, token, `Load-test post from VU ${__VU} iter ${__ITER}`);
        check(createRes, { "create post status 201": (r) => r.status === 201 });
    }

    // Engage with the first visible post (like + comment), if one exists.
    const postId = firstPostId(feedRes);
    if (postId) {
        const likeRes = toggleLike(BASE, token, postId);
        check(likeRes, { "like status 200": (r) => r.status === 200 });

        const commentRes = addComment(BASE, token, postId, "Thanks for sharing, mama!");
        check(commentRes, { "comment status 201": (r) => r.status === 201 });
    }

    sleep(0.3 + Math.random() * 0.4);
}