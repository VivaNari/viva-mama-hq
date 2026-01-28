import { Schema } from "mongoose";

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

export interface IJWTDecodedUser {
    _id: string;
    email: string | null;
    mobile_number: string | null;
    is_onboarded: {
        is_questionnaire_completed: boolean;
        is_subscription_completed: boolean;
    };
    user_id: number;
}

export interface IUser {
    _id: Schema.Types.ObjectId;
    user_id: number;
    user_category: EUserCategory;
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
    FCM_token: string;
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
        past_medications: PastMedicationEnum[] | [];
        current_medications: CurrentMedicationEnum[] | [];
        tobacco_use: TobaccoUseEnum | null;
        alcohol_use: AlcoholUseEnum | null;
        social_support: SocialSupportEnum | null;
        parity: ParityEnum | null;
        onboarded_at: Date | null;
    };
    subscription: {
        plan: string | null;
        status: string | null;
        billingCycle: string | null;
        expiryDate: Date | null;
    };
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

export enum PastMedicationEnum {
    PCOD = "pcod",
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
