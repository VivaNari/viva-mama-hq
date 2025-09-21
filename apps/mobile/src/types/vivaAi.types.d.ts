export interface IMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

export interface IVivaAIData {
  id: number;
  userQuery: string;
  aiResponse: string;
}
