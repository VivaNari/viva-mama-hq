import { Document, Types } from "mongoose";

export interface IRecommendationBase {
    phase: "1-2" | "3-4" | "5-6" | "7-12" | "13-26" | "27-52";
    zone: "RED" | "YELLOW" | "GREEN";
    category: "physical" | "lactation" | "emotional" | "all";
    title: string;
    goingWell: string;
    needsHelp?: string;
    celebrate?: string;
    tips?: string;
    next?: string;
}

// For Mongoose documents
export interface IRecommendation extends IRecommendationBase, Document {
    _id: Types.ObjectId;
}

// For lean() queries (plain objects)
export interface IRecommendationLean extends IRecommendationBase {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface IRecommendationResponse {
    overall: IRecommendationLean;
    individual: {
        physical: IRecommendationLean | null;
        lactation: IRecommendationLean | null;
        emotional: IRecommendationLean | null;
    };
}
