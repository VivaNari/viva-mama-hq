import { IExpert } from "./expert.types";
import { UserCategoryEnum } from "./user.types";

export interface IContent {
  id: number;
  title: string;
  author: string;
  thumbnailImage: number;
  isBookmarked: boolean;
  likes: number;
  comments: number;
  content: string;
}

export interface ISubCategory {
  id: number;
  subCategoryName: string;
  contents: IContent[];
}

export interface ICategory {
  id: number;
  categoryName: string;
  categoryThumbnailImage: number;
  categoryIcon: number;
  subCategories: ISubCategory[];
}

export interface IUserContentresponse {
  statusCode: number;
  success: boolean;
  data: IUserContent[];
  message: string;
}
export enum ContentGroupEnum {
  GLOBAL_HEALTH = "GLOBAL_HEALTH",
  WEEKLY_RECOVERY = "WEEKLY_RECOVERY",
}

export interface IUserContent {
  _id: string;
  featuredImage: string;
  featuredTitle: string;
  /** An article can serve several audiences, e.g. both PP and NP. */
  category: UserCategoryEnum[];
  contentGroup: ContentGroupEnum;
  authors: IExpert[];
  reviewers: IExpert[];
  /** Absent on locked items — the server strips the body rather than relying on the UI to hide it. */
  contentBody?: IContentBody[];
  /** Set by the server when the user's tier does not include this article. */
  isLocked?: boolean;
}

export enum ContentBodyTypeEnum {
  IMAGE = "IMAGE",
  HEADING = "HEADING",
  SUBHEADING = "SUBHEADING",
  PARAGRAPH = "PARAGRAPH",
  VIDEO = "VIDEO",
}

export interface IContentBody {
  _id: string;
  contentType: ContentBodyTypeEnum;
  body: string;
}
