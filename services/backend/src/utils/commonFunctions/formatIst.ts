const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * Dates rendered for humans — the coordinator reading a WhatsApp notification, and the
 * ops runbook. Everything the business runs on is IST, so these pin the zone explicitly
 * rather than inheriting whatever the container happens to be set to.
 */

/** e.g. "31 Jul 2026" */
export function formatIstDate(date: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: IST_TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

/** e.g. "28 Jul 2026, 4:12 pm" */
export function formatIstDateTime(date: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: IST_TIME_ZONE,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(date);
}
