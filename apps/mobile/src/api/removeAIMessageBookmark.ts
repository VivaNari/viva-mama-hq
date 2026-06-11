import { ADD_AI_MESSAGE_BOOKMARK } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const removeAIMessageBookmark = async (messageId: string) => {
  return (
    await apiClientInterceptor().delete(ADD_AI_MESSAGE_BOOKMARK, {
      data: { messageId },
    })
  ).data;
};
