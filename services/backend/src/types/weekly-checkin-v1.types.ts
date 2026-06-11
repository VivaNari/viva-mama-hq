export type WeeklyCheckinStartParams = {
    userId: string;
    week: number;
    flowSlug?: string;
};

export type WeeklyCheckinAnswerParams = {
    userId: string;
    flowInstanceId: string;
    nodeId: string;
    week: number;
    selectedKeys?: number[];
    freeText?: string;
    idempotencyKey: string;
};

export type WeeklyCheckinQuestionPayload = {
    id: string;
    flowInstanceId: string;
    week: number;
    text: string;
    educationalMessage: string;
    whyThisMatters: string;
    options: Array<{
        id: string;
        label: string;
        value: string;
        score: number;
    }>;
    nodeType: string;
};

export type WeeklyCheckinProgress = {
    answered: number;
    total: number;
};

export type WeeklyCheckinResponse = {
    success: boolean;
    message: string;
    errorType?: WeeklyCheckinErrorTypeEnum;
    data?: {
        flowInstanceId: string;
        week: number;
        isCompleted: boolean;
        nextQuestion: WeeklyCheckinQuestionPayload | null;
        progress: WeeklyCheckinProgress | null;
        state?: string;
        nextNodeId?: string;
    };
};

export type WeeklyCheckinStatusResponse = {
    week: number;
    hasCheckin: boolean;
    state: string | null;
    isCompleted: boolean;
    isExpired: boolean;
    progress: WeeklyCheckinProgress | null;
};

export type WeeklyCheckinCurrentStateResponse = {
    hasActiveCheckin: boolean;
    flowInstanceId: string | null;
    week: number;
    state: string | null;
    currentQuestion: WeeklyCheckinQuestionPayload | null;
    progress: WeeklyCheckinProgress | null;
};

export enum WeeklyCheckinErrorTypeEnum {
    WEEK_MISMATCH = "WEEK_MISMATCH",
    ALREADY_COMPLETED = "ALREADY_COMPLETED",
    FLOW_NOT_FOUND = "FLOW_NOT_FOUND",
    INSTANCE_NOT_FOUND = "INSTANCE_NOT_FOUND",
    INVALID_NODE = "INVALID_NODE",
    EXPIRED = "EXPIRED",
    VALIDATION_ERROR = "VALIDATION_ERROR",
}

export type QuestionPayload = {
    id: string;
    flowInstanceId: string;
    week: number;
    text: string;
    educationalMessage: string;
    whyThisMatters: string;
    options: Array<{
        id: string;
        label: string;
        value: string;
        score: number;
    }>;
    nodeType: string;
};

export type CheckinStatus = {
    week: number;
    hasCheckin: boolean;
    state: string | null;
    isCompleted: boolean;
    isExpired: boolean;
    progress: {
        answered: number;
        total: number;
    } | null;
};

export type CurrentStateResponse = {
    hasActiveCheckin: boolean;
    flowInstanceId: string | null;
    week: number;
    state: string | null;
    currentQuestion: QuestionPayload | null;
    progress: {
        answered: number;
        total: number;
    } | null;
};

// ============================================
// State Enums
// ============================================

export enum WeeklyCheckinStateEnum {
    PENDING = "PENDING",
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    EXPIRED = "EXPIRED",
    ABORTED = "ABORTED",
}

export type WeeklyCheckinValidation = {
    isValid: boolean;
    error?: {
        type: WeeklyCheckinErrorTypeEnum;
        message: string;
    };
    flowInstance?: any;
};
