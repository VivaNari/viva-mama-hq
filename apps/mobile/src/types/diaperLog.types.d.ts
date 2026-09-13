/**
 * Diaper logs as the API returns them.
 *
 * One document per child per calendar day, with the changes in an array — the same
 * day-keyed shape as mood and growth logs. Totals arrive computed so the screen and the
 * dashboard tile do not each count the array their own way.
 */

export type TDiaperKind = "wet" | "dirty" | "both";

export interface IDiaperEntry {
  _id: string;
  kind: TDiaperKind;
  /** ISO instant — the time of the change, not of the request. */
  loggedAt: string;
}

export interface IDiaperTotals {
  wet: number;
  dirty: number;
  both: number;
  total: number;
}

export interface IDiaperLog {
  _id: string;
  childId: string;
  /** "YYYY-MM-DD", IST. */
  loggedOn: string;
  entries: IDiaperEntry[];
  totals: IDiaperTotals;
  createdAt: string;
  updatedAt: string;
}

/** What POST /diaper-logs returns: the entry it created, plus the day's new totals. */
export interface IDiaperEntryCreated {
  childId: string;
  loggedOn: string;
  entry: IDiaperEntry;
  totals: IDiaperTotals;
}
