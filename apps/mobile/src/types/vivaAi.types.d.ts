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
  id: number;
  label: string;
  value: number;
}

export interface IFollowUpQuestion {
  question: string;
  questionType: questionType;
  options: IOption[];
}
