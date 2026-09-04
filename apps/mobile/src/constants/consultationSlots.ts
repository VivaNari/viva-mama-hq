/**
 * The three preferred windows a patient can pick when booking a consultation.
 *
 * Mirrors EPreferredSlot on the server — the string values cross the wire, so the two
 * enums have to stay in step. Labels are translated, so nothing here holds display text.
 *
 * All windows are IST, which is also the only timezone the product operates in.
 */
export enum PreferredSlot {
  MORNING = "MORNING",
  AFTERNOON = "AFTERNOON",
  EVENING = "EVENING",
}

export const PREFERRED_SLOT_ORDER: PreferredSlot[] = [
  PreferredSlot.MORNING,
  PreferredSlot.AFTERNOON,
  PreferredSlot.EVENING,
];

/** i18n keys, resolved by the caller so this module stays free of the t() dependency. */
export const PREFERRED_SLOT_LABEL_KEYS: Record<PreferredSlot, string> = {
  [PreferredSlot.MORNING]: "consultation.slots.morning",
  [PreferredSlot.AFTERNOON]: "consultation.slots.afternoon",
  [PreferredSlot.EVENING]: "consultation.slots.evening",
};

/** Window starts, as minutes past IST midnight. Must match PREFERRED_SLOT_BOUNDS server-side. */
const SLOT_START_MINUTES: Record<PreferredSlot, number> = {
  [PreferredSlot.MORNING]: 9 * 60,
  [PreferredSlot.AFTERNOON]: 12 * 60,
  [PreferredSlot.EVENING]: 15 * 60,
};

/**
 * A slot must start at least this far out to be bookable, giving the team a realistic
 * gap to reach the consultant before the window opens. Only ever bites on same-day
 * bookings. Kept identical to MIN_BOOKING_LEAD_MINUTES on the server, which re-checks it.
 */
export const MIN_BOOKING_LEAD_MINUTES = 120;

/** IST is UTC+5:30 and never observes DST, so a fixed offset is safe. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * The absolute instant a slot opens on a given date.
 *
 * The date carries only the day that matters — whatever time the picker left on it is
 * discarded and the window rebuilt in IST. Done with UTC arithmetic rather than local
 * Date methods so a device set to a non-IST timezone still greys out the right pills.
 */
export function getSlotStartInstant(date: Date, slot: PreferredSlot): Date {
  const istDate = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);

  return new Date(
    Date.UTC(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
      0,
      SLOT_START_MINUTES[slot] - IST_OFFSET_MINUTES,
      0,
      0,
    ),
  );
}

/**
 * Whether a slot on a given date is still far enough away to book.
 *
 * The server repeats this check — a device clock can be wrong, and a screen left open
 * past the cutoff would otherwise submit a slot that has since closed.
 */
export function isSlotBookable(
  date: Date | null,
  slot: PreferredSlot,
  now: Date = new Date(),
): boolean {
  if (!date) return false;

  const startsAt = getSlotStartInstant(date, slot);
  return startsAt.getTime() - now.getTime() >= MIN_BOOKING_LEAD_MINUTES * 60_000;
}

/** True when no slot on this date is bookable any more — the prompt to pick another day. */
export function isDateFullyBooked(date: Date | null, now: Date = new Date()): boolean {
  if (!date) return false;
  return PREFERRED_SLOT_ORDER.every((slot) => !isSlotBookable(date, slot, now));
}
