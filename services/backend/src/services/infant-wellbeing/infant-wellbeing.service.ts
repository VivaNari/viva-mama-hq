import { bandForZ } from "@vivamama/growth-standards";
import {
    MILESTONE_BAND_WINDOWS,
    VACCINATION_SCHEDULE_WINDOWS,
    VaccinationSector,
} from "@vivamama/infant-schedules";

import feedingLogModel from "../../models/feeding-log.model";
import growthLogModel from "../../models/growth-log.model";
import milestoneLogModel from "../../models/milestone-log.model";
import vaccinationLogModel from "../../models/vaccination-log.model";
import {
    IInfantWellbeing,
    IWellbeingTile,
    TWellbeingStatus,
} from "../../types/infant-wellbeing.types";
import { IGrowthLog } from "../../types/growth-log.types";
import { EVaccinationSector, IChild } from "../../types/user.types";
import {
    getAgeInMonths,
    hasVaccinationVisitBecomeDue,
    vaccinationVisitDueDate,
} from "../../utils/functions/babyAgeWindow";
import { ChildNotFoundError, getOwnedChild } from "../childs/child-ownership";
import { getISTCalendarDate } from "../date/date.service";

export { ChildNotFoundError };

/**
 * Is there anything to do about this baby today?
 *
 * Four domains, each reduced to `on_track` or `attention`, plus a worst-of overall. The
 * reasoning behind every threshold below is in the doc comment above it; the short version
 * is that each one is set at the point where a *parent has an action*, not at the point
 * where a clinician would raise an eyebrow. This is a dashboard card, not a screening tool.
 *
 * ## Structure
 *
 * Split the way `ScoreEngineService` is split: {@link forChild} does the reads, {@link
 * evaluate} is pure and takes a clock. Every threshold lives in {@link THRESHOLDS} rather
 * than inline, so the numbers a clinician has to sign off are in one place and a test can
 * read them back.
 *
 * ## Not clinically reviewed
 *
 * Same standing as the IAP schedule in `scripts/generate-vaccination-schedule.mjs`: the
 * cut-offs are drafted against published guidance but have not been signed off. The one
 * exception is the growth cut-off, which is WHO's own -2 SD and is applied through the
 * `growth-standards` package's existing bands rather than re-derived here.
 */

export const THRESHOLDS = {
    /**
     * How long a weight stays current, by age in months.
     *
     * Scaled because a newborn changes week to week and a toddler does not. Deliberately
     * looser than any clinic would advise: the cost of being wrong here is nagging a mother
     * who *did* get her baby weighed and did not open the app, which is the common case.
     */
    growthFreshnessDays: [
        { untilMonths: 6, days: 45 },
        { untilMonths: 12, days: 75 },
        { untilMonths: Infinity, days: 135 },
    ],

    /**
     * The age from which a low length-for-age can raise attention.
     *
     * Weight has no such floor — a scale is a scale at any age. Length does, because
     * measuring a newborn is the least reliable reading in the whole log: it takes two
     * people and a stretched-out baby, and roughly a centimetre of error moves a
     * two-week-old by half a standard deviation. Below three months that noise produces
     * ambers about a tape measure rather than about a child, and an amber that misfires
     * once is an amber a mother stops reading.
     *
     * Length still appears on the tile and the chart throughout; this governs only whether
     * it can turn the dot.
     */
    lengthTriggersFromMonths: 3,

    /**
     * Feeds expected in a full day, by age in months.
     *
     * Anchored on the standard 8-12 feeds per 24 hours for a newborn, set at the bottom of
     * that range and dropping as solids take over. At the low end on purpose — a day at the
     * floor is unremarkable, and a card that flags an ordinary day teaches a mother to
     * ignore it.
     */
    feedFloorPerDay: [
        { untilMonths: 1, feeds: 8 },
        { untilMonths: 6, feeds: 6 },
        { untilMonths: Infinity, feeds: 4 },
    ],

    /**
     * When not having started solids becomes worth a nudge.
     *
     * Complementary feeding is advised from six completed months. Seven rather than six
     * because the boundary is guidance rather than a deadline, and a mother one week past
     * it has not done anything wrong.
     */
    solidsNudgeMonths: 7,

    /**
     * Grace after a vaccination visit's window opens, before unlogged doses go amber.
     *
     * `hasVaccinationVisitBecomeDue` flips true on the morning the window opens, and a
     * clinic appointment is not a same-day thing. Two weeks lets a family get there.
     */
    vaccineGraceDays: 14,
} as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** The first band whose `untilMonths` the age falls under. Ages are floored, never null. */
const forAge = <T extends { untilMonths: number }>(bands: readonly T[], months: number): T =>
    bands.find((band) => months < band.untilMonths) ?? bands[bands.length - 1]!;

export interface IWellbeingInput {
    child: IChild;
    /** Newest first. Only the most recent scored measurement is read. */
    growthLogs: Pick<IGrowthLog, "measuredOn" | "percentiles">[];
    /** Feed counts keyed on the IST day they fall in, "YYYY-MM-DD". Two days only. */
    feedsByDay: Map<string, number>;
    /**
     * Whether this child has ever had a feed logged, as opposed to in the last two days.
     *
     * Separate from `feedsByDay` because that map is deliberately bounded to the window the
     * rules read. Deriving "has she ever logged anything" from it told a mother of three
     * months' diligent logging to get started, on the strength of one quiet weekend.
     */
    hasEverFed: boolean;
    givenVaccineKeys: Set<string>;
    achievedMilestoneKeys: Set<string>;
}

const istDayKey = (instant: Date): string =>
    getISTCalendarDate(instant).toISOString().slice(0, 10);

const sectorOf = (child: IChild): VaccinationSector =>
    child.vaccination_sector === EVaccinationSector.PRIVATE ? "private" : "public";

/**
 * Growth: is the measurement current, and is the child tracking below the reference?
 *
 * Two asymmetries worth naming, because both are deliberate:
 *
 * A band above the reference never raises attention. WHO's +2 SD exists and this ignores
 * it — missing faltering growth is a real harm with a real action behind it, whereas
 * telling a mother her baby is large is a judgement with no action attached and a cost of
 * its own.
 *
 * `OUT_OF_RANGE`, `MISSING_INPUT` and `NOT_APPLICABLE` are not attention either. They mean
 * the WHO table does not apply to this measurement — a newborn is below the weight-for-
 * length table's 45 cm floor, and a child whose sex is "Other" has no published curve —
 * and "we cannot score this" is not a finding about the baby.
 */
const growthTile = (input: IWellbeingInput, ageMonths: number, now: Date): IWellbeingTile => {
    const latest = input.growthLogs[0];

    if (!latest) {
        return {
            domain: "growth",
            status: "attention",
            reason: "no_data",
            valueKey: "infant.wellbeing.growth.none",
            actionKey: "infant.wellbeing.growth.actionFirst",
        };
    }

    // Only the low side, and only where the table applies. `below` is WHO's -2 SD.
    const isLow = (result?: { status: string; z: number | null }): boolean => {
        if (!result || result.status !== "OK" || result.z === null) return false;
        const band = bandForZ(result.z);
        return band === "below" || band === "far_below";
    };

    const scored = (["weight_for_age", "length_for_age"] as const).filter(
        (indicator) => latest.percentiles?.[indicator]?.status === "OK",
    );

    // Length is held back in the newborn weeks — see `lengthTriggersFromMonths`. It stays
    // in `scored`, so a day when only a length was taken still has something to show.
    const canTrigger = (indicator: (typeof scored)[number]): boolean =>
        indicator !== "length_for_age" || ageMonths >= THRESHOLDS.lengthTriggersFromMonths;

    const low = scored.filter(
        (indicator) => canTrigger(indicator) && isLow(latest.percentiles[indicator]),
    );

    /**
     * Which measurement the tile's number describes.
     *
     * The low one when there is one, otherwise weight — and that order matters. Showing
     * weight's reassuring 38th beside an amber dot that length had triggered was a tile
     * whose number and colour described different measurements, which reads as arbitrary.
     * The number now always describes the thing the dot is about.
     */
    const headlineKey = low[0] ?? scored[0];
    const headline = headlineKey ? latest.percentiles[headlineKey] : null;

    const value: Pick<IWellbeingTile, "valueKey" | "valueParams"> =
        headline?.percentile != null
            ? {
                  valueKey: "infant.wellbeing.growth.percentile",
                  valueParams: { percentile: Math.round(headline.percentile) },
              }
            : { valueKey: "infant.wellbeing.growth.recorded" };

    const staleAfter = forAge(THRESHOLDS.growthFreshnessDays, ageMonths).days;
    const daysSince = Math.floor(
        (getISTCalendarDate(now).getTime() - getISTCalendarDate(latest.measuredOn).getTime()) /
            MS_PER_DAY,
    );

    if (daysSince > staleAfter) {
        return {
            domain: "growth",
            ...value,
            status: "attention",
            reason: "measurement_stale",
            actionKey: "infant.wellbeing.growth.actionStale",
            actionParams: { days: daysSince },
        };
    }

    if (low.length > 0) {
        return {
            domain: "growth",
            ...value,
            status: "attention",
            reason: "below_reference",
            // Phrased as something to raise, not as a diagnosis — the app reports.
            actionKey: "infant.wellbeing.growth.actionDiscuss",
            // Names the measurement. "Her last measurement was low" left a mother guessing
            // which of the two the app meant, with the other one showing on the tile.
            actionParams: { measure: low[0]! },
        };
    }

    return { domain: "growth", ...value, status: "on_track", reason: "tracked" };
};

/**
 * Feeding: did a full day meet the floor, and have solids started when they should have?
 *
 * The count is judged on **yesterday**, never on today. Today is a day in progress: at
 * 08:00 no baby has had eight feeds, and judging it would paint the card amber every
 * morning and green by evening. Today's count is still what the tile *displays*, because
 * that is the number a mother is actually watching.
 */
const feedingTile = (input: IWellbeingInput, ageMonths: number, now: Date): IWellbeingTile => {
    const today = istDayKey(now);
    const yesterday = istDayKey(new Date(now.getTime() - MS_PER_DAY));

    const todayCount = input.feedsByDay.get(today) ?? 0;
    const yesterdayCount = input.feedsByDay.get(yesterday) ?? 0;

    const value = {
        valueKey: "infant.wellbeing.feeding.today",
        valueParams: { count: todayCount },
    };

    if (todayCount === 0 && yesterdayCount === 0) {
        return {
            domain: "feeding",
            ...value,
            status: "attention",
            reason: "no_data",
            actionKey: "infant.wellbeing.feeding.actionNone",
        };
    }

    const floor = forAge(THRESHOLDS.feedFloorPerDay, ageMonths).feeds;

    // Yesterday only, and only once there is a yesterday to judge.
    if (yesterdayCount > 0 && yesterdayCount < floor) {
        return {
            domain: "feeding",
            ...value,
            status: "attention",
            reason: "feeds_below_floor",
            actionKey: "infant.wellbeing.feeding.actionFewer",
            actionParams: { count: yesterdayCount, floor },
        };
    }

    if (ageMonths >= THRESHOLDS.solidsNudgeMonths && !input.child.solids_started_on) {
        return {
            domain: "feeding",
            ...value,
            status: "attention",
            reason: "solids_not_started",
            actionKey: "infant.wellbeing.feeding.actionSolids",
        };
    }

    return { domain: "feeding", ...value, status: "on_track", reason: "feeds_on_track" };
};

/**
 * Vaccines: is anything whose window opened (and whose grace has run out) still unlogged?
 *
 * Counts doses rather than visits, because "3 doses overdue" is what a mother repeats to
 * the clinic. Reuses the schedule and the due-date maths the reminder cron already runs on,
 * so the card and the notification can never disagree about what is due.
 */
const vaccineTile = (input: IWellbeingInput, now: Date): IWellbeingTile => {
    const { child, givenVaccineKeys } = input;

    // Without a date of birth there is no schedule to compare against. Saying "up to date"
    // here would be inventing reassurance out of missing information.
    if (!child.date_of_birth) {
        return {
            domain: "vaccines",
            status: "attention",
            reason: "no_data",
            valueKey: "infant.wellbeing.vaccines.unknown",
            actionKey: "infant.wellbeing.vaccines.actionNoDob",
        };
    }

    const visits = VACCINATION_SCHEDULE_WINDOWS[sectorOf(child)];
    const graceMs = THRESHOLDS.vaccineGraceDays * MS_PER_DAY;

    let overdueDoses = 0;
    let earliestOverdueVisit: { key: string; dueDate: Date } | null = null;
    let inGraceVisit: { key: string; dueDate: Date } | null = null;
    let nextVisit: { key: string; dueDate: Date } | null = null;

    for (const visit of visits) {
        const unlogged = visit.doseKeys.filter((key) => !givenVaccineKeys.has(key)).length;
        if (unlogged === 0) continue;

        const dueDate = vaccinationVisitDueDate(child.date_of_birth, visit.due);
        if (!dueDate) continue;

        if (!hasVaccinationVisitBecomeDue(child.date_of_birth, visit.due, now)) {
            // The soonest one still ahead of us — what the tile shows when all is well.
            if (!nextVisit || dueDate < nextVisit.dueDate) {
                nextVisit = { key: visit.key, dueDate };
            }
            continue;
        }

        if (getISTCalendarDate(now).getTime() - dueDate.getTime() < graceMs) {
            // Due now, but still inside the grace period. Not overdue — and emphatically
            // not skipped: leaving it out sent a six-week-old's mother "Due 10 weeks"
            // while the six-week doses sat unlogged in front of her. The grace suppresses
            // the amber, it does not hide the visit.
            if (!inGraceVisit || dueDate < inGraceVisit.dueDate) {
                inGraceVisit = { key: visit.key, dueDate };
            }
            continue;
        }

        overdueDoses += unlogged;
        if (!earliestOverdueVisit || dueDate < earliestOverdueVisit.dueDate) {
            earliestOverdueVisit = { key: visit.key, dueDate };
        }
    }

    if (overdueDoses > 0 && earliestOverdueVisit) {
        return {
            domain: "vaccines",
            status: "attention",
            reason: "vaccines_overdue",
            valueKey: "infant.wellbeing.vaccines.overdue",
            valueParams: { count: overdueDoses },
            actionKey: "infant.wellbeing.vaccines.actionOverdue",
            actionParams: { count: overdueDoses, visit: earliestOverdueVisit.key },
        };
    }

    // A visit that is due right now outranks one that is merely coming.
    const upcoming = inGraceVisit ?? nextVisit;

    if (upcoming) {
        return {
            domain: "vaccines",
            status: "on_track",
            reason: "vaccines_upToDate",
            valueKey: "infant.wellbeing.vaccines.next",
            valueParams: { visit: upcoming.key },
        };
    }

    // Nothing unlogged anywhere on the schedule.
    return {
        domain: "vaccines",
        status: "on_track",
        reason: "vaccines_upToDate",
        valueKey: "infant.wellbeing.vaccines.allDone",
    };
};

/**
 * Milestones: is a band the child has grown *past* still incomplete?
 *
 * Judged on the band's upper bound, not its lower. A 2-3 month band means "by three
 * months", so a ten-week-old with nothing logged is not behind — they are still in it.
 *
 * The copy this drives has to stay about the record rather than the child, because the data
 * cannot tell them apart: the log stores achievements only, so a missing row means "not
 * logged", which is indistinguishable from "not yet doing it". "2 of 4 logged" is honest;
 * "behind on milestones" would not be.
 */
const milestoneTile = (input: IWellbeingInput, ageMonths: number): IWellbeingTile => {
    const { achievedMilestoneKeys } = input;

    // The band the child is in now, for the tile's "2 / 4" — the last one they have reached.
    //
    // No fallback to the first band when none has been reached: the card's earliest bands
    // start at two months, and showing a two-week-old "0 / 6" reads as six things already
    // failed when in fact none of them has come round yet.
    const current = [...MILESTONE_BAND_WINDOWS]
        .filter((band) => ageMonths >= band.ageMonths.from)
        .sort((a, b) => a.ageMonths.from - b.ageMonths.from)
        .pop();

    const value = current
        ? {
              valueKey: "infant.wellbeing.milestones.progress",
              valueParams: {
                  logged: current.milestoneKeys.filter((key) => achievedMilestoneKeys.has(key))
                      .length,
                  total: current.milestoneKeys.length,
              },
          }
        : { valueKey: "infant.wellbeing.milestones.notYet" };

    const elapsed = MILESTONE_BAND_WINDOWS.filter((band) => ageMonths > band.ageMonths.to);
    const incomplete = elapsed.filter((band) =>
        band.milestoneKeys.some((key) => !achievedMilestoneKeys.has(key)),
    );

    if (incomplete.length > 0) {
        const band = incomplete[0]!;
        return {
            domain: "milestones",
            ...value,
            status: "attention",
            reason: "milestones_unlogged",
            actionKey: "infant.wellbeing.milestones.actionUnlogged",
            actionParams: {
                band: band.key,
                count: band.milestoneKeys.filter((key) => !achievedMilestoneKeys.has(key)).length,
            },
        };
    }

    return { domain: "milestones", ...value, status: "on_track", reason: "milestones_logged" };
};

/**
 * The card's one-line summary.
 *
 * Worst-of rather than an average, the same call `findWeakestCategory` makes in the score
 * engine. Averaging would let a well-tracked weight cancel out three overdue vaccines,
 * which is precisely backwards: the whole point of the card is to surface the thing that
 * needs doing, and a mean is designed to hide outliers.
 *
 * The summary names how many domains need attention rather than trying to compose a
 * sentence out of them server-side; the tiles carry their own actions, and a generated
 * paragraph in two languages is a translation problem with no upside.
 */
const summarise = (
    tiles: IWellbeingTile[],
): Pick<IInfantWellbeing, "status" | "summaryKey" | "summaryParams"> => {
    const needing = tiles.filter((tile) => tile.status === "attention");

    if (needing.length === 0) {
        return { status: "on_track", summaryKey: "infant.wellbeing.summary.onTrack" };
    }

    if (needing.length === 1) {
        return {
            status: "attention",
            summaryKey: `infant.wellbeing.summary.one.${needing[0]!.domain}`,
        };
    }

    return {
        status: "attention",
        summaryKey: "infant.wellbeing.summary.several",
        summaryParams: { count: needing.length },
    };
};

/**
 * Pure, clock-injectable. Everything above is reachable from here with no database.
 *
 * `now` is a parameter rather than read inside, the same lesson `ScoreEngineService`
 * records about `week`: a status that depends on the wall clock and cannot be pinned is a
 * status nobody can write a test for.
 */
export const evaluate = (input: IWellbeingInput, now: Date = new Date()): IInfantWellbeing => {
    const { child } = input;
    const childId = String(child._id ?? "");
    const ageMonths = getAgeInMonths(child.date_of_birth, now) ?? 0;

    /**
     * Before the card can fairly say anything: nothing logged at all. A wall of amber is
     * not what a mother who has not started should meet — there is one action there
     * ("start logging"), not four.
     *
     * Deliberately *not* also gated on how recently the child was added. That gate existed
     * to spare a mother the card during a hospital stay, but it keyed on `onboarded_at` —
     * when the profile was created — which says nothing about whether there is anything to
     * report. A mother who added her baby this morning and logged a weight got the
     * "start logging" empty state back while her measurement rendered on the chart
     * directly below it, which reads as the app having lost her data. Having logged is
     * the signal; the date the row was written is not.
     */
    const hasAnyLog =
        input.growthLogs.length > 0 ||
        input.hasEverFed ||
        input.givenVaccineKeys.size > 0 ||
        input.achievedMilestoneKeys.size > 0;

    if (!hasAnyLog) {
        return {
            childId,
            status: "on_track",
            firstRun: true,
            summaryKey: "infant.wellbeing.summary.firstRun",
            tiles: [],
        };
    }

    const tiles: IWellbeingTile[] = [
        growthTile(input, ageMonths, now),
        feedingTile(input, ageMonths, now),
        vaccineTile(input, now),
        milestoneTile(input, ageMonths),
    ];

    return { childId, firstRun: false, tiles, ...summarise(tiles) };
};

export default class InfantWellbeingService {
    /**
     * Read the four logs and evaluate.
     *
     * Feeding is bounded to the two days the rules look at rather than the whole history —
     * every other read here is naturally small (one growth log, one row per dose, one per
     * milestone), but a feeding log is a document per day and fetching a year of them to
     * count yesterday's feeds would be the one slow query on the dashboard.
     */
    forChild = async (
        userId: string,
        childId: string,
        now: Date = new Date(),
    ): Promise<IInfantWellbeing> => {
        const child = await getOwnedChild(userId, childId);

        const since = getISTCalendarDate(new Date(now.getTime() - MS_PER_DAY));

        const [growthLogs, feedingDays, everFed, vaccinations, milestones] = await Promise.all([
            growthLogModel
                .find({ userId, childId }, { measuredOn: 1, percentiles: 1 })
                .sort({ measuredOn: -1 })
                .limit(1)
                .lean(),
            feedingLogModel
                .find({ userId, childId, loggedOn: { $gte: since } }, { loggedOn: 1, feeds: 1 })
                .lean(),
            // An index-only existence check, not a second read of the history: the two-day
            // window above cannot answer "has she ever logged", and the first-run state
            // turns on that question.
            feedingLogModel.exists({ userId, childId }),
            vaccinationLogModel.find({ userId, childId }, { vaccineKey: 1 }).lean(),
            milestoneLogModel.find({ userId, childId }, { milestoneKey: 1 }).lean(),
        ]);

        const feedsByDay = new Map<string, number>();
        for (const day of feedingDays) {
            feedsByDay.set(istDayKey(day.loggedOn), day.feeds?.length ?? 0);
        }

        return evaluate(
            {
                child,
                growthLogs: growthLogs as IWellbeingInput["growthLogs"],
                feedsByDay,
                hasEverFed: Boolean(everFed),
                givenVaccineKeys: new Set(vaccinations.map((row) => row.vaccineKey)),
                achievedMilestoneKeys: new Set(milestones.map((row) => row.milestoneKey)),
            },
            now,
        );
    };
}

export type { TWellbeingStatus };
