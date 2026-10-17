import { API_UPDATE_USER_DATA } from "../constants/endpoints";
import { IUser } from "../types/user.types";
import apiClientInterceptor from "./apiClientInterceptor";

/**
 * Partial onboarding_data payload. Dates are sent as ISO strings; every field is
 * optional so the backend deep-merges only what's provided.
 */
export type OnboardingDataPatch = Partial<
  Omit<IUser["onboarding_data"], "date_of_birth" | "delivery_date" | "onboarded_at">
> & {
  date_of_birth?: string;
  delivery_date?: string;
};

export interface UpdateUserDataPayload {
  onboarding_data?: OnboardingDataPatch;
  email?: string;
  mobile_number?: string;
  country_code?: string;
}

/**
 * Persist a partial update to the user. The backend applies a dot-path `$set`
 * merge, so only the provided keys change. Throws on 4xx/5xx (e.g. 409 when an
 * email/phone is already in use) — callers should catch and inspect the error.
 */
export const updateUserData = async (payload: UpdateUserDataPayload) => {
  return (await apiClientInterceptor().put(API_UPDATE_USER_DATA, payload)).data;
};

/**
 * Persist the user's language choice on the backend. Once set, every localized
 * endpoint returns this language for the user, and server-initiated content
 * (push notifications, recommendation snapshots) uses it too.
 */
export const updatePreferredLanguage = async (preferred_language: string) => {
  return (
    await apiClientInterceptor().put(API_UPDATE_USER_DATA, {
      preferred_language,
    })
  ).data;
};
