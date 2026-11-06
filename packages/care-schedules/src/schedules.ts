import { CareKind, CareRoute, CareSchedule } from "./types";

/**
 * The recommended checkup schedules. Labels and display timings live in the mobile locale
 * files under `logs.anc.schedule.<route>` and `logs.pnc.schedule.<route>`.
 *
 * Source: Viva_1000_Day_Master_Schedule.xlsx, Public journey and Private journey tabs. A
 * visit row becomes a group and its "What happens" column is condensed into tickable
 * items. Delivery, birth-dose, child, lifestyle and wellbeing rows are left out.
 *
 * Saved ticks store the item id, so an id must never be renamed or reused. Add new ones.
 *
 * Draft: confirm items and windows with the clinical advisors.
 */

/** Gestational weeks. */
const ANC_PUBLIC: CareSchedule = {
    groups: [
        {
            id: "g1",
            items: [
                { id: "g1a", start: 4, end: 12 },
                { id: "g1b", start: 4, end: 12 },
                { id: "g1c", start: 4, end: 12 },
                { id: "g1d", start: 6, end: 9 },
                { id: "g1e", start: 4, end: 12 },
            ],
        },
        {
            id: "g2",
            items: [
                { id: "g2a", start: 14, end: 26 },
                { id: "g2b", start: 18, end: 20 },
                { id: "g2c", start: 14, end: 26 },
                { id: "g2d", start: 14, end: 26 },
                { id: "g2e", start: 24, end: 28 },
            ],
        },
        {
            id: "g3",
            items: [
                { id: "g3a", start: 28, end: 34 },
                { id: "g3b", start: 28, end: 34 },
                { id: "g3c", start: 28, end: 32 },
            ],
        },
        {
            id: "g4",
            items: [
                { id: "g4a", start: 36, end: 42 },
                { id: "g4b", start: 36, end: 42 },
            ],
        },
    ],
    // Second and third trimester, on the 9th of each month. Public route only.
    recurring: [{ id: "pmsma", dayOfMonth: 9, start: 13, end: 40 }],
};

/** Gestational weeks. */
const ANC_PRIVATE: CareSchedule = {
    groups: [
        {
            id: "p1",
            items: [
                { id: "p1a", start: 6, end: 8 },
                { id: "p1b", start: 8, end: 10 },
                { id: "p1c", start: 11, end: 13 },
            ],
        },
        {
            id: "p2",
            items: [
                { id: "p2a", start: 18, end: 20 },
                { id: "p2b", start: 24, end: 28 },
                { id: "p2c", start: 15, end: 20 },
                { id: "p2d", start: 23, end: 25 },
            ],
        },
        {
            id: "p3",
            items: [
                { id: "p3a", start: 28, end: 32 },
                { id: "p3b", start: 35, end: 37 },
                { id: "p3c", start: 36, end: 38 },
                { id: "p3d", start: 36, end: 42 },
            ],
        },
    ],
    recurring: [],
};

/**
 * Days since birth. The last group, `n5`/`m5`, runs the schedule on to 24 months and comes
 * from the Journey content workbook's touchpoint rows (M-T10w onward), not from the Master
 * Schedule's postnatal rows.
 */
const PNC_PUBLIC: CareSchedule = {
    groups: [
        {
            id: "n1",
            items: [
                { id: "n1a", start: 0, end: 2 },
                { id: "n1b", start: 0, end: 2 },
                { id: "n1c", start: 0, end: 2, liveBirthOnly: true },
                { id: "n1d", start: 0, end: 2 },
            ],
        },
        {
            id: "n2",
            items: [
                { id: "n2a", start: 3, end: 3 },
                { id: "n2b", start: 7, end: 7 },
                { id: "n2c", start: 14, end: 14 },
                { id: "n2d", start: 21, end: 21 },
                { id: "n2e", start: 28, end: 28 },
            ],
        },
        {
            id: "n3",
            items: [
                { id: "n3a", start: 36, end: 56 },
                { id: "n3b", start: 36, end: 56 },
                { id: "n3c", start: 36, end: 56 },
                { id: "n3d", start: 36, end: 56 },
                { id: "n3e", start: 36, end: 56 },
                { id: "n3f", start: 42, end: 42 },
                { id: "n3g", start: 42, end: 70, condition: "gdm" },
            ],
        },
        {
            id: "n4",
            items: [
                { id: "n4a", start: 0, end: 180, ongoing: true },
                { id: "n4b", start: 0, end: 180, ongoing: true },
            ],
        },
        {
            id: "n5",
            items: [
                { id: "n5a", start: 63, end: 180 },
                { id: "n5b", start: 150, end: 270 },
                { id: "n5c", start: 335, end: 425 },
                { id: "n5d", start: 426, end: 520 },
                { id: "n5e", start: 521, end: 700 },
                { id: "n5f", start: 701, end: 760 },
            ],
        },
    ],
    recurring: [],
};

/** Days since birth. */
const PNC_PRIVATE: CareSchedule = {
    groups: [
        {
            id: "m1",
            items: [
                { id: "m1a", start: 0, end: 2 },
                { id: "m1b", start: 0, end: 2 },
                { id: "m1c", start: 0, end: 2, liveBirthOnly: true },
                { id: "m1d", start: 0, end: 2 },
            ],
        },
        {
            id: "m2",
            items: [
                { id: "m2a", start: 5, end: 10 },
                { id: "m2b", start: 5, end: 14, condition: "caesarean" },
            ],
        },
        {
            id: "m3",
            items: [
                { id: "m3a", start: 36, end: 56 },
                { id: "m3b", start: 36, end: 56 },
                { id: "m3c", start: 36, end: 56 },
                { id: "m3d", start: 36, end: 56 },
                { id: "m3e", start: 36, end: 56 },
                { id: "m3g", start: 42, end: 70, condition: "gdm" },
            ],
        },
        {
            id: "m4",
            items: [
                { id: "m4a", start: 0, end: 180, ongoing: true },
                { id: "m4b", start: 0, end: 180, ongoing: true },
            ],
        },
        {
            id: "m5",
            items: [
                { id: "m5a", start: 63, end: 97 },
                { id: "m5b", start: 91, end: 150 },
                { id: "m5c", start: 150, end: 270 },
                { id: "m5d", start: 270, end: 335 },
                { id: "m5e", start: 335, end: 425 },
                { id: "m5f", start: 426, end: 520 },
                { id: "m5g", start: 521, end: 700 },
                { id: "m5h", start: 701, end: 760 },
            ],
        },
    ],
    recurring: [],
};

export const CARE_SCHEDULES: Record<CareKind, Record<CareRoute, CareSchedule>> = {
    anc: { public: ANC_PUBLIC, private: ANC_PRIVATE },
    pnc: { public: PNC_PUBLIC, private: PNC_PRIVATE },
};

const idsOf = (schedule: CareSchedule): string[] =>
    schedule.groups.flatMap((group) => group.items.map((item) => item.id));

/** Every tickable id on both routes of a schedule. A saved tick survives a route change. */
export const careScheduleItemIds = (kind: CareKind): string[] => [
    ...idsOf(CARE_SCHEDULES[kind].public),
    ...idsOf(CARE_SCHEDULES[kind].private),
];

export const isCareScheduleItem = (kind: CareKind, itemId: string): boolean =>
    careScheduleItemIds(kind).includes(itemId);

/** What "Log a visit" offers, stored in `fields.checks`. */
export const ANC_CHECKS = ["bp", "weight", "abdominal", "hb", "urine", "fetal_heartbeat"] as const;
export const PNC_CHECKS = ["bp", "temperature", "bleeding", "womb", "breasts", "wound", "hb"] as const;
