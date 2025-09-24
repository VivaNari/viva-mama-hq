export interface IUser {
  name: string;
  avatar: number;
}

export interface IComment {
  user: IUser;
  content: string;
}

export interface IVivaClubPost {
  id: number;
  user: IUser;
  content: string;
  isLiked: boolean;
  isBookMarked: boolean;
  totalLikes: string;
  publishedDateTime: string;
  comments: IComment[];
}
