import { BASE_API_URL as RN_BASE_API_URL, API_VERSION } from '@env';

export const BASE_API_URL = RN_BASE_API_URL;
export const API_VERSION_URL = `/api/${API_VERSION}`;
export const API_GOOGLE_LOGIN = `${API_VERSION_URL}/auth/google`;
export const API_REQUEST_PHONE_OTP = `${API_VERSION_URL}/auth/send-otp`;
export const API_VERIFY_OTP = `${API_VERSION_URL}/auth/verify-otp`;
