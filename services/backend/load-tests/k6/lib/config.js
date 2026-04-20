/**
 * Shared k6 configuration helpers.
 *
 * Environment:
 * - BASE_URL — API origin (default http://localhost:3000)
 * - VUS — virtual users when not using K6_STAGES (default 5)
 * - DURATION — test length when not using K6_STAGES (default 30s)
 * - K6_STAGES — optional JSON array of { duration, target } for ramping
 */

/**
 * @returns {string} Normalized base URL without trailing slash
 */
export function getBaseUrl() {
    const raw = __ENV.BASE_URL || "http://localhost:3000";
    return raw.replace(/\/$/, "");
}

/**
 * Builds k6 `options` load fields from env (stages take precedence over vus/duration).
 * @returns {{ stages: Array<{ duration: string, target: number }> } | { vus: number, duration: string }}
 */
export function getLoadProfile() {
    const stagesEnv = __ENV.K6_STAGES;
    if (stagesEnv) {
        try {
            const stages = JSON.parse(stagesEnv);
            if (Array.isArray(stages) && stages.length > 0) {
                return { stages };
            }
        } catch {
            console.warn("Invalid K6_STAGES JSON; falling back to VUS/DURATION");
        }
    }
    const vus = parseInt(__ENV.VUS || "5", 10);
    const duration = __ENV.DURATION || "30s";
    return { vus, duration };
}
