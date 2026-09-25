export interface IUser {
  _id: string;
  user_name: string;
  profile_picture?: string;
  avatar?: any; // Fallback for dummy data
}

/** Mirrors EReportTargetType on the server. AI_MESSAGE is reserved for B5. */
export type ReportTargetType =
  | "VIVA_CLUB_POST"
  | "VIVA_CLUB_COMMENT"
  | "AI_MESSAGE";

/** Mirrors EReportReason on the server; this order is the order shown to users. */
export type ReportReason =
  | "HARASSMENT"
  | "HATE"
  | "SEXUAL"
  | "MISINFORMATION"
  | "SELF_HARM"
  | "SPAM"
  | "HARMFUL_ADVICE"
  | "OTHER";

export interface IComment {
  _id: string;
  user: IUser;
  content: string;
  createdAt: string;
  /** Set by the server: whether the signed-in user wrote this, and so may delete it. */
  isOwn?: boolean;
}

export interface IVivaClubPost {
  _id: string;
  user: IUser;
  content: string;
  isLiked: boolean;
  totalLikes: number;
  commentCount: number;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  comments?: IComment[];
  isOwn?: boolean;
}
