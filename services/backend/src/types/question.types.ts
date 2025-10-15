export enum EAnswerType {
    TEXT = "text",
    SINGLE_CHOICE = "single-choice",
    MULTIPLE_CHOICE = "multiple-choice",
}
export interface IQuestion {
    question_id: number;
    question: string;
    isForOnboarding: boolean;
    answerType: EAnswerType;
    options: string[];
    frequency: string;
    interval: number;
}

export enum EQuestionFrequency {
    DAILY = "daily",
    WEEKLY = "weekly",
    MONTHLY = "monthly",
    EVERY_N_HOURS = "every n hours",
}
