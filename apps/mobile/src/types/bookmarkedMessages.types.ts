export interface BackendAiMessage {
  _id: string;
  conversationId: string;
  userId: string;
  role: string;
  type: string;
  text: string;
  rich: any | null;
  attachments: any | null;
  ai: any | null;
  guided: any | null;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface BookmarkedMessage {
  _id: string;
  messageId: BackendAiMessage;
  userId: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface BookmarkedMessageResponse {
  data: BookmarkedMessage[];
  message: string;
  statusCode: number;
  success: boolean;
}
