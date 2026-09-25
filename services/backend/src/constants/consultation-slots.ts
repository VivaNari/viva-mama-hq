/**
 * The three preferred time windows a patient can pick when booking a consultation.
 *
 * The patient picks a ~3-hour window, not an exact time — the coordinator agrees the
 * real 30-minute start with the doctor or care manager afterwards, and it lands on the
 * consultation as `meeting_confirmed_at`. Storing the enum rather than the label keeps
 * display text out of the database, which matters because the app translates it.
 *
 * All windows are IST.
 */
export enum EPreferredSlot {
    MORNING = "MORNING",
    AFTERNOON = "AFTERNOON",
    EVENING = "EVENING",
}

/**
 * English labels, used only where the server itself renders the slot — currently just
 * the WhatsApp templates, which are English-only. The app translates the enum and never
 * reads these.
 */
export const PREFERRED_SLOT_LABELS: Record<EPreferredSlot, string> = {
    [EPreferredSlot.MORNING]: "9:00 AM – 11:59 AM",
    [EPreferredSlot.AFTERNOON]: "12:00 PM – 2:59 PM",
    [EPreferredSlot.EVENING]: "3:00 PM – 6:00 PM",
};

/**
 * Window bounds as minutes past IST midnight. Used to check that a manually confirmed
 * time actually falls inside the slot the patient booked — the one guard that catches a
 * mistyped confirmation before the patient sees it.
 */
export const PREFERRED_SLOT_BOUNDS: Record<
    EPreferredSlot,
    { startMinutes: number; endMinutes: number }
> = {
    [EPreferredSlot.MORNING]: { startMinutes: 9 * 60, endMinutes: 12 * 60 },
    [EPreferredSlot.AFTERNOON]: { startMinutes: 12 * 60, endMinutes: 15 * 60 },
    [EPreferredSlot.EVENING]: { startMinutes: 15 * 60, endMinutes: 18 * 60 },
};

/** The Join button unlocks this many minutes before the confirmed start. */
export const JOIN_UNLOCK_LEAD_MINUTES = 5;

/**
 * How long after the confirmed start the Join button stays live. Generous on purpose: a
 * doctor running late must not leave the patient holding a dead button.
 */
export const JOIN_WINDOW_GRACE_MINUTES = 45;

/**
 * Minutes before the confirmed start at which to push a reminder. A 5pm call is
 * reminded at 4pm and 4:45pm.
 *
 * Ordered furthest-first only for readability; the job treats them as a set.
 */
export const CONSULTATION_REMINDER_OFFSETS_MINUTES = [60, 15];

/**
 * How late a reminder may still be sent. The job polls every five minutes, so an offset
 * whose moment has just passed is normal and must still fire — but one missed by an hour
 * (a deploy, an outage) must not, or the patient gets "starts in 1 hour" while the call
 * is already underway. Slightly wider than the poll interval to absorb a skipped run.
 */
export const CONSULTATION_REMINDER_TOLERANCE_MINUTES = 12;

/**
 * A slot is only bookable if its start is at least this far away, so the coordinator has
 * a realistic gap to reach the consultant before the window opens. In practice this only
 * ever rules out same-day slots.
 */
export const MIN_BOOKING_LEAD_MINUTES = 120;

/** IST is UTC+5:30 and never observes DST, so a fixed offset is safe here. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * The instant IST midnight falls on, for the IST day containing `now`.
 *
 * Deliberately not `date.setHours(0,0,0,0)`, which resolves against the *server's*
 * timezone. Cloud Run runs UTC, so that would place the boundary 5½ hours late and
 * exclude a consultation booked for today — the banner would vanish on the morning of
 * the call. It passes in local dev only because the machine is already on IST.
 */
export function startOfIstDay(now: Date = new Date()): Date {
    const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);

    return new Date(
        Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, -IST_OFFSET_MINUTES),
    );
}

/**
 * The absolute instant a slot opens on a given consultation date.
 *
 * `date` carries only the day that matters — the time component is whatever the client
 * happened to send, so it is deliberately discarded and rebuilt from the slot bounds in
 * IST. Doing this in UTC arithmetic rather than local `Date` methods keeps the result
 * identical regardless of the server's own timezone.
 */
export function getSlotStartInstant(date: Date, slot: EPreferredSlot): Date {
    const istDate = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
    const year = istDate.getUTCFullYear();
    const month = istDate.getUTCMonth();
    const day = istDate.getUTCDate();

    const startMinutes = PREFERRED_SLOT_BOUNDS[slot].startMinutes;

    return new Date(Date.UTC(year, month, day, 0, startMinutes - IST_OFFSET_MINUTES, 0, 0));
}

/**
 * Whether a slot on a given date is still far enough away to book.
 * Mirrors the identical check the app runs when greying out slot pills — the server
 * repeats it because a client clock can be wrong or the payload hand-crafted.
 */
export function isSlotBookable(date: Date, slot: EPreferredSlot, now: Date = new Date()): boolean {
    const startsAt = getSlotStartInstant(date, slot);
    return startsAt.getTime() - now.getTime() >= MIN_BOOKING_LEAD_MINUTES * 60_000;
}

/** Whether a confirmed 30-minute start actually falls inside the slot the patient booked. */
export function isTimeWithinSlot(confirmedAt: Date, date: Date, slot: EPreferredSlot): boolean {
    const start = getSlotStartInstant(date, slot);
    const { startMinutes, endMinutes } = PREFERRED_SLOT_BOUNDS[slot];
    const end = new Date(start.getTime() + (endMinutes - startMinutes) * 60_000);

    return confirmedAt >= start && confirmedAt <= end;
}
