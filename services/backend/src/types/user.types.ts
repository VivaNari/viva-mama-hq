import { Schema } from "mongoose";
import { FlowLanguage } from "./chat.types";
import { IUserSubscriptionSnapshot } from "./subscription.types";
import { ICapabilityOverride } from "../services/entitlements/entitlement.config";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user: IJWTDecodedUser;
        }
    }
}
export interface IChild {
    name: string;
    date_of_birth: Date;
    sex: "Male" | "Female" | "Other";
    child_id?: number;
}

export enum ESex {
    MALE = "Male",
    FEMALE = "Female",
    OTHER = "Other",
}

export enum EUserRole {
    USER = "USER",
    SUPER_ADMIN = "SUPER_ADMIN",
}

export interface IJWTDecodedUser {
    _id: string;
    email: string | null;
    mobile_number: string | null;
    is_onboarded: {
        is_questionnaire_completed: boolean;
        is_subscription_completed: boolean;
    };
    user_id: number;
    // Absent on tokens minted before roles existed. Treat missing as USER.
    role?: EUserRole;
}

export interface IUser {
    _id: Schema.Types.ObjectId;
    user_id: number;
    user_category: EUserCategory;
    role: EUserRole;
    // bcrypt hash, staff accounts only (they sign in with `email` + this). Optional
    // because the schema marks it `select: false` — it is absent from every read that
    // doesn't ask for it by name, and only the admin login path ever does.
    password?: string | null;
    email: string;
    mobile_number: string | null;
    country_code: string | null;
    profile_picture: string | null;
    is_onboarded: {
        is_questionnaire_completed: boolean;
        is_subscription_completed: boolean;
    };
    childs: IChild[] | [];
    partner_referral_code: string | null;
    referral_code: string | null;
    referred_user_id: number | null;
    referred_user_object_id: Schema.Types.ObjectId | null;
    expert_referral_code: string | null;
    referred_by_expert_id: Schema.Types.ObjectId | null;
    referred_by_organization_id: Schema.Types.ObjectId | null;
    referral_program_id: Schema.Types.ObjectId | null;
    /** Per-user narrowings of the tier matrix. Never widens — see `resolveRule`. */
    entitlement_overrides: ICapabilityOverride[];
    FCM_token: string;
    preferred_language: FlowLanguage;
    current_weekdays: {
        weeks: number | null;
        days: number | null;
        upcoming_checkin_due_days: number;
        previous_checkin_due_days: number;
    };
    previous_weekly_checkin_due_days: number;
    upcoming_weekly_checkin_due_days: number;
    is_breastfeeding_currently: boolean;
    onboarding_data: {
        preferred_name: string | null;
        date_of_birth: Date | null;
        location: string | null;
        is_not_pragnant_yet: boolean | null;
        delivery_date: Date | null;
        conception_method: ConceptionMethod | null;
        pregnancy_conditions: PregnancyConditionEnum[] | [];
        delivery_type: DeliveryTypeEnum | null;
        delivery_outcome: DeliveryOutcomeEnum | null;
        /**
         * How she is feeding her baby. Asked only of postpartum mothers, so it stays
         * null for NP and NN — and for everyone who onboarded before the question
         * existed. It is what `is_breastfeeding_currently` is derived from.
         */
        feeding_method: FeedingMethodEnum | null;
        past_medications: PastMedicationEnum[] | [];
        current_medications: CurrentMedicationEnum[] | [];
        tobacco_use: TobaccoUseEnum | null;
        alcohol_use: AlcoholUseEnum | null;
        social_support: SocialSupportEnum | null;
        parity: ParityEnum | null;
        onboarded_at: Date | null;
    };
    subscription: IUserSubscriptionSnapshot;
    /** Viva Club: users this account has blocked. */
    blockedUsers: Schema.Types.ObjectId[];
    /** Viva Club: barred from posting and commenting by a reviewer. */
    communityBanned: boolean;
    consents: {
        type: "privacy_policy" | "terms_of_use" | "community_guidelines";
        version: string;
        acceptedAt: Date;
    }[];
}

export interface IGoogleLoginPayload {
    name: string;
    email: string;
    picture: string;
    FCM_token?: string | null;
}

export type TTokenSource = "header" | "query";

export enum EUserCategory {
    PP = "PP", // Postpartum_Women
    NP = "NP", // Non_Postpartum_Pregnant Women
    NN = "NN", // Non-Postpartum Non-Pregnant Women
}

export type TUsercategory = EUserCategory.NN | EUserCategory.PP | EUserCategory.NP;

export enum ConceptionMethod {
    NATURAL = "natural",
    IVF = "ivf",
}

export enum PregnancyConditionEnum {
    ANEMIA = "anemia",
    GESTATIONAL_DIABETES = "gestational_diabetes",
    HIGH_BP = "high_bp",
    OBESITY = "obesity",
    THYROID = "thyroid",
    FIBROIDS = "fibroids",
    TWIN = "twin",
    NONE = "none",
}

export enum DeliveryTypeEnum {
    VAGINAL = "vaginal",
    C_SECTION = "c_section",
}

export enum DeliveryOutcomeEnum {
    LIVE_BIRTH = "live_birth",
    STILL_BIRTH = "still_birth",
}

/**
 * How the mother is feeding her baby, captured in onboarding.
 *
 * MIXED counts as breastfeeding: `is_breastfeeding_currently` is derived as
 * "anything but NOT_BREASTFEEDING", because the lactation check-in questions and the
 * score engine are relevant to a mother who is partly breastfeeding.
 */
export enum FeedingMethodEnum {
    ONLY_BREASTMILK = "only_breastmilk",
    MIXED = "mixed",
    NOT_BREASTFEEDING = "not_breastfeeding",
}

export enum PastMedicationEnum {
    PMOS = "pmos",
    ANEMIA = "history_anemia",
    THYROID = "history_thyroid",
    DIABETES = "history_diabetes",
    DEPRESSION = "history_depression",
    ANXIETY = "history_anxiety",
    NONE = "history_none",
}

export enum CurrentMedicationEnum {
    THYROID = "meds_thyroid",
    DIABETES = "meds_diabetes",
    BP = "meds_bp",
    DEPRESSION = "meds_depression",
    ANXIETY = "meds_anxiety",
    NONE = "meds_none",
}

export enum TobaccoUseEnum {
    NEVER = "never",
    OCCASIONALLY = "occasionally",
    REGULARLY = "regularly",
}

export enum AlcoholUseEnum {
    NEVER = "never",
    OCCASIONALLY = "occasionally",
    REGULARLY = "regularly",
}

export enum SocialSupportEnum {
    FAMILY_HELP = "family_help",
    PARTNER_SHARED = "partner_shared",
    MANAGE_ALONE = "manage_alone",
}

export enum ParityEnum {
    FIRST_TIME = "first_time",
    MULTIPAROUS = "multiparous",
}
