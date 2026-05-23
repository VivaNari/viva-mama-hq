export interface IUser {
  _id: string;
  user_name: string;
  profile_picture?: string;
  avatar?: any; // Fallback for dummy data
}

export interface IComment {
  _id: string;
  user: IUser;
  content: string;
  createdAt: string;
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
}
