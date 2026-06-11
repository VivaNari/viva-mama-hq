/**
 * k6 load test: phone OTP login (send-otp + verify-otp).
 *
 * Prerequisites: backend running; test OTP 123456 accepted by UserService.verifyOTP.
 *
 * Environment:
 * - BASE_URL — default http://localhost:3000
 * - COUNTRY_CODE — default +1
 * - PHONE_PREFIX — see lib/auth.js
 * - VUS, DURATION — or K6_STAGES JSON array
 *
 * Example:
 *   BASE_URL=http://localhost:3000 k6 run load-tests/k6/login.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { getBaseUrl, getLoadProfile } from "./lib/config.js";
import {
    buildMobileNumber,
    sendOtp,
    verifyOtp,
    parseSendOtpJson,
    parseVerifyOtpJson,
} from "./lib/auth.js";

export const options = {
    ...getLoadProfile(),
    thresholds: {
        http_req_failed: ["rate<0.01"],
        http_req_duration: ["p(95)<2000"],
    },
};

export default function loginFlow() {
    const baseUrl = getBaseUrl();
    const country_code = __ENV.COUNTRY_CODE || "+1";
    const mobile_number = buildMobileNumber();

    const sendRes = sendOtp(baseUrl, mobile_number, country_code);
    const sendOk = check(sendRes, {
        "send_otp status 200": (r) => r.status === 200,
        "send_otp has verification_key": (r) => {
            const j = parseSendOtpJson(r);
            return j !== null && typeof j.verification_key === "string";
        },
    });

    if (!sendOk) {
        sleep(0.5);
        return;
    }

    const sent = parseSendOtpJson(sendRes);
    const verifyRes = verifyOtp(baseUrl, {
        verification_key: sent.verification_key,
        mobile_number,
        country_code,
    });

    check(verifyRes, {
        "verify_otp status 200": (r) => r.status === 200,
        "verify_otp has token": (r) => {
            const j = parseVerifyOtpJson(r);
            return j !== null && typeof j.token === "string";
        },
    });

    sleep(0.2 + Math.random() * 0.3);
}
