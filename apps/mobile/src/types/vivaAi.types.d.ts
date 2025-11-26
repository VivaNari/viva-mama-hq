export interface IMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  options?: IOption[];
}

export interface IVivaAIData {
  id: number;
  userQuery: string;
  aiResponse: string;
  followUpSet?: IFollowUpSet;
}

export interface IFollowUpSet {
  note: string;
  followUps: IFollowUps[];
}

enum EQuestionType {
  SELECT = 'select',
  TEXT = 'text',
}

export interface IOption {
  id: string;
  label: string;
  value: string;
  score: number;
}

export interface IFollowUpQuestion {
  question: string;
  questionType: questionType;
  options: IOption[];
}

interface IAiMessage {
  type: 'ai';
  id: string;
  text: string;
  options: IOption[];
}

interface IUserMessage {
  type: 'user';
  text: string;
}

type ChatMessage = IAiMessage | IUserMessage;

export type NodeType = 'QUESTION_SINGLE' | 'QUESTION_MULTI' | 'INFO';

// Types for SQLite rows
export interface IDBChatMessageRow {
  id: number;
  user_id: string;
  flow_slug: string;
  message_type: 'ai' | 'user';
  message_id: string | null;
  flow_instance_id: string | null;
  text: string;
  educational_message: string | null;
  why_this_matters: string | null;
  options: string | null;
  node_type: string | null;
  timestamp: number;
  created_at: string;
  uuid: string;
}

export interface IDBAiMessage {
  type: 'ai';
  id: string;
  flowInstanceId: string;
  text: string;
  educationalMessage?: string;
  whyThisMatters?: string;
  options: Array<{ id: string; label: string; value: any; score: number }>;
  nodeType?: NodeType;
  timestamp: number;
  uuid: string;
}

export interface IDBUserMessage {
  type: 'user';
  text: string;
  timestamp: number;
}

export type IDBChatMessage = IDBAiMessage | IDBUserMessage;
