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
    mobile_number?: string;
    country_code?: string;
    profile_picture?: string;
    is_onboarded: boolean;
    user_name?: string;
    date_of_birth?: Date;
    height?: number;
    childs: IChild[];
    partner_referral_code?: string;
    referral_code?: string;
    referred_user_id?: number;
    referred_user_object_id?: Schema.Types.ObjectId;
    FCM_token?: string;
    current_postpartum_week: number;
    date_of_delivery: Date;
    is_breastfeeding_currently?: boolean;
    onboarding_data: {
        preferred_name: string;
        date_of_birth?: Date;
        location?: string;
        conception_method?: string;
        pregnancy_conditions?: string[];
        delivery_date?: Date;
        delivery_type?: string;
        delivery_outcome?: string;
        past_medications?: string[];
        current_medications?: string[];
        tobacco_use?: string;
        alcohol_use?: string;
        social_support?: string;
        parity?: string;
        onboarded_at?: Date;
    };
}

export interface IGoogleLoginPayload {
    name: string;
    email: string;
    picture: string;
    FCM_token?: string | null;
}

export type TTokenSource = "header" | "query";
