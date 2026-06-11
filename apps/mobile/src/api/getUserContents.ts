import { USER_CONTENTS } from '../constants/endpoints';
import apiClientInterceptor from './apiClientInterceptor';

export const getUserContents = async () => {
  return (await apiClientInterceptor().get(USER_CONTENTS)).data;
};
