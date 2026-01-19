import { ADD_AI_MESSAGE_BOOKMARK } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const addAIMessageBookmark = async (messageId: string) => {
  return (
    await apiClientInterceptor().post(ADD_AI_MESSAGE_BOOKMARK, {
      messageId,
    })
  ).data;
};
