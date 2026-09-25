import { Schema, Types } from "mongoose";
import { FlowLanguage } from "./chat.types";

/** Localized recommendation text for one category, within a history snapshot. */
export interface IRecommendationHistoryRecText {
    title?: string;
    goingWell?: string;
    needsHelp?: string;
    celebrate?: string[];
    tips?: string[];
    next?: string[];
}

/**
 * Full localized text of a history snapshot for one language: the overall
 * tagline plus the per-category recommendation text. Logic fields (scores,
 * zones) are language-neutral and stay on the base document.
 */
export interface IRecommendationHistoryTranslationBundle {
    tagline?: string;
    individualRecommendations: {
        physical: IRecommendationHistoryRecText;
        lactation: IRecommendationHistoryRecText;
        emotional: IRecommendationHistoryRecText;
    };
}

export type IRecommendationHistoryTranslations = Partial<
    Record<FlowLanguage, IRecommendationHistoryTranslationBundle>
>;

/**
 * One clinically urgent answer from the check-in, stored as stable ids only.
 * Display text is resolved from the localized flow definition at read time.
 */
export interface IEmergencyFlag {
    nodeId: string;
    optionValue: string;
}

/** The dashboard-facing alert, assembled at read time from `emergencyFlags`. */
export interface IEmergencyAlert {
    recommendationHistoryId: string;
    week: number;
    concerns: {
        nodeId: string;
        indicator: string;
        answerLabel: string;
    }[];
}

export interface IRecommendationHistory {
    userId: Schema.Types.ObjectId | string;
    week: number;
    finalScore: number;
    zone: "RED" | "YELLOW" | "GREEN";
    breastfeeding: boolean;
    tagline: string;
    individualRecommendations: {
        physical: {
            recommendation: {
                title: string;
                goingWell: string;
                needsHelp?: string;
                celebrate?: string[];
                tips?: string[];
                next?: string[];
            };
            score: number;
            zone: "RED" | "YELLOW" | "GREEN";
        };
        lactation: {
            recommendation: {
                title: string;
                goingWell: string;
                needsHelp?: string;
                celebrate?: string[];
                tips?: string[];
                next?: string[];
            };
            score: number;
            zone: "RED" | "YELLOW" | "GREEN";
        };
        emotional: {
            recommendation: {
                title: string;
                goingWell: string;
                needsHelp?: string;
                celebrate?: string[];
                tips?: string[];
                next?: string[];
            };
            score: number;
            zone: "RED" | "YELLOW" | "GREEN";
        };
    };
    categoryScores: {
        physical: { raw: number; weighted: number };
        lactation: { raw: number; weighted: number };
        emotional: { raw: number; weighted: number };
    };
    checkinAnswersDump: {
        question: string;
        answer: string | number | boolean;
    }[];
    /**
     * Per-language copies of the snapshot's display text, frozen at check-in
     * time. The read endpoints swap the base `tagline`/`individualRecommendations`
     * text for the requested language; logic fields are never duplicated here.
     */
    translations?: IRecommendationHistoryTranslations;
    /** Flow definition these answers were given against, for resolving display text. */
    flowDefId?: Schema.Types.ObjectId | Types.ObjectId | string | null;
    /** Clinically urgent answers found in this check-in. Empty for most weeks. */
    emergencyFlags?: IEmergencyFlag[];
    /**
     * When the user dismissed this week's alert. Scoped to this row, so next
     * week's check-in raises its own alert regardless.
     */
    alertDismissedAt?: Date | null;
}
