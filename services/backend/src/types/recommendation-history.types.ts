import { Schema, Types } from "mongoose";

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
}
