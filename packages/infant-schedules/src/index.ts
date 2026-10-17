/**
 * @vivamama/infant-schedules — vaccination and milestone due-date windows from the India
 * MCP card, shared by `services/backend` and (indirectly, via the same generator run)
 * `apps/mobile`.
 *
 * The full schedule — visit labels, dose names, milestone copy — is generated only into
 * `apps/mobile/src/data/{infantVaccinationData,infantMilestoneData}.ts`, which is the one
 * place that needs it. This package carries the narrower slice a backend job needs to ask
 * "has this visit/band become due, and what does it cover": both are generated in the same
 * run, from the same workbook, as those mobile files and `services/backend/src/constants/
 * {vaccine-keys,milestone-keys}.ts` — so a due date the app implies and a due date the
 * backend reminds about can never drift apart.
 *
 * Not a medical device. Due windows are informational, transcribed from the India Mother
 * and Child Protection Card — see the generator scripts for source and review status.
 */

export type {
    MilestoneBandWindow,
    VaccinationDueUnit,
    VaccinationSector,
    VaccinationVisitWindow,
} from "./types";

export { VACCINATION_SCHEDULE_WINDOWS } from "./data/vaccination-schedule";
export { MILESTONE_BAND_WINDOWS } from "./data/milestone-schedule";
