import { ObjectId, Schema } from "mongoose";
import { IUser } from "./user.types";
import { Request, Response } from "express";

export enum ChatModeEnum {
    MIXED = "MIXED",
    AI_ONLY = "AI_ONLY",
    GUIDED_ONLY = "GUIDED_ONLY",
}

export type ChatMode = ChatModeEnum.MIXED | ChatModeEnum.AI_ONLY | ChatModeEnum.GUIDED_ONLY;

export type Rating = 1 | 2 | 3 | 4 | 5;

export type Channel = "App";

export interface IConversation {
    _id: Schema.Types.ObjectId;
    userId: string;
    title: string;
    chatMode: ChatMode;
    lastMessageAt: Date;
    meta: {
        channel: Channel;
        tags: string[];
    };
    rating: Rating;
    createdAt: Date;
    updatedAt: Date;
}

export enum MessageRoleEnum {
    USER = "USER",
    ASSITANT = "ASSISTANT",
}

export enum MessageTypeEnum {
    AI = "AI",
    GUIDED = "GUIDED",
    SYSTEM = "SYSTEM",
}
export enum AttachmentTypeEnum {
    IMAGE = "IMAGE",
    PDF = "PDF",
    AUDIO = "AUDIO",
}
export enum ProviderEnum {
    OPENAI = "OPENAI",
    GROQ = "GROQ",
    LOCAL = "LOCAL",
}
export type MessageRole = MessageRoleEnum.USER | MessageRoleEnum.ASSITANT;
export type MessageType = MessageTypeEnum.AI | MessageTypeEnum.GUIDED | MessageTypeEnum.SYSTEM;
export type AttachmentType =
    | AttachmentTypeEnum.AUDIO
    | AttachmentTypeEnum.IMAGE
    | AttachmentTypeEnum.PDF;
export type Provider = ProviderEnum.OPENAI | ProviderEnum.LOCAL | ProviderEnum.GROQ;

export interface IMessage {
    _id: Schema.Types.ObjectId;
    conversationId: Schema.Types.ObjectId;
    userId: string;
    role: MessageRole;
    type: MessageType;
    text: string;
    rich: any;
    attachments: Array<{
        type: AttachmentType;
        url: string;
        meta: any;
    }> | null;
    ai: {
        promptId: string;
        provider: Provider;
        model: string;
        ragUsed: boolean;
        citations: Array<{ title: string; url?: string }>;
        tokens: { prompt: number; completion: number };
        latencyMs?: number;
    } | null;
    guided: {
        flowInstanceId: Schema.Types.ObjectId;
        nodeId: string;
        optionKey: string;
    } | null;
    createdAt: Date;
    updatedAt: Date;
}

export enum FlowDefinitionStatusEnum {
    DRAFT = "DRAFT",
    PUBLISHED = "PUBLISHED",
    ARCHIVED = "ARCHIVED",
}
export type FlowDefinitionStatus =
    | FlowDefinitionStatusEnum.ARCHIVED
    | FlowDefinitionStatusEnum.DRAFT
    | FlowDefinitionStatusEnum.PUBLISHED;

export enum FlowNodeEnum {
    QUESTION_SINGLE = "QUESTION_SINGLE",
    QUESTION_MULTI = "QUESTION_MULTI",
    QUESTION_FREE_TEXT = "QUESTION_FREE_TEXT",
    QUESTION_DATE = "QUESTION_DATE",
    INFO = "INFO",
    BRANCH = "BRANCH",
    CALC = "CALC",
    END = "END",
}

export type FlowNodeType =
    | FlowNodeEnum.QUESTION_SINGLE
    | FlowNodeEnum.QUESTION_MULTI
    | FlowNodeEnum.INFO
    | FlowNodeEnum.BRANCH
    | FlowNodeEnum.CALC
    | FlowNodeEnum.END
    | FlowNodeEnum.QUESTION_FREE_TEXT
    | FlowNodeEnum.QUESTION_DATE;

export interface IFlowNode {
    id: string;
    categoryId: Schema.Types.ObjectId;
    indicator: string;
    nodeType: FlowNodeType;
    text: string | null;
    educationalMessage: string;
    whyThisMatters: string;
    validWeekStart: number | null;
    validWeekEnd: number | null;
    options: Array<{
        label: string;
        value: any;
        score: number | null;
    }>;
    branch: Array<{
        when: { var: string; op: "eq" | "gt" | "lt" | "in"; val: any };
        goTo: string;
    }> | null;
    calc: Array<{ set: string; expr: string }> | null;
    next: string | null;
}

export interface IFlowNodeCategory {
    categoryName: string;
}

export interface INotificationTemplates {
    notificationType:
        | FlowInstanceStateEnum.ABORTED
        | FlowInstanceStateEnum.REMIND_ME_LATER
        | "NEW_FLOW_INSTANCE";
    title: string;
    body: string;
}

export interface IFlowDefinition {
    _id: Schema.Types.ObjectId;
    slug: string; // e.g. "breastfeeding-pain-v1"
    name: string;
    version: number;
    status: FlowDefinitionStatus;
    reminderIntervalMins: number;
    notificationTemplates: INotificationTemplates[];
    startNodeId: string;
    nodes: IFlowNode[];
    outcomes: Array<{
        key: string; // e.g. "mild_pain"
        title: string;
        summary: string;
        recommendations: string[];
        nextAction: string | null;
    }>;
    createdBy: Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export enum FlowInstanceStateEnum {
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    REMIND_ME_LATER = "REMIND_ME_LATER",
    ABORTED = "ABORTED",
    EXPIRED = "EXPIRED",
    PENDING = "PENDING",
}
export type FlowInstanceState =
    | FlowInstanceStateEnum.ACTIVE
    | FlowInstanceStateEnum.COMPLETED
    | FlowInstanceStateEnum.REMIND_ME_LATER
    | FlowInstanceStateEnum.ABORTED
    | FlowInstanceStateEnum.EXPIRED
    | FlowInstanceStateEnum.PENDING;

export interface IFlowInstance {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    conversationId: Schema.Types.ObjectId;
    flowDefId: Schema.Types.ObjectId;
    flowSlug: string;
    version: number;
    postpartumWeek: number;
    postpartumDays: number;
    state: FlowInstanceState;
    cursorNodeId: string | null;
    variables: Record<string, any>;
    outcome: {
        key: string;
        title: string;
        summary: string;
        recommendations: string[];
    } | null;
    createdAt: Date;
    updatedAt: Date;
}

export enum AnswerTypeEnum {
    SINGLE = "SINGLE",
    MULTI = "MULTI",
    FREE = "FREE",
}
export type AnswerType = AnswerTypeEnum.SINGLE | AnswerTypeEnum.MULTI | AnswerTypeEnum.FREE;

export interface IFlowResponse {
    _id: Schema.Types.ObjectId;
    flowInstanceId: Schema.Types.ObjectId;
    flowDefId: Schema.Types.ObjectId;
    nodeId: string;
    answer: {
        type: AnswerType;
        selectedKeys: number[] | null;
        freeText: string | null;
    };
    computed: Record<string, any> | null;
    createdAt: Date;
    updatedAt: Date;
    idempotencyKey: string;
}

export interface QuestionPayload {
    askId: number;
    uuid?: string | undefined;
    type: QuestionSourceEnum;
    id: string;
    flowInstanceId: string;
    text: string;
    educationalMessage: string;
    whyThisMatters: string;
    options: Array<{
        id: string;
        label: string;
        value: any;
    }>;
    nodeType?: FlowNodeType;
}

export interface EndFlowPayload {
    type: "end_flow";
    message: string;
    flowType: string;
}

export interface AuthenticatedRequest extends Request {
    user: IUser & { _id: string };
}

export enum FlowTypeEnum {
    ONBOARDING = "ONBOARDING",
    CHECK_IN = "CHECK_IN",
    CHATBOT = "CHATBOT",
}

export type FlowType = FlowTypeEnum.ONBOARDING | FlowTypeEnum.CHECK_IN | FlowTypeEnum.CHATBOT;

export type AIGreetingMessage = AILLMResponse;

export type AILLMResponse = {
    sessionId?: string;
    conversationId?: ObjectId;
    id: string;
    type: "ai_message";
    text?: string;
    timestamp: number;
    response: Record<string, unknown>;
    nodeType?: FlowNodeType;
};

export type AnswerData = {
    type: AnswerTypeEnum;
    freeText: string | null;
    selectedKeys: number[] | null;
};

export enum QuestionSourceEnum {
    AI_Message = "ai_message",
    GUIDED_FLOW = "GUIDED_FLOW",
}

// ============================================
// Enums
// ============================================

export enum WeeklyCheckinState {
    PENDING = "PENDING", // Triggered by cron, not started by user
    ACTIVE = "ACTIVE", // User started the check-in
    COMPLETED = "COMPLETED", // User finished
    EXPIRED = "EXPIRED", // User didn't complete in time (optional)
}

export enum WeeklyCheckinErrorType {
    FLOW_NOT_FOUND = "FLOW_NOT_FOUND",
    INSTANCE_NOT_FOUND = "INSTANCE_NOT_FOUND",
    ALREADY_COMPLETED = "ALREADY_COMPLETED",
    WEEK_MISMATCH = "WEEK_MISMATCH",
    USER_NOT_FOUND = "USER_NOT_FOUND",
    INVALID_NODE = "INVALID_NODE",
    CONNECTION_ERROR = "CONNECTION_ERROR",
}

// ============================================
// Request/Response Types
// ============================================

export interface WeeklyCheckinSSEParams {
    userId: string;
    week: number;
    flowSlug: string;
}

export interface WeeklyCheckinAnswerParams {
    userId: string;
    flowInstanceId: string;
    nodeId: string;
    week: number;
    selectedKeys?: number[];
    freeText?: string;
    idempotencyKey?: string; // For idempotent answer submission
}

export interface WeeklyCheckinResponse {
    success: boolean;
    message: string;
    data?: {
        flowInstanceId?: string;
        week?: number;
        state?: WeeklyCheckinState;
        nextNodeId?: string;
    };
}

// ============================================
// Service Types
// ============================================

export interface IWeeklyCheckinContext {
    user: IUser;
    flowDefinition: IFlowDefinition;
    flowInstance: IFlowInstance;
    week: number;
    res: Response;
}

export interface IWeeklyCheckinQuestion {
    type: string;
    uuid?: string;
    id: string;
    flowInstanceId: string;
    week: number;
    text: string;
    educationalMessage?: string;
    whyThisMatters?: string;
    options: IWeeklyCheckinOption[];
    nodeType: string;
    askId: number;
}

export interface IWeeklyCheckinOption {
    id: string;
    label: string;
    value: string;
    score: number;
}

export interface IWeeklyCheckinEndPayload {
    type: "end_flow";
    text: string;
    flowType: FlowType;
    week: number;
}

// ============================================
// Cron Job Types
// ============================================

export interface WeeklyCheckinTriggerResult {
    userId: string;
    week: number;
    triggered: boolean;
    reason?: string;
    flowInstanceId?: string;
}

export interface WeeklyCheckinCronJobResult {
    processedUsers: number;
    triggeredCount: number;
    skippedCount: number;
    errorCount: number;
    results: WeeklyCheckinTriggerResult[];
}

// ============================================
// Validation Types
// ============================================

export interface WeeklyCheckinValidation {
    isValid: boolean;
    error?: {
        type: WeeklyCheckinErrorType;
        message: string;
    };
    flowInstance?: IFlowInstance;
}

// ============================================
// Node Eligibility Types
// ============================================

export interface NodeEligibilityResult {
    isEligible: boolean;
    reason?: string | undefined;
}

export interface NodeEligibilityContext {
    node: IFlowNode;
    week: number;
    isBreastfeeding: boolean;
    userId: string;
    flowInstance: IFlowInstance;
}
