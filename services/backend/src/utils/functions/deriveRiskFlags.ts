import {
    DeliveryOutcomeEnum,
    EUserCategory,
    HealthHistoryEnum,
    IRiskFlags,
    PastMedicationEnum,
    PregnancyConditionEnum,
} from "../../types/user.types";

/** PENDING FOGSI SIGN-OFF: placeholder clinical thresholds, not yet confirmed. */
export const AGE_RISK_MIN_YEARS = 35;
export const HIGH_PARITY_MIN_PREGNANCIES = 5;

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export interface IRiskFlagInput {
    user_category?: EUserCategory | null;
    onboarding_data?: {
        date_of_birth?: Date | string | null;
        pregnancy_conditions?: readonly string[] | null;
        past_medications?: readonly string[] | null;
        health_history?: readonly string[] | null;
        delivery_outcome?: string | null;
        pregnancies_count?: number | null;
        living_children_count?: number | null;
    } | null;
}

/**
 * The PRD 1.14 risk flags, from what she told us in onboarding.
 *
 * These are only stored for now: the overlay engine that arms a condition track from
 * them is separate work.
 *
 * `previous_loss` is a quiet signal, never shown to her or passed to the chatbot. The
 * pregnancy count includes the current one, so an unborn current pregnancy is taken off
 * before comparing. Otherwise a mother pregnant with her second child who has one living
 * child would be wrongly flagged. More living children than pregnancies is legitimate,
 * since twins exist, and raises nothing.
 */
export const deriveRiskFlags = (user: IRiskFlagInput, now: Date = new Date()): IRiskFlags => {
    const data = user.onboarding_data ?? {};
    const conditions = data.pregnancy_conditions ?? [];
    const pastMedications = data.past_medications ?? [];
    const history = data.health_history ?? [];

    const pregnancies = data.pregnancies_count ?? null;
    const living = data.living_children_count ?? null;
    const currentlyPregnant = user.user_category === EUserCategory.NP;
    const completedPregnancies =
        pregnancies === null ? null : pregnancies - (currentlyPregnant ? 1 : 0);

    const lossFromCounts =
        completedPregnancies !== null && living !== null && completedPregnancies > living;

    const dob = data.date_of_birth ? new Date(data.date_of_birth) : null;
    const ageYears =
        dob && !Number.isNaN(dob.getTime()) ? (now.getTime() - dob.getTime()) / MS_PER_YEAR : null;

    return {
        prior_gdm:
            conditions.includes(PregnancyConditionEnum.GESTATIONAL_DIABETES) ||
            history.includes(HealthHistoryEnum.PRIOR_GDM),
        pregnancy_hypertension:
            conditions.includes(PregnancyConditionEnum.HIGH_BP) ||
            history.includes(HealthHistoryEnum.HIGH_BP) ||
            history.includes(HealthHistoryEnum.PRE_ECLAMPSIA),
        anaemia_history:
            conditions.includes(PregnancyConditionEnum.ANEMIA) ||
            pastMedications.includes(PastMedicationEnum.ANEMIA) ||
            history.includes(HealthHistoryEnum.ANAEMIA),
        previous_loss: lossFromCounts || data.delivery_outcome === DeliveryOutcomeEnum.STILL_BIRTH,
        age_risk: ageYears !== null && ageYears >= AGE_RISK_MIN_YEARS,
        high_parity: pregnancies !== null && pregnancies >= HIGH_PARITY_MIN_PREGNANCIES,
    };
};
