import { USER_CONTENT_URL } from '../constants/endpoints';
import apiClientInterceptor from './apiClientInterceptor';

export const getUserContentById = async (articleId: string) => {
  return (await apiClientInterceptor().get(USER_CONTENT_URL(articleId))).data;
};
