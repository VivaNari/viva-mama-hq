import { Document } from "mongoose";

export interface IExpert extends Document {
    name: string;
    speciality: string;
    qualification: string;
    yearsOfExperience: number;
    bio: string;
    photograph: string;
    remuneration: number;
}
