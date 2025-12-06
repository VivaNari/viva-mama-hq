import { Schema } from "mongoose";

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
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

export interface IUser {
    _id: Schema.Types.ObjectId;
    user_id: number;
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
    current_postpartum_week: number | null;
    is_breastfeeding_currently: boolean;
    onboarding_data: {
        preferred_name: string | null;
        date_of_birth: Date | null;
        location: string | null;
        conception_method: string | null;
        pregnancy_conditions: string[] | [];
        is_not_pragnant_yet: boolean | null;
        delivery_date: Date | null;
        delivery_type: string | null;
        delivery_outcome: string | null;
        past_medications: string[] | [];
        current_medications: string[] | [];
        tobacco_use: string | null;
        alcohol_use: string | null;
        social_support: string | null;
        parity: string | null;
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
