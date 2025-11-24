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
}

export interface ScoreResult {
    userId: string;
    week: number;
    breastfeeding: boolean;
    categories: {
        physical: CategoryScore;
        lactation: CategoryScore;
        emotional: CategoryScore;
    };
    finalScore: number;
    zone: "RED" | "YELLOW" | "GREEN";
    weakestCategory: CategoryKey;
}
