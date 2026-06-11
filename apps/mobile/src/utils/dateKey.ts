/**
 * Local-calendar date helpers for the mood log feature.
 * The backend exchanges dates as "YYYY-MM-DD" (interpreted at the IST day
 * boundary), so we always derive the key from the device's local date parts.
 */

/** Format a Date into a local "YYYY-MM-DD" key. */
export const toISODateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Parse a "YYYY-MM-DD" key into a local Date at midnight. */
export const fromISODateKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** True if two dates fall on the same local calendar day. */
export const isSameDay = (a: Date, b: Date): boolean =>
  toISODateKey(a) === toISODateKey(b);

/** A Date at local midnight (strips time-of-day). */
export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
