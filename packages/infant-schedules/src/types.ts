/**
 * The shapes behind both generated schedules.
 *
 * Deliberately narrower than the app's own `IVaccinationVisit` / `IMilestoneBand` types
 * (apps/mobile/src/types/infantLog.types.d.ts): this package answers one question — "when
 * is this visit/band due, and which keys does it cover" — for a backend that needs to know
 * whether a due window has opened, not to render a screen. Display copy (labels, dose
 * names, notes) stays in the mobile app's own generated data, which nothing server-side
 * reads.
 */

export type VaccinationDueUnit = "week" | "month";

export type VaccinationSector = "public" | "private";

export interface VaccinationVisitWindow {
    key: string;
    due: { unit: VaccinationDueUnit; from: number; to: number };
    /** Dose keys given at this visit, in the order the card lists them. */
    doseKeys: string[];
}

export interface MilestoneBandWindow {
    key: string;
    ageMonths: { from: number; to: number };
    /** Milestone keys tracked in this band, in card order. */
    milestoneKeys: string[];
}
