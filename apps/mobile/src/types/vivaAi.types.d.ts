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
