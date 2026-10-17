import { Document, Types } from "mongoose";
import { FlowLanguage } from "./chat.types";

/**
 * Translatable display fields of a recommendation for one non-default language.
 * Any field may be omitted; the base (English) value is used as fallback.
 */
export interface IRecommendationTranslationBundle {
    title?: string;
    goingWell?: string;
    needsHelp?: string;
    celebrate?: string[];
    tips?: string[];
    next?: string[];
}

export type IRecommendationTranslations = Partial<
    Record<FlowLanguage, IRecommendationTranslationBundle>
>;

export interface IRecommendationBase {
    phase: "1-2" | "3-4" | "5-6" | "7-12" | "13-26" | "27-52";
    zone: "RED" | "YELLOW" | "GREEN";
    category: "physical" | "lactation" | "emotional" | "all";
    title: string;
    goingWell: string;
    needsHelp?: string;
    celebrate?: string[];
    tips?: string[];
    next?: string[];
    translations?: IRecommendationTranslations;
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
