import { GET_AI_MESSAGE_BOOKMARKS } from "../constants/endpoints";
import { BookmarkedMessageResponse } from "../types/bookmarkedMessages.types";
import apiClientInterceptor from "./apiClientInterceptor";

export const getAIMessageBookmarks =
  async (): Promise<BookmarkedMessageResponse> => {
    return (await apiClientInterceptor().get(GET_AI_MESSAGE_BOOKMARKS)).data;
  };
