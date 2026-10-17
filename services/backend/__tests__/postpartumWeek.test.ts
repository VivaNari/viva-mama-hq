import {
    calculatePostpartumState,
    daysLeftToAnswer,
    isCheckinEligibleWeek,
    istCalendarDaysBetween,
    MAX_CHECKIN_WEEK,
} from "../src/utils/functions/postpartumWeek";

/**
 * The week and the two due-day counters are the contract the whole check-in flow rests
 * on, so they are pinned here against a frozen clock.
 *
 * Every value is a pure function of the delivery date — that is what makes the cron
 * idempotent, and it is what these cases exist to protect.
 */

// 09:00 IST on 2026-07-29 (IST is UTC+5:30, so 03:30 UTC).
const NOW = new Date("2026-07-29T03:30:00.000Z");

/** A delivery date `days` before NOW, at an awkward time of day on purpose. */
const deliveredDaysAgo = (days: number): Date => new Date(NOW.getTime() - days * 86_400_000);

describe("calculatePostpartumState — postpartum", () => {
    // [days since delivery, weeks, dayInWeek, previous, upcoming]
    const cases: [number, number, number, number, number][] = [
        [0, 1, 0, 0, 0], // delivery day: week 1, and a check-in opens
        [1, 1, 1, 1, 6],
        [2, 1, 2, 2, 5],
        [3, 1, 3, 3, 4],
        [6, 1, 6, 6, 1], // last day of week 1
        [7, 2, 0, 0, 0], // week 2 opens
        [8, 2, 1, 1, 6],
        [13, 2, 6, 6, 1],
        [14, 3, 0, 0, 0],
        [15, 3, 1, 1, 6], // the example from the brief
        [70, 11, 0, 0, 0],
    ];

    it.each(cases)(
        "%i days postpartum -> week %i day %i (previous %i, upcoming %i)",
        (daysSince, weeks, days, previous, upcoming) => {
            const state = calculatePostpartumState(deliveredDaysAgo(daysSince), NOW);

            expect(state.mode).toBe("postpartum");
            expect(state.weeks).toBe(weeks);
            expect(state.days).toBe(days);
            expect(state.previousCheckinDueDays).toBe(previous);
            expect(state.upcomingCheckinDueDays).toBe(upcoming);
        },
    );

    it("keeps the two counters complementary", () => {
        for (let daysSince = 0; daysSince <= 60; daysSince++) {
            const state = calculatePostpartumState(deliveredDaysAgo(daysSince), NOW);
            const { previousCheckinDueDays: previous, upcomingCheckinDueDays: upcoming } = state;

            // Both read 0 on opening day; every other day of the week they sum to 7.
            // This is the invariant that makes "days left" derivable without storing it.
            if (state.days === 0) {
                expect(previous).toBe(0);
                expect(upcoming).toBe(0);
            } else {
                expect(previous + upcoming).toBe(7);
            }

            // Whole numbers only. These used to be decimals (0.6 meaning six days),
            // which the app rendered verbatim as "0.6 days before your check-in".
            expect(Number.isInteger(previous)).toBe(true);
            expect(Number.isInteger(upcoming)).toBe(true);
        }
    });

    it("gives the whole remaining week to answer an open check-in", () => {
        expect(daysLeftToAnswer(calculatePostpartumState(deliveredDaysAgo(0), NOW))).toBe(7);
        expect(daysLeftToAnswer(calculatePostpartumState(deliveredDaysAgo(3), NOW))).toBe(4);
        expect(daysLeftToAnswer(calculatePostpartumState(deliveredDaysAgo(6), NOW))).toBe(1);
    });
});

describe("calculatePostpartumState — pregnancy", () => {
    const dueInDays = (days: number): Date => new Date(NOW.getTime() + days * 86_400_000);

    it("reports gestational age and weeks remaining", () => {
        // 40 days out => 240 gestational days => 34w 2d, 6 weeks to go.
        const state = calculatePostpartumState(dueInDays(40), NOW);

        expect(state.mode).toBe("pregnancy");
        expect(state.weeks).toBe(34);
        expect(state.days).toBe(2);
        expect(state.npWeeksRemaining).toBe(6);
    });

    it("never schedules a check-in before delivery", () => {
        const state = calculatePostpartumState(dueInDays(40), NOW);

        expect(state.previousCheckinDueDays).toBe(0);
        expect(state.upcomingCheckinDueDays).toBe(0);
        expect(isCheckinEligibleWeek(state)).toBe(false);
    });

    it("clamps a delivery date beyond full term instead of going negative", () => {
        // 300 days out is past the 280-day term; the old implementation returned
        // negative gestational weeks here.
        const state = calculatePostpartumState(dueInDays(300), NOW);

        expect(state.weeks).toBe(0);
        expect(state.days).toBe(0);
        expect(state.npWeeksRemaining).toBe(43);
    });

    it("treats the delivery date itself as postpartum, not pregnant", () => {
        const state = calculatePostpartumState(NOW, NOW);

        expect(state.mode).toBe("postpartum");
        expect(state.weeks).toBe(1);
        expect(state.npWeeksRemaining).toBe(0);
    });
});

describe("IST day boundaries", () => {
    it("rolls the day at 18:30 UTC, not at UTC midnight", () => {
        const delivery = new Date("2026-07-01T00:00:00.000Z");

        // 18:29 UTC on the 28th is still the 28th in IST.
        expect(istCalendarDaysBetween(delivery, new Date("2026-07-28T18:29:00.000Z"))).toBe(27);
        // 18:30 UTC is already the 29th in IST.
        expect(istCalendarDaysBetween(delivery, new Date("2026-07-28T18:30:00.000Z"))).toBe(28);
    });

    it("ignores the delivery date's time of day", () => {
        // A date stored at UTC midnight and one stored at 18:00 UTC fall on the same IST
        // calendar day, so they must produce the same week.
        const midnight = calculatePostpartumState(new Date("2026-07-15T00:00:00.000Z"), NOW);
        const evening = calculatePostpartumState(new Date("2026-07-15T17:00:00.000Z"), NOW);

        expect(evening.weeks).toBe(midnight.weeks);
        expect(evening.days).toBe(midnight.days);
    });
});

describe("isCheckinEligibleWeek", () => {
    it("stops at the same ceiling the start endpoint enforces", () => {
        const lastWeek = calculatePostpartumState(
            deliveredDaysAgo((MAX_CHECKIN_WEEK - 1) * 7),
            NOW,
        );
        const pastCeiling = calculatePostpartumState(deliveredDaysAgo(MAX_CHECKIN_WEEK * 7), NOW);

        expect(lastWeek.weeks).toBe(MAX_CHECKIN_WEEK);
        expect(isCheckinEligibleWeek(lastWeek)).toBe(true);

        expect(pastCeiling.weeks).toBe(MAX_CHECKIN_WEEK + 1);
        expect(isCheckinEligibleWeek(pastCeiling)).toBe(false);
    });
});
