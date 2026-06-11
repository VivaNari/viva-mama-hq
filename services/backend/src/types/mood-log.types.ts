import { Schema } from "mongoose";

export enum EMood {
    EXTREMELY_SAD = 1,
    SAD = 2,
    NEUTRAL = 3,
    HAPPY = 4,
    EXTREMELY_HAPPY = 5,
}

export interface IMoodLog {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    mood: EMood;
    logDate: Date;
    createdAt: Date;
    updatedAt: Date;
}
