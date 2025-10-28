import { Schema } from "mongoose";

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
}

export interface IGoogleLoginPayload {
    name: string;
    email: string;
    picture: string;
    FCM_token?: string | null;
}
