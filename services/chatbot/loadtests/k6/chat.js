/**
 * k6 load test: POST /v1/chat
 *
 * Environment variables:
 *   BASE_URL     - e.g. https://api.example.com or http://localhost:8000 (no trailing path)
 *   API_KEY      - value for X-API-Key header (required if server has API_KEY set)
 *   QUERY        - optional user message (default: short postpartum wellness question)
 *   SCENARIO     - quick | smoke | load  (default: smoke)
 *                  quick = 3 iterations, 1 VU (fast script check; set BASE_URL)
 *
 * Examples (vars on the command only):
 *   BASE_URL=http://localhost:8000 API_KEY=secret SCENARIO=smoke k6 run loadtests/k6/chat.js
 *   BASE_URL=http://localhost:8000 API_KEY=secret SCENARIO=load k6 run loadtests/k6/chat.js
 *   BASE_URL=http://localhost:8000 API_KEY=secret SCENARIO=quick k6 run loadtests/k6/chat.js
 *   BASE_URL=http://localhost:8000 API_KEY=secret QUERY="Your question" SCENARIO=smoke k6 run loadtests/k6/chat.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";

const chatLatency = new Trend("chat_success_duration", true);
const status200 = new Counter("status_200");
const status401 = new Counter("status_401");
const status429 = new Counter("status_429");
const status5xx = new Counter("status_5xx");
const statusOther = new Counter("status_other");

const baseUrl = (__ENV.BASE_URL || "").replace(/\/+$/, "");
const apiKey = __ENV.API_KEY || "";
const defaultQuery =
  __ENV.QUERY ||
  "What are gentle tips for postpartum rest and recovery in the first weeks?";

const scenario = (__ENV.SCENARIO || "smoke").toLowerCase();

/** Fast validation only (does not stress the rate limiter meaningfully). */
const optionsQuick = {
  vus: 1,
  iterations: 3,
  thresholds: {
    http_req_failed: ["rate<=1"],
  },
};

/** Strategy A: stay under 60 req/min per IP — smoke uses 30/min, load uses 55/min. */
const optionsSmoke = {
  scenarios: {
    smoke: {
      executor: "constant-arrival-rate",
      rate: 30,
      timeUnit: "1m",
      duration: "1m",
      preAllocatedVUs: 2,
      maxVUs: 8,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.5"],
    checks: ["rate>0.3"],
    status_429: ["count<20"],
  },
};

const optionsLoad = {
  scenarios: {
    under_rate_limit: {
      executor: "constant-arrival-rate",
      rate: 55,
      timeUnit: "1m",
      duration: "5m",
      preAllocatedVUs: 5,
      maxVUs: 25,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.5"],
    checks: ["rate>0.5"],
    status_429: ["count<50"],
    http_req_duration: ["p(95)<120000"],
  },
};

function resolveOptions() {
  if (scenario === "load") {
    return optionsLoad;
  }
  if (scenario === "quick") {
    return optionsQuick;
  }
  return optionsSmoke;
}

export const options = resolveOptions();

export function setup() {
  if (!baseUrl) {
    throw new Error("BASE_URL is required (e.g. http://localhost:8000)");
  }
  return { baseUrl, apiKey };
}

function recordStatus(res) {
  const c = res.status;
  if (c === 200) {
    status200.add(1);
    chatLatency.add(res.timings.duration);
  } else if (c === 401) status401.add(1);
  else if (c === 429) status429.add(1);
  else if (c >= 500 && c < 600) status5xx.add(1);
  else statusOther.add(1);
}

export default function (data) {
  const url = `${data.baseUrl}/v1/chat`;
  const headers = { "Content-Type": "application/json" };
  if (data.apiKey) {
    headers["X-API-Key"] = data.apiKey;
  }

  const payload = JSON.stringify({
    query: defaultQuery,
  });

  const res = http.post(url, payload, { headers, tags: { name: "chat" } });

  recordStatus(res);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "has session_id": (r) => {
      if (r.status !== 200) return false;
      try {
        const body = JSON.parse(r.body);
        return typeof body.session_id === "string" && body.session_id.length > 0;
      } catch (e) {
        return false;
      }
    },
    "has answer": (r) => {
      if (r.status !== 200) return false;
      try {
        const body = JSON.parse(r.body);
        return typeof body.answer === "string";
      } catch (e) {
        return false;
      }
    },
  });

  // Arrival-rate executors control pacing; optional tiny pause for VU stability
  sleep(0.05);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics || {};
  const req = m.http_reqs?.values?.count ?? 0;
  const failed = m.http_req_failed?.values?.rate;
  const dur = m.http_req_duration?.values;
  const s200 = m.status_200?.values?.count;
  const s429 = m.status_429?.values?.count;
  const lines = [
    "",
    "========== k6 /v1/chat summary ==========",
    `  scenario: ${scenario}`,
    `  http_reqs: ${req}`,
    `  http_req_failed rate: ${failed != null ? (failed * 100).toFixed(2) + "%" : "n/a"}`,
    `  status 200 count: ${s200 ?? "n/a"}`,
    `  status 429 count: ${s429 ?? "n/a"}`,
  ];
  if (dur) {
    lines.push(
      `  http_req_duration avg: ${dur.avg?.toFixed(2) ?? "n/a"} ms`,
      `  http_req_duration p(95): ${dur["p(95)"]?.toFixed(2) ?? "n/a"} ms`,
    );
  }
  lines.push("=========================================", "");
  return lines.join("\n");
}
