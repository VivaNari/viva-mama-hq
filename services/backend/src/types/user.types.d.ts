export interface IUser {
    id: number;
    name: string;
    email: string;
    mobile_number: string;
    profile_pic: string;
    is_onboarded: boolean;
}

export interface IGoogleLoginPayload {
    name: string;
    email: string;
    picture: string;
}
