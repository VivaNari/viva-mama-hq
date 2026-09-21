import { Types } from "mongoose";

import {
    IWellbeingInput,
    THRESHOLDS,
    evaluate,
} from "../src/services/infant-wellbeing/infant-wellbeing.service";
import { TWellbeingDomain } from "../src/types/infant-wellbeing.types";
import { EVaccinationSector, IChild } from "../src/types/user.types";

/**
 * The wellbeing card's rules.
 *
 * `evaluate` is pure and takes its clock, so none of this touches a database. That is the
 * point of the split: these are threshold decisions a clinician has to be able to read
 * back, and a test that needs a Mongo instance to answer "does a 10-week-old with no
 * milestones logged go amber" is a test nobody consults.
 *
 * NOW is fixed mid-morning deliberately — several of the rules below are about days in
 * progress, and a clock at 09:00 is what catches them.
 */
const NOW = new Date("2026-09-21T09:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const daysAgo = (days: number) => new Date(NOW.getTime() - days * MS_PER_DAY);
const monthsAgo = (months: number) => {
    const date = new Date(NOW);
    date.setUTCMonth(date.getUTCMonth() - months);
    return date;
};

/** IST day key, matching how the service buckets feeds. */
const dayKey = (instant: Date) =>
    new Date(instant.getTime() + 330 * 60000).toISOString().slice(0, 10);

const child = (over: Partial<IChild> = {}): IChild =>
    ({
        _id: new Types.ObjectId() as unknown as IChild["_id"],
        name: "Aarav",
        date_of_birth: monthsAgo(3),
        sex: "Male",
        vaccination_sector: EVaccinationSector.PUBLIC,
        // Well outside the first-run window, so the tiles actually evaluate.
        onboarded_at: daysAgo(30),
        ...over,
    }) as IChild;

/** A healthy-looking baseline; each test spoils exactly the one thing it is about. */
const input = (over: Partial<IWellbeingInput> = {}): IWellbeingInput => ({
    child: child(),
    growthLogs: [
        {
            measuredOn: daysAgo(5),
            percentiles: {
                weight_for_age: { status: "OK", value: 6, key: 3, z: 0.2, zRaw: 0.2, percentile: 58 },
                length_for_age: { status: "OK", value: 61, key: 3, z: 0.1, zRaw: 0.1, percentile: 54 },
                head_circumference_for_age: {
                    status: "OK", value: 40, key: 3, z: 0, zRaw: 0, percentile: 50,
                },
                weight_for_length: {
                    status: "OUT_OF_RANGE", value: null, key: null, z: null, zRaw: null, percentile: null,
                },
            },
        } as unknown as IWellbeingInput["growthLogs"][number],
    ],
    feedsByDay: new Map([
        [dayKey(NOW), 3],
        [dayKey(daysAgo(1)), 8],
    ]),
    hasEverFed: true,
    // Everything the public schedule expects by three months.
    givenVaccineKeys: new Set([
        "bcg", "opv_birth", "hepatitis_b_birth",
        "pentavalent_1", "opv_1", "rotavirus_rvv_1", "pcv_1", "fipv_ipv_1",
        "pentavalent_2", "opv_2", "rotavirus_rvv_2",
        "pentavalent_3", "opv_3", "rotavirus_rvv_3", "pcv_2", "fipv_ipv_2",
    ]),
    achievedMilestoneKeys: new Set<string>(),
    ...over,
});

const tile = (result: ReturnType<typeof evaluate>, domain: TWellbeingDomain) => {
    const found = result.tiles.find((entry) => entry.domain === domain);
    if (!found) throw new Error(`No ${domain} tile`);
    return found;
};

describe("the first-run grace", () => {
    it("says nothing about a child added in the last three days", () => {
        const result = evaluate(input({ child: child({ onboarded_at: daysAgo(1) }) }), NOW);

        expect(result.firstRun).toBe(true);
        expect(result.status).toBe("on_track");
        expect(result.tiles).toHaveLength(0);
    });

    /**
     * A wall of amber is not what a mother who has not logged anything should meet, whatever
     * her baby's age — there is one action there ("start logging"), not four.
     */
    it("says nothing about a child with no logs at all, however old", () => {
        const result = evaluate(
            input({
                child: child({ date_of_birth: monthsAgo(8), onboarded_at: daysAgo(200) }),
                growthLogs: [],
                feedsByDay: new Map(),
                hasEverFed: false,
                givenVaccineKeys: new Set(),
                achievedMilestoneKeys: new Set(),
            }),
            NOW,
        );

        expect(result.firstRun).toBe(true);
    });

    /**
     * `feedsByDay` only ever holds the two days the rules read, so it cannot answer "has
     * she ever logged". Deriving first-run from it told a mother of months' diligent
     * logging to get started, on the strength of one quiet weekend.
     */
    it("does not greet a long-time logger who has had a quiet two days", () => {
        const result = evaluate(
            input({
                growthLogs: [],
                feedsByDay: new Map(),
                hasEverFed: true,
                givenVaccineKeys: new Set(),
                achievedMilestoneKeys: new Set(),
            }),
            NOW,
        );

        expect(result.firstRun).toBe(false);
        expect(result.tiles).toHaveLength(4);
    });

    it("evaluates normally once anything at all has been logged", () => {
        expect(evaluate(input(), NOW).firstRun).toBe(false);
    });
});

describe("growth", () => {
    it("is on track when the measurement is recent and within the reference", () => {
        const result = tile(evaluate(input(), NOW), "growth");

        expect(result.status).toBe("on_track");
        expect(result.reason).toBe("tracked");
        expect(result.valueParams).toEqual({ percentile: 58 });
    });

    it("asks for a fresh weight once the measurement has gone stale", () => {
        const stale = input();
        stale.growthLogs[0]!.measuredOn = daysAgo(60); // under 6m → 45-day window

        const result = tile(evaluate(stale, NOW), "growth");
        expect(result.status).toBe("attention");
        expect(result.reason).toBe("measurement_stale");
    });

    it("allows a older child longer between weights", () => {
        const older = input({ child: child({ date_of_birth: monthsAgo(18) }) });
        older.growthLogs[0]!.measuredOn = daysAgo(60); // over 12m → 135-day window

        expect(tile(evaluate(older, NOW), "growth").status).toBe("on_track");
    });

    /** WHO's own -2 SD. Raised as something to mention, never as a diagnosis. */
    it("raises a weight tracking below the reference", () => {
        const low = input();
        low.growthLogs[0]!.percentiles.weight_for_age.z = -2.4;

        const result = tile(evaluate(low, NOW), "growth");
        expect(result.status).toBe("attention");
        expect(result.reason).toBe("below_reference");
        expect(result.actionKey).toBe("infant.wellbeing.growth.actionDiscuss");
        expect(result.actionParams).toMatchObject({ measure: "weight_for_age" });
    });

    /**
     * The tile's number has to describe the measurement its dot is about.
     *
     * Showing a reassuring weight percentile beside an amber dot that length had triggered
     * read as arbitrary — two measurements talking at once — and was the first thing anyone
     * asked about when the card went on a real phone.
     */
    it("shows the low measurement rather than the reassuring one", () => {
        const shortBaby = input();
        shortBaby.growthLogs[0]!.percentiles.weight_for_age.percentile = 38;
        shortBaby.growthLogs[0]!.percentiles.weight_for_age.z = -0.3;
        shortBaby.growthLogs[0]!.percentiles.length_for_age.percentile = 1;
        shortBaby.growthLogs[0]!.percentiles.length_for_age.z = -2.6;

        const result = tile(evaluate(shortBaby, NOW), "growth");
        expect(result.status).toBe("attention");
        expect(result.actionParams).toMatchObject({ measure: "length_for_age" });
        // The 1st percentile length, not the 38th percentile weight.
        expect(result.valueParams).toEqual({ percentile: 1 });
    });

    /**
     * Measuring a two-week-old's length takes two people and a baby who will not stay
     * straight; a centimetre of error there is half a standard deviation. Below three
     * months that is an amber about a tape measure, not about a child.
     */
    it("does not raise a low length in the newborn weeks", () => {
        const newborn = input({ child: child({ date_of_birth: daysAgo(14) }) });
        newborn.growthLogs[0]!.percentiles.weight_for_age.percentile = 38;
        newborn.growthLogs[0]!.percentiles.length_for_age.z = -2.6;

        const result = tile(evaluate(newborn, NOW), "growth");
        expect(result.status).toBe("on_track");
        // And the tile falls back to the measurement that is fine.
        expect(result.valueParams).toEqual({ percentile: 38 });
    });

    it("raises the same low length once the child is three months", () => {
        const older = input({ child: child({ date_of_birth: monthsAgo(3) }) });
        older.growthLogs[0]!.percentiles.length_for_age.z = -2.6;

        expect(tile(evaluate(older, NOW), "growth").status).toBe("attention");
    });

    /** The floor is on length alone — a scale is a scale at any age. */
    it("raises a low weight even in the newborn weeks", () => {
        const newborn = input({ child: child({ date_of_birth: daysAgo(14) }) });
        newborn.growthLogs[0]!.percentiles.weight_for_age.z = -2.6;

        const result = tile(evaluate(newborn, NOW), "growth");
        expect(result.status).toBe("attention");
        expect(result.actionParams).toMatchObject({ measure: "weight_for_age" });
    });

    /** Weight leads when both are low: it is the more actionable of the two. */
    it("names the weight when both measurements are low", () => {
        const both = input();
        both.growthLogs[0]!.percentiles.weight_for_age.z = -2.2;
        both.growthLogs[0]!.percentiles.length_for_age.z = -2.6;

        expect(tile(evaluate(both, NOW), "growth").actionParams).toMatchObject({
            measure: "weight_for_age",
        });
    });

    /**
     * The deliberate asymmetry. A large baby is not a finding with an action behind it, and
     * "your baby is too big" is a message with a cost of its own.
     */
    it("never raises a weight above the reference", () => {
        const high = input();
        high.growthLogs[0]!.percentiles.weight_for_age.z = 3.4;

        expect(tile(evaluate(high, NOW), "growth").status).toBe("on_track");
    });

    /**
     * "We cannot score this" is not a finding about the baby. A child whose sex is "Other"
     * has no published WHO curve, and that must not read as a warning.
     */
    it("stays on track when the standard does not apply", () => {
        const na = input({ child: child({ sex: "Other" }) });
        for (const key of Object.keys(na.growthLogs[0]!.percentiles)) {
            const indicator = (na.growthLogs[0]!.percentiles as Record<string, unknown>)[key];
            Object.assign(indicator as object, { status: "NOT_APPLICABLE", z: null, percentile: null });
        }

        const result = tile(evaluate(na, NOW), "growth");
        expect(result.status).toBe("on_track");
        expect(result.valueKey).toBe("infant.wellbeing.growth.recorded");
    });
});

describe("feeding", () => {
    it("is on track when yesterday met the floor", () => {
        const result = tile(evaluate(input(), NOW), "feeding");

        expect(result.status).toBe("on_track");
        expect(result.valueParams).toEqual({ count: 3 });
    });

    /**
     * The bug this card is most likely to ship: at 09:00 nobody has fed a baby eight times,
     * and judging the day in progress would paint every morning amber and every evening
     * green. Three feeds so far today is fine; yesterday is what gets judged.
     */
    it("does not judge a day that is still in progress", () => {
        const morning = input({
            feedsByDay: new Map([
                [dayKey(NOW), 2],
                [dayKey(daysAgo(1)), 9],
            ]),
        });

        expect(tile(evaluate(morning, NOW), "feeding").status).toBe("on_track");
    });

    it("raises a completed day that came in under the floor", () => {
        const sparse = input({
            feedsByDay: new Map([
                [dayKey(NOW), 3],
                [dayKey(daysAgo(1)), 4], // 3-month-old floor is 6
            ]),
        });

        const result = tile(evaluate(sparse, NOW), "feeding");
        expect(result.status).toBe("attention");
        expect(result.reason).toBe("feeds_below_floor");
        expect(result.actionParams).toEqual({ count: 4, floor: 6 });
    });

    it("raises two days with nothing logged", () => {
        const result = tile(evaluate(input({ feedsByDay: new Map() }), NOW), "feeding");

        expect(result.status).toBe("attention");
        expect(result.reason).toBe("no_data");
    });

    it("nudges about solids once the child is seven months", () => {
        const older = input({
            child: child({ date_of_birth: monthsAgo(7), solids_started_on: null }),
            feedsByDay: new Map([
                [dayKey(NOW), 2],
                [dayKey(daysAgo(1)), 5],
            ]),
        });

        const result = tile(evaluate(older, NOW), "feeding");
        expect(result.status).toBe("attention");
        expect(result.reason).toBe("solids_not_started");
    });

    it("does not nudge about solids at six months", () => {
        const six = input({
            child: child({ date_of_birth: monthsAgo(6), solids_started_on: null }),
            feedsByDay: new Map([
                [dayKey(NOW), 2],
                [dayKey(daysAgo(1)), 6],
            ]),
        });

        expect(tile(evaluate(six, NOW), "feeding").status).toBe("on_track");
    });
});

describe("vaccines", () => {
    it("is on track when everything due has been logged", () => {
        const result = tile(evaluate(input(), NOW), "vaccines");

        expect(result.status).toBe("on_track");
        expect(result.valueKey).toBe("infant.wellbeing.vaccines.next");
    });

    it("counts the doses overdue, not the visits", () => {
        const behind = input({
            givenVaccineKeys: new Set(["bcg", "opv_birth", "hepatitis_b_birth"]),
        });

        const result = tile(evaluate(behind, NOW), "vaccines");
        expect(result.status).toBe("attention");
        expect(result.reason).toBe("vaccines_overdue");
        // The 6-week visit's five doses plus the 10-week visit's three. The 14-week visit
        // falls at 98 days and this baby is 92 days old, so it is not yet due and is not
        // counted against her.
        expect(result.actionParams?.count).toBe(8);
    });

    /**
     * A clinic appointment is not a same-day thing, and `hasVaccinationVisitBecomeDue` flips
     * true the morning the window opens. A mother must not be told she is behind on her
     * baby's six-week birthday.
     */
    it("holds off for the grace period after a visit comes due", () => {
        const justTurnedSix = input({
            child: child({ date_of_birth: daysAgo(6 * 7 + 1) }),
            givenVaccineKeys: new Set(["bcg", "opv_birth", "hepatitis_b_birth"]),
            growthLogs: [],
        });

        expect(tile(evaluate(justTurnedSix, NOW), "vaccines").status).toBe("on_track");
    });

    /**
     * The grace suppresses the amber; it must not hide the visit. Skipping the due-but-in-
     * grace visit entirely sent a six-week-old's mother "Due 10 weeks" while the six-week
     * doses sat unlogged in front of her — worse than saying nothing.
     */
    it("still names the visit that is due while it is inside the grace period", () => {
        const justTurnedSix = input({
            child: child({ date_of_birth: daysAgo(6 * 7 + 1) }),
            givenVaccineKeys: new Set(["bcg", "opv_birth", "hepatitis_b_birth"]),
            growthLogs: [],
        });

        const result = tile(evaluate(justTurnedSix, NOW), "vaccines");
        expect(result.status).toBe("on_track");
        expect(result.valueParams).toEqual({ visit: "6w" });
    });

    /**
     * No date of birth means no schedule to compare against. "Up to date" there would be
     * reassurance invented out of missing information.
     */
    it("asks for a date of birth rather than claiming to be up to date without one", () => {
        const noDob = input({
            child: child({ date_of_birth: undefined }),
            givenVaccineKeys: new Set(),
        });

        const result = tile(evaluate(noDob, NOW), "vaccines");
        expect(result.status).toBe("attention");
        expect(result.reason).toBe("no_data");
        expect(result.actionKey).toBe("infant.wellbeing.vaccines.actionNoDob");
    });

    it("raises them once the grace period has run out", () => {
        const lapsed = input({
            child: child({ date_of_birth: daysAgo(6 * 7 + THRESHOLDS.vaccineGraceDays + 1) }),
            givenVaccineKeys: new Set(["bcg", "opv_birth", "hepatitis_b_birth"]),
            growthLogs: [],
        });

        expect(tile(evaluate(lapsed, NOW), "vaccines").status).toBe("attention");
    });

    it("reads the private schedule for a private-sector child", () => {
        const private_ = input({
            child: child({
                date_of_birth: monthsAgo(3),
                vaccination_sector: EVaccinationSector.PRIVATE,
            }),
        });

        // The public doses above do not satisfy the IAP schedule's DTwP/Hib/IPV rows.
        expect(tile(evaluate(private_, NOW), "vaccines").status).toBe("attention");
    });
});

describe("milestones", () => {
    /**
     * Judged on the band's upper bound. A three-month-old is still inside the 2-3 month
     * band, so nothing logged is not yet anything to say.
     */
    it("leaves the band the child is still in alone", () => {
        const result = tile(evaluate(input(), NOW), "milestones");
        expect(result.status).toBe("on_track");
    });

    /**
     * The earliest band on the card starts at two months. Falling back to it for a newborn
     * showed "0 / 6" — six things that read as already failed, none of which has come round.
     */
    it("shows no progress for a child younger than the first band", () => {
        const newborn = input({ child: child({ date_of_birth: daysAgo(14) }) });

        const result = tile(evaluate(newborn, NOW), "milestones");
        expect(result.status).toBe("on_track");
        expect(result.valueKey).toBe("infant.wellbeing.milestones.notYet");
        expect(result.valueParams).toBeUndefined();
    });

    it("raises a band the child has grown past with nothing logged", () => {
        const older = input({
            child: child({ date_of_birth: monthsAgo(5) }),
            achievedMilestoneKeys: new Set<string>(),
        });

        const result = tile(evaluate(older, NOW), "milestones");
        expect(result.status).toBe("attention");
        expect(result.reason).toBe("milestones_unlogged");
    });
});

describe("the overall status", () => {
    it("is on track only when every tile is", () => {
        const result = evaluate(input(), NOW);

        expect(result.status).toBe("on_track");
        expect(result.summaryKey).toBe("infant.wellbeing.summary.onTrack");
        expect(result.tiles).toHaveLength(4);
    });

    /**
     * Worst-of, never an average: a well-tracked weight must not cancel out overdue
     * vaccines. Averaging is designed to hide outliers, and the outlier is the whole point.
     */
    it("takes the worst tile rather than a blend", () => {
        const result = evaluate(
            input({ givenVaccineKeys: new Set(["bcg", "opv_birth", "hepatitis_b_birth"]) }),
            NOW,
        );

        expect(result.status).toBe("attention");
        expect(result.summaryKey).toBe("infant.wellbeing.summary.one.vaccines");
    });

    it("counts the domains when more than one needs attention", () => {
        const result = evaluate(
            input({
                givenVaccineKeys: new Set(),
                feedsByDay: new Map([[dayKey(daysAgo(1)), 1]]),
            }),
            NOW,
        );

        expect(result.summaryKey).toBe("infant.wellbeing.summary.several");
        expect(result.summaryParams).toEqual({ count: 2 });
    });
});
