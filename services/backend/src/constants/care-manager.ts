/**
 * Pay-per-session fee for a postpartum counsellor, in rupees.
 *
 * Only the seed value: the live figure lives on each `care_managers` document so a rate
 * can be changed — or made to differ between counsellors — without a release. This
 * constant is what the schema defaults to and what the backfill migration writes.
 */
export const CARE_MANAGER_DEFAULT_REMUNERATION = 99;
