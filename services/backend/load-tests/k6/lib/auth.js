/**
 * OTP and Bearer helpers for k6 login flows.
 *
 * Backend accepts test OTP `123456` in verify-otp (see user.service verifyOTP).
 *
 * Environment:
 * - PHONE_PREFIX — digits after country for generated mobiles (default 555)
 * - COUNTRY_CODE — e.g. +1
 */

import http from "k6/http";

const TEST_OTP = "123456";

/**
 * Builds a unique mobile_number (local part) for this VU/iteration to reduce OTP/user collisions.
 * @returns {string}
 */
export function buildMobileNumber() {
    const prefix = __ENV.PHONE_PREFIX || "555";
    const vu = typeof __VU !== "undefined" ? __VU : 0;
    const iter = typeof __ITER !== "undefined" ? __ITER : 0;
    const n = vu * 1000000 + iter;
    const suffix = String(n % 10000000).padStart(7, "0");
    return `${prefix}${suffix}`;
}

/**
 * POST /api/v1/auth/send-otp
 * @param {string} baseUrl
 * @param {string} mobile_number
 * @param {string} country_code
 * @returns {import("k6/http").RefinedResponse<"text">}
 */
export function sendOtp(baseUrl, mobile_number, country_code) {
    const url = `${baseUrl}/api/v1/auth/send-otp`;
    const payload = JSON.stringify({ mobile_number, country_code });
    return http.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        tags: { name: "auth_send_otp" },
    });
}

/**
 * POST /api/v1/auth/verify-otp (use TEST_OTP after send-otp).
 * @param {string} baseUrl
 * @param {{ verification_key: string, mobile_number: string, country_code: string, FCM_token?: string }} body
 * @returns {import("k6/http").RefinedResponse<"text">}
 */
export function verifyOtp(baseUrl, body) {
    const url = `${baseUrl}/api/v1/auth/verify-otp`;
    const payload = JSON.stringify({
        verification_key: body.verification_key,
        otp: TEST_OTP,
        mobile_number: body.mobile_number,
        country_code: body.country_code,
        FCM_token: body.FCM_token,
    });
    return http.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        tags: { name: "auth_verify_otp" },
    });
}

/**
 * Parses send-otp JSON body for verification_key.
 * @param {import("k6/http").RefinedResponse<"text">} res
 * @returns {{ verification_key?: string } | null}
 */
export function parseSendOtpJson(res) {
    if (res.status !== 200 || !res.body) {
        return null;
    }
    try {
        return JSON.parse(res.body);
    } catch {
        return null;
    }
}

/**
 * Parses verify-otp JSON for JWT token.
 * @param {import("k6/http").RefinedResponse<"text">} res
 * @returns {{ token?: string } | null}
 */
export function parseVerifyOtpJson(res) {
    if (res.status !== 200 || !res.body) {
        return null;
    }
    try {
        return JSON.parse(res.body);
    } catch {
        return null;
    }
}

/**
 * Runs send-otp then verify-otp; returns JWT or null on failure.
 * @param {string} baseUrl
 * @param {string} mobile_number
 * @param {string} country_code
 * @returns {string | null}
 */
export function loginWithOtp(baseUrl, mobile_number, country_code) {
    const sendRes = sendOtp(baseUrl, mobile_number, country_code);
    const sent = parseSendOtpJson(sendRes);
    if (!sent || !sent.verification_key) {
        return null;
    }
    const verifyRes = verifyOtp(baseUrl, {
        verification_key: sent.verification_key,
        mobile_number,
        country_code,
    });
    const verified = parseVerifyOtpJson(verifyRes);
    return verified && verified.token ? verified.token : null;
}

/**
 * @param {string} token
 * @returns {{ headers: Record<string, string> }}
 */
export function authHeader(token) {
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    };
}
