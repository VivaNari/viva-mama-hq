import { Schema } from "mongoose";

export enum ChatModeEnum {
	MIXED = "MIXED",
	AI_ONLY = "AI_ONLY",
	GUIDED_ONLY = "GUIDED_ONLY"
};

export type ChatMode = ChatModeEnum.MIXED | ChatModeEnum.AI_ONLY | ChatModeEnum.GUIDED_ONLY;

export type Rating = 1 | 2 | 3 | 4 | 5;

export type Channel = "App";

export interface IConversation {
	_id: Schema.Types.ObjectId;
	userId: string;
	title: string;
	chatMode: ChatMode
	lastMessageAt: Date;
	meta: {
		channel: Channel;
		tags: string[];
	};
	rating: Rating;
	createdAt: Date;
	updatedAt: Date;
};

export enum MessageRoleEnum {
	USER = "USER",
	ASSITANT = "ASSISTANT"
};

export enum MessageTypeEnum {
	AI = "AI",
	GUIDED = "GUIDED",
	SYSTEM = "SYSTEM"
};
export enum AttachmentTypeEnum {
	IMAGE = "IMAGE",
	PDF = "PDF",
	AUDIO = "AUDIO"
};
export enum ProviderEnum {
	OPENAI = "OPENAI",
	GROQ = "GROQ",
	LOCAL = "LOCAL"
};
export type MessageRole = MessageRoleEnum.USER | MessageRoleEnum.ASSITANT;
export type MessageType = MessageTypeEnum.AI | MessageTypeEnum.GUIDED | MessageTypeEnum.SYSTEM;
export type AttachmentType = AttachmentTypeEnum.AUDIO | AttachmentTypeEnum.IMAGE | AttachmentTypeEnum.PDF;
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
};

export enum FlowDefinitionStatusEnum {
	DRAFT = "DRAFT",
	PUBLISHED = "PUBLISHED",
	ARCHIVED = "ARCHIVED"
};
export type FlowDefinitionStatus = FlowDefinitionStatusEnum.ARCHIVED | FlowDefinitionStatusEnum.DRAFT | FlowDefinitionStatusEnum.PUBLISHED;

export enum FlowNodeEnum {
	QUESTION_SINGLE = "QUESTION_SINGLE",
	QUESTION_MULTI = "QUESTION_MULTI",
	INFO = "INFO",
	BRANCH = "BRANCH",
	CALC = "CALC",
	END = "END"
};

export type FlowNodeType =
  | FlowNodeEnum.QUESTION_SINGLE
  | FlowNodeEnum.QUESTION_MULTI
  | FlowNodeEnum.INFO
  | FlowNodeEnum.BRANCH
  | FlowNodeEnum.CALC
  | FlowNodeEnum.END;

export interface IFlowNode {
	id: string;                         
	type: FlowNodeType;
	text: string | null;                      
	options: Array<{
		key: string;
		label: string;
		value?: any;                      
	}>;
	branch: Array<{
		when: { var: string; op: "eq" | "gt" | "lt" | "in"; val: any };
		goTo: string;                     
	}> | null;
	calc: Array<{ set: string; expr: string }> | null;
	next: string | null;                      
};

export interface IFlowDefinition {
	_id: Schema.Types.ObjectId;
	slug: string;                       // e.g. "breastfeeding-pain-v1"
	name: string;
	version: number;
	status: FlowDefinitionStatus;
	startNodeId: string;
	nodes: IFlowNode[];
	outcomes: Array<{
		key: string;                      // e.g. "mild_pain"
		title: string;
		summary: string;
		recommendations: string[];
		nextAction: string | null;
	}>;
	createdBy: Schema.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
};

export enum FlowInstanceStateEnum {
	ACTIVE = "ACTIVE",
	COMPLETED = "COMPLETED",
	ABORTED = "ABORTED"
};
export type FlowInstanceState = FlowInstanceStateEnum.ACTIVE | FlowDefinitionStatusEnum.DRAFT | FlowDefinitionStatusEnum.PUBLISHED;

export interface IFlowInstance {
	_id: Schema.Types.ObjectId;
	userId: Schema.Types.ObjectId;
	conversationId: Schema.Types.ObjectId;
	flowDefId: Schema.Types.ObjectId;
	flowSlug: string;
	version: number;
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
};

export enum AnswerTypeEnum {
	SINGLE = "SINGLE",
	MULTI = "MULTI",
	FREE = "FREE"
};
export type AnswerType = AnswerTypeEnum.SINGLE | AnswerTypeEnum.MULTI | AnswerTypeEnum.FREE;

export interface IFlowResponse {
	_id: Schema.Types.ObjectId;
	flowInstanceId: Schema.Types.ObjectId;
	nodeId: string;
	answer: {
		type: AnswerType;
		selectedKeys: string[] | null;
		freeText: string | null;
	};
	computed: Record<string, any> | null; 
	createdAt: Date;
	updatedAt: Date;
};

