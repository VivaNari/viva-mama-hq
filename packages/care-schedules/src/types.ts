export type CareRoute = "public" | "private";
export type CareKind = "anc" | "pnc";

/**
 * Who an item applies to beyond her route. An item with no condition is for everyone on
 * that route.
 *   caesarean  her delivery_type is a C-section
 *   gdm        she carries a gestational diabetes risk flag
 */
export type CareItemCondition = "caesarean" | "gdm";

export interface CareScheduleItem {
    /** Primary key of a saved tick: never rename or reuse one. */
    id: string;
    /**
     * When the item is due, inclusive at both ends. Gestational weeks on the ANC schedule;
     * days since birth on the PNC schedule (the day of birth is day 0).
     */
    start: number;
    end: number;
    condition?: CareItemCondition;
    /** Hidden after a stillbirth, because the item is about the baby or about feeding. */
    liveBirthOnly?: boolean;
    /**
     * Something she keeps doing across a long window, such as daily tablets. "What is coming
     * up" lists these after dated visits and tests, or they would hide those for months.
     */
    ongoing?: boolean;
}

export interface CareScheduleGroup {
    id: string;
    items: CareScheduleItem[];
}

/** A row that repeats on a day of the month and is never ticked off, such as PMSMA. */
export interface CareRecurringItem {
    id: string;
    dayOfMonth: number;
    start: number;
    end: number;
}

export interface CareSchedule {
    groups: CareScheduleGroup[];
    recurring: CareRecurringItem[];
}
