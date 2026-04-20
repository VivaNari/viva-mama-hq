/**
 * k6 load test: weekly check-in v1 (authenticated onboarding-style flow).
 *
 * AUTH_MODE:
 * - jwt  — set JWT to a valid Bearer token (single token for all VUs; throughput test).
 * - login — send-otp + verify-otp per iteration (unique phone). Check-in start only succeeds
 *           if users have current_weekdays.weeks >= CHECKIN_WEEK (usually requires seeded users).
 * - csv  — JWT_CSV path to a text file: one JWT per line (cycles by VU for multi-user load).
 *
 * Environment:
 * - BASE_URL — default http://localhost:3000
 * - CHECKIN_WEEK — postpartum week 1–52 (default 1)
 * - FLOW_SLUG — default weekly-checkin-v1
 * - HIT_GETS — if "1", also GET /chat/checkin/answer/current and /status
 * - MAX_ANSWER_STEPS — cap answer loop (default 50)
 * - COUNTRY_CODE, PHONE_PREFIX — for AUTH_MODE=login
 * - VUS, DURATION, K6_STAGES — see lib/config.js
 *
 * Example:
 *   AUTH_MODE=jwt JWT=eyJ... CHECKIN_WEEK=4 BASE_URL=http://localhost:3000 k6 run load-tests/k6/weekly-checkin-onboarding.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Trend } from "k6/metrics";
import { getBaseUrl, getLoadProfile } from "./lib/config.js";
import {
    buildMobileNumber,
    loginWithOtp,
    authHeader,
} from "./lib/auth.js";

const checkinStartDuration = new Trend("checkin_start_duration", true);
const checkinAnswerDuration = new Trend("checkin_answer_duration", true);

const DEFAULT_FLOW_SLUG = "weekly-checkin-v1";

/**
 * k6 treats status outside 200-399 as failed HTTP unless overridden. These callbacks
 * mark API responses (400 WEEK_MISMATCH, 409 ALREADY_COMPLETED, etc.) as expected so
 * `http_req_failed` matches the script checks.
 */
const expectCheckinStart = http.expectedStatuses(200, 400, 409);
const expectCheckinAnswer = http.expectedStatuses(200, 400);

/**
 * @returns {string[]}
 */
function loadJwtLinesFromFile() {
    const path = __ENV.JWT_CSV;
    if (!path) {
        return [];
    }
    try {
        const text = open(path);
        return text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith("#"));
    } catch (e) {
        console.error(`Failed to read JWT_CSV: ${String(e)}`);
        return [];
    }
}

const jwtLines = new SharedArray("jwt_lines", function () {
    return loadJwtLinesFromFile();
});

export const options = {
    ...getLoadProfile(),
    thresholds: {
        http_req_failed: ["rate<0.05"],
        http_req_duration: ["p(95)<5000"],
    },
};

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} week
 * @param {string} flowSlug
 */
function postStartCheckin(baseUrl, token, week, flowSlug) {
    const url = `${baseUrl}/api/v1/chat/checkin/start`;
    const start = Date.now();
    const res = http.post(
        url,
        JSON.stringify({ week, flowSlug }),
        {
            ...authHeader(token),
            tags: { name: "checkin_start" },
            responseCallback: expectCheckinStart,
        },
    );
    checkinStartDuration.add(Date.now() - start);
    return res;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {Record<string, unknown>} body
 */
function postAnswer(baseUrl, token, body) {
    const url = `${baseUrl}/api/v1/chat/checkin/answer`;
    const start = Date.now();
    const res = http.post(url, JSON.stringify(body), {
        ...authHeader(token),
        tags: { name: "checkin_answer" },
        responseCallback: expectCheckinAnswer,
    });
    checkinAnswerDuration.add(Date.now() - start);
    return res;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} week
 */
function getCurrentState(baseUrl, token, week) {
    const url = `${baseUrl}/api/v1/chat/checkin/answer/current?week=${week}`;
    return http.get(url, {
        ...authHeader(token),
        tags: { name: "checkin_current" },
    });
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} week
 */
function getStatus(baseUrl, token, week) {
    const url = `${baseUrl}/api/v1/status?week=${week}`;
    return http.get(url, {
        ...authHeader(token),
        tags: { name: "checkin_status" },
    });
}

/**
 * @param {string} token
 * @param {number} week
 * @param {string} flowSlug
 */
function runCheckinFlow(baseUrl, token, week, flowSlug) {
    const maxSteps = parseInt(__ENV.MAX_ANSWER_STEPS || "50", 10);
    const hitGets = __ENV.HIT_GETS === "1";

    const startRes = postStartCheckin(baseUrl, token, week, flowSlug);
    const startParsed = safeJson(startRes);
    if (
        !check(startRes, {
            "start_checkin 200 or 409": (r) =>
                r.status === 200 || r.status === 409,
        })
    ) {
        return;
    }

    if (startRes.status === 409) {
        // Already completed — still valid for load
        return;
    }

    if (!startParsed || startParsed.success !== true || !startParsed.data) {
        return;
    }

    let nextQuestion = startParsed.data.nextQuestion;
    let flowInstanceId = startParsed.data.flowInstanceId;
    let isCompleted = startParsed.data.isCompleted === true;

    if (hitGets) {
        getCurrentState(baseUrl, token, week);
        getStatus(baseUrl, token, week);
    }

    let step = 0;
    while (!isCompleted && nextQuestion && step < maxSteps) {
        const nodeId = nextQuestion.id;
        const idempotencyKey = `k6-${__VU}-${__ITER}-${step}-${Date.now()}`;

        /** @type {Record<string, unknown>} */
        const body = {
            flowInstanceId,
            nodeId,
            week,
            idempotencyKey,
        };

        const options = Array.isArray(nextQuestion.options) ? nextQuestion.options : [];
        if (options.length > 0 && typeof options[0].score === "number") {
            body.selectedKeys = [options[0].score];
        } else {
            body.freeText = "k6 load test answer";
        }

        const ansRes = postAnswer(baseUrl, token, body);
        const ansParsed = safeJson(ansRes);

        check(ansRes, {
            "answer 200 or 400": (r) => r.status === 200 || r.status === 400,
        });

        if (ansRes.status !== 200 || !ansParsed || ansParsed.success !== true) {
            break;
        }

        if (ansParsed.data) {
            flowInstanceId = ansParsed.data.flowInstanceId || flowInstanceId;
            isCompleted = ansParsed.data.isCompleted === true;
            nextQuestion = ansParsed.data.nextQuestion;
        } else {
            break;
        }

        step += 1;
        if (hitGets) {
            getCurrentState(baseUrl, token, week);
        }
        sleep(0.05 + Math.random() * 0.1);
    }
}

/**
 * @param {import("k6/http").RefinedResponse<"text">} res
 * @returns {Record<string, unknown> | null}
 */
function safeJson(res) {
    if (!res.body) {
        return null;
    }
    try {
        return JSON.parse(res.body);
    } catch {
        return null;
    }
}

/**
 * @returns {string | null}
 */
function resolveToken() {
    const mode = (__ENV.AUTH_MODE || "jwt").toLowerCase();
    const baseUrl = getBaseUrl();

    if (mode === "jwt") {
        const t = __ENV.JWT;
        return t && t.length > 0 ? t : null;
    }

    if (mode === "csv") {
        if (!jwtLines.length) {
            return null;
        }
        const idx = __VU % jwtLines.length;
        return jwtLines[idx];
    }

    if (mode === "login") {
        const country = __ENV.COUNTRY_CODE || "+1";
        const mobile = buildMobileNumber();
        return loginWithOtp(baseUrl, mobile, country);
    }

    return null;
}

export default function checkinOnboarding() {
    const baseUrl = getBaseUrl();
    const week = parseInt(__ENV.CHECKIN_WEEK || "1", 10);
    const flowSlug = __ENV.FLOW_SLUG || DEFAULT_FLOW_SLUG;

    const token = resolveToken();
    if (
        !check(token, {
            "has auth token": (t) => typeof t === "string" && t.length > 0,
        })
    ) {
        sleep(0.5);
        return;
    }

    runCheckinFlow(baseUrl, token, week, flowSlug);
    sleep(0.2 + Math.random() * 0.2);
}
