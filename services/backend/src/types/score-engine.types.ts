export type CategoryKey = "physical" | "lactation" | "emotional";

export interface Indicators {
    physical: number[];
    lactation: number[];
    emotional: number[];
}

export interface CategoryScore {
    raw: number;
    weighted: number;
    maxPossible: number;
    sum: number;
    invidual: {
        score: number;
        zone: string;
    };
}
export interface IndividualCategoryScore {
    score: number;
    zone: "RED" | "YELLOW" | "GREEN";
}
export interface ScoreResult {
    userId: string;
    week: number;
    breastfeeding: boolean;
    categories: {
        physical: {
            raw: number;
            weighted: number;
            maxPossible: number;
            sum: number;
            invidual: IndividualCategoryScore;
        };
        lactation: {
            raw: number;
            weighted: number;
            maxPossible: number;
            sum: number;
            invidual: IndividualCategoryScore;
        };
        emotional: {
            raw: number;
            weighted: number;
            maxPossible: number;
            sum: number;
            invidual: IndividualCategoryScore;
        };
    };
    finalScore: number;
    zone: "RED" | "YELLOW" | "GREEN";
    weakestCategory: CategoryKey;
}
