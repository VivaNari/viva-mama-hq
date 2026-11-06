import {
    CARE_SCHEDULES,
    CareKind,
    CareRoute,
    CareSchedule,
    CareScheduleItem,
} from '@vivamama/care-schedules';

import {
    CareModelEnum,
    DeliveryOutcomeEnum,
    DeliveryTypeEnum,
    PregnancyConditionEnum,
} from '../types/user.types';

export interface CareScheduleContext {
    deliveryType: DeliveryTypeEnum | null;
    deliveryOutcome: DeliveryOutcomeEnum | null;
    hasGdm: boolean;
}

/** The content sheet's rule: when her care route is not known, use the government one. */
export const careRoute = (careModel: CareModelEnum | null): CareRoute =>
    careModel === CareModelEnum.PRIVATE ? 'private' : 'public';

/**
 * The same test the backend's `prior_gdm` risk flag uses. It is worked out here because the
 * flags stay on the server, and these two answers are already hers to read.
 */
export const hasGestationalDiabetes = (
    data?: { pregnancy_conditions?: readonly string[]; health_history?: readonly string[] } | null,
): boolean =>
    !!data?.pregnancy_conditions?.includes(PregnancyConditionEnum.GESTATIONAL_DIABETES) ||
    !!data?.health_history?.includes('prior_gdm');

const applies = (item: CareScheduleItem, context: CareScheduleContext): boolean => {
    if (item.liveBirthOnly && context.deliveryOutcome === DeliveryOutcomeEnum.STILL_BIRTH) {
        return false;
    }
    if (item.condition === 'caesarean') return context.deliveryType === DeliveryTypeEnum.C_SECTION;
    if (item.condition === 'gdm') return context.hasGdm;
    return true;
};

/** Her schedule, without the items that do not apply to her. Empty groups are dropped. */
export const scheduleFor = (
    kind: CareKind,
    route: CareRoute,
    context: CareScheduleContext,
): CareSchedule => {
    const schedule = CARE_SCHEDULES[kind][route];
    return {
        recurring: schedule.recurring,
        groups: schedule.groups
            .map(group => ({ ...group, items: group.items.filter(item => applies(item, context)) }))
            .filter(group => group.items.length > 0),
    };
};
