/**
 * @vivamama/care-schedules: the recommended ANC and PNC checkup schedules, shared by
 * `services/backend` (which validates a tick against these ids) and `apps/mobile` (which
 * renders them and works out what is coming up from the windows).
 *
 * Not a medical device. Windows are informational and pending clinical review.
 */

export type {
    CareItemCondition,
    CareKind,
    CareRecurringItem,
    CareRoute,
    CareSchedule,
    CareScheduleGroup,
    CareScheduleItem,
} from "./types";

export {
    ANC_CHECKS,
    CARE_SCHEDULES,
    PNC_CHECKS,
    careScheduleItemIds,
    isCareScheduleItem,
} from "./schedules";
