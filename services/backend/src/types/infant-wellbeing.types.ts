/**
 * The infant dashboard's "Overall wellbeing" card.
 *
 * One status for the child, plus one per domain, derived on read from what the five logs
 * hold. Nothing here is stored: the Viva Score freezes a snapshot because it is the result
 * of a check-in taken at a moment, but this is a live read of logs that change hourly, and
 * a stored copy would be stale the moment a feed is logged.
 *
 * ## What a status means, and what it does not
 *
 * Two states only, and deliberately: `on_track` and `attention`. There is no red. An app
 * that cannot examine a baby should not raise an alarm about one, and a red badge that
 * misfires once is a red badge a mother learns to ignore.
 *
 * More importantly, a status is **not a verdict on the child**. It answers "is there
 * something to do?", never "is this baby healthy?". The two come apart constantly: a baby
 * on the 3rd percentile is a healthy small baby and stays `on_track`, while a baby whose
 * vaccines are a month overdue needs a clinic visit whatever their percentile says. This is
 * what keeps the card on the right side of the policy the rest of the infant code follows
 * — `growthCopy.ts` forbids colour-coding a percentile as good or bad, and
 * `WarningSigns.tsx` forbids anything that reads as an alarm.
 *
 * ## Why copy travels as keys
 *
 * Every field below names an i18n key and the params to interpolate, never a sentence. The
 * server does not know which language the reader wants, and a second server-side render in
 * Hindi is how the two drift apart.
 */

export type TWellbeingStatus = "on_track" | "attention";

/** Which of the four tiles. Also the i18n namespace segment for each. */
export type TWellbeingDomain = "growth" | "feeding" | "vaccines" | "milestones";

/**
 * Why a domain is in the state it is in.
 *
 * Carried so the client can pick copy without re-deriving the rule, and so a test can
 * assert *which* rule fired rather than only that something did — "amber" passing for the
 * wrong reason is the failure mode a status card is most prone to.
 */
export type TWellbeingReason =
    // Shared
    | "no_data"
    // Growth
    | "tracked"
    | "measurement_stale"
    | "below_reference"
    // Feeding
    | "feeds_on_track"
    | "feeds_below_floor"
    | "solids_not_started"
    // Vaccines
    | "vaccines_upToDate"
    | "vaccines_overdue"
    // Milestones
    | "milestones_logged"
    | "milestones_unlogged";

export interface IWellbeingTile {
    domain: TWellbeingDomain;
    status: TWellbeingStatus;
    reason: TWellbeingReason;
    /**
     * The tile's headline value — "25th–50th", "3 today", "Due 6 wk", "2 / 4".
     *
     * Reports the child; the `status` beside it reports whether anything needs doing. The
     * two are independent on purpose (see the header).
     */
    valueKey: string;
    valueParams?: Record<string, string | number>;
    /** What to do about it. Present only when `status` is `attention`. */
    actionKey?: string;
    actionParams?: Record<string, string | number>;
}

export interface IInfantWellbeing {
    childId: string;
    /** Worst-of the tiles, never an average — see `summarise` in the service. */
    status: TWellbeingStatus;
    /**
     * True before the card can fairly say anything: a child added in the last few days, or
     * one with no logs at all. The client renders a "let's get started" state instead of
     * four amber tiles, which is what a mother would otherwise meet on day one.
     */
    firstRun: boolean;
    summaryKey: string;
    summaryParams?: Record<string, string | number>;
    tiles: IWellbeingTile[];
}
