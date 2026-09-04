import {
    EPreferredSlot,
    MIN_BOOKING_LEAD_MINUTES,
    getSlotStartInstant,
    isSlotBookable,
    isTimeWithinSlot,
    startOfIstDay,
} from "../src/constants/consultation-slots";

/**
 * Slot maths is pure arithmetic over instants, and every bug in it is a patient sitting
 * on a call that never happens. The cases below are the ones that would actually bite:
 * a server in UTC, a date carrying a stray time component, and a confirmed time typed
 * without a timezone.
 */

/** Cloud Run runs UTC, so the suite pins a non-IST zone rather than trusting the host. */
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
    process.env.TZ = "UTC";
});
afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
});

const istLabel = (d: Date) =>
    d.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour12: false });

describe("getSlotStartInstant", () => {
    const date = new Date("2026-07-31T00:00:00+05:30");

    it("anchors each window to its IST start", () => {
        expect(getSlotStartInstant(date, EPreferredSlot.MORNING).toISOString()).toBe(
            "2026-07-31T03:30:00.000Z", // 09:00 IST
        );
        expect(getSlotStartInstant(date, EPreferredSlot.AFTERNOON).toISOString()).toBe(
            "2026-07-31T06:30:00.000Z", // 12:00 IST
        );
        expect(getSlotStartInstant(date, EPreferredSlot.EVENING).toISOString()).toBe(
            "2026-07-31T09:30:00.000Z", // 15:00 IST
        );
    });

    it("ignores whatever time the client left on the date", () => {
        // The picker sends midnight, "now", or anything in between. Only the IST day
        // may influence the result, or a late-evening pick would roll into the next day.
        const lateEvening = new Date("2026-07-31T23:45:00+05:30");
        const earlyMorning = new Date("2026-07-31T00:05:00+05:30");

        expect(getSlotStartInstant(lateEvening, EPreferredSlot.MORNING).toISOString()).toBe(
            getSlotStartInstant(earlyMorning, EPreferredSlot.MORNING).toISOString(),
        );
        expect(istLabel(getSlotStartInstant(lateEvening, EPreferredSlot.MORNING))).toBe(
            "31/07/2026, 09:00:00",
        );
    });

    it("keeps a UTC-midnight date on the same IST day", () => {
        // 2026-07-31T00:00Z is 05:30 IST on the 31st — still the 31st, not the 30th.
        const utcMidnight = new Date("2026-07-31T00:00:00Z");
        expect(istLabel(getSlotStartInstant(utcMidnight, EPreferredSlot.MORNING))).toBe(
            "31/07/2026, 09:00:00",
        );
    });
});

describe("isSlotBookable", () => {
    const today = new Date("2026-07-28T00:00:00+05:30");
    const tomorrow = new Date("2026-07-29T00:00:00+05:30");

    it("closes every same-day window once the lead time has run out", () => {
        const now = new Date("2026-07-28T14:00:00+05:30"); // 2:00 PM IST

        // 09:00 and 12:00 are behind us; 15:00 is only 60 minutes out, inside the
        // two-hour lead the coordinator needs to reach the consultant.
        expect(isSlotBookable(today, EPreferredSlot.MORNING, now)).toBe(false);
        expect(isSlotBookable(today, EPreferredSlot.AFTERNOON, now)).toBe(false);
        expect(isSlotBookable(today, EPreferredSlot.EVENING, now)).toBe(false);
    });

    it("leaves a same-day window open while it is still far enough out", () => {
        const earlyMorning = new Date("2026-07-28T06:00:00+05:30"); // 6:00 AM IST

        expect(isSlotBookable(today, EPreferredSlot.MORNING, earlyMorning)).toBe(true);
        expect(isSlotBookable(today, EPreferredSlot.EVENING, earlyMorning)).toBe(true);
    });

    it("treats the lead-time boundary as inclusive", () => {
        const start = getSlotStartInstant(today, EPreferredSlot.EVENING);
        const exactly = new Date(start.getTime() - MIN_BOOKING_LEAD_MINUTES * 60_000);
        const aMinuteLate = new Date(exactly.getTime() + 60_000);

        expect(isSlotBookable(today, EPreferredSlot.EVENING, exactly)).toBe(true);
        expect(isSlotBookable(today, EPreferredSlot.EVENING, aMinuteLate)).toBe(false);
    });

    it("keeps every window open on a future date", () => {
        const now = new Date("2026-07-28T14:00:00+05:30");

        for (const slot of Object.values(EPreferredSlot)) {
            expect(isSlotBookable(tomorrow, slot, now)).toBe(true);
        }
    });
});

describe("startOfIstDay", () => {
    /**
     * Regression: this was `date.setHours(0,0,0,0)`, which resolves against the server's
     * timezone. On Cloud Run (UTC) that placed the boundary 5½ hours late, so a booking
     * made for today failed the `$gte` filter and the banner vanished on the morning of
     * the call — while passing locally, because dev machines are on IST.
     */
    it("lands on IST midnight regardless of the server timezone", () => {
        const now = new Date("2026-07-31T09:00:00Z"); // 2:30 PM IST
        expect(startOfIstDay(now).toISOString()).toBe("2026-07-30T18:30:00.000Z");
    });

    it("keeps a consultation booked for today inside the window", () => {
        const now = new Date("2026-07-31T09:00:00Z");
        // What the app sends when an IST user picks 31 Jul.
        const bookedForToday = new Date("2026-07-31T00:00:00+05:30");

        expect(bookedForToday >= startOfIstDay(now)).toBe(true);
    });

    it("still excludes yesterday", () => {
        const now = new Date("2026-07-31T09:00:00Z");
        const bookedYesterday = new Date("2026-07-30T00:00:00+05:30");

        expect(bookedYesterday >= startOfIstDay(now)).toBe(false);
    });

    it("holds just after IST midnight, when UTC is still on the previous day", () => {
        // 00:30 IST on 31 Jul is 19:00Z on 30 Jul — the window where a UTC-based
        // boundary and an IST-based one disagree about what "today" means.
        const justAfterMidnightIst = new Date("2026-07-31T00:30:00+05:30");
        const bookedForToday = new Date("2026-07-31T00:00:00+05:30");

        expect(bookedForToday >= startOfIstDay(justAfterMidnightIst)).toBe(true);
    });
});

describe("isTimeWithinSlot", () => {
    const date = new Date("2026-07-31T00:00:00+05:30");

    it("accepts a confirmed time inside the booked window", () => {
        const tenThirty = new Date("2026-07-31T10:30:00+05:30");
        expect(isTimeWithinSlot(tenThirty, date, EPreferredSlot.MORNING)).toBe(true);
    });

    it("rejects a confirmed time from a different window", () => {
        const tenThirty = new Date("2026-07-31T10:30:00+05:30");
        expect(isTimeWithinSlot(tenThirty, date, EPreferredSlot.EVENING)).toBe(false);
    });

    it("catches a time typed without a timezone", () => {
        // The failure this guard exists for: "10:30" entered by hand and parsed as UTC
        // lands at 4:00 PM IST. Without the check the patient's Join button would unlock
        // five and a half hours after the doctor dialled in.
        const parsedAsUtc = new Date("2026-07-31T10:30:00Z");
        expect(isTimeWithinSlot(parsedAsUtc, date, EPreferredSlot.MORNING)).toBe(false);
    });

    it("includes both ends of the window", () => {
        expect(
            isTimeWithinSlot(new Date("2026-07-31T09:00:00+05:30"), date, EPreferredSlot.MORNING),
        ).toBe(true);
        expect(
            isTimeWithinSlot(new Date("2026-07-31T12:00:00+05:30"), date, EPreferredSlot.MORNING),
        ).toBe(true);
        expect(
            isTimeWithinSlot(new Date("2026-07-31T12:01:00+05:30"), date, EPreferredSlot.MORNING),
        ).toBe(false);
    });

    /**
     * Characterising current behaviour, not endorsing it. Since the bounds were moved to
     * 12:00 and 15:00 the windows share their endpoints, and `isTimeWithinSlot` is
     * inclusive at both ends — so noon validates against MORNING *and* AFTERNOON.
     *
     * It also disagrees with PREFERRED_SLOT_LABELS, which reads "9:00 AM – 11:59 AM":
     * a coordinator shown that label can still confirm 12:00 and be accepted. Harmless
     * today because this only ever validates a coordinator's own entry, but if the
     * labels are meant to be authoritative the morning/afternoon ends should become
     * exclusive rather than the test being taught to expect the overlap.
     */
    it("currently accepts a shared boundary for either adjoining window", () => {
        const noon = new Date("2026-07-31T12:00:00+05:30");
        expect(isTimeWithinSlot(noon, date, EPreferredSlot.MORNING)).toBe(true);
        expect(isTimeWithinSlot(noon, date, EPreferredSlot.AFTERNOON)).toBe(true);

        const three = new Date("2026-07-31T15:00:00+05:30");
        expect(isTimeWithinSlot(three, date, EPreferredSlot.AFTERNOON)).toBe(true);
        expect(isTimeWithinSlot(three, date, EPreferredSlot.EVENING)).toBe(true);
    });
});
