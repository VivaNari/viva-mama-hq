import { API_UPDATE_USER_DATA } from "../constants/endpoints";
import apiClientInterceptor from "./apiClientInterceptor";

export const updateUserData = async ({
  preferred_name,
  location,
  date_of_birth,
}: {
  preferred_name: string;
  location: string;
  date_of_birth: string;
}) => {
  return (
    await apiClientInterceptor().put(API_UPDATE_USER_DATA, {
      onboarding_data: {
        preferred_name,
        location,
        date_of_birth,
      },
    })
  ).data;
};
