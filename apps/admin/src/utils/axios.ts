import axios from 'axios';

import { CONFIG } from 'src/config-global';

// ----------------------------------------------------------------------

export const TOKEN_STORAGE_KEY = 'viva_admin_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

export const setStoredToken = (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token);

export const clearStoredToken = () => localStorage.removeItem(TOKEN_STORAGE_KEY);

// ----------------------------------------------------------------------

const axiosInstance = axios.create({ baseURL: CONFIG.serverUrl });

axiosInstance.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    // A dead or revoked token should drop the session rather than leave the panel
    // rendering an empty shell. The login call is exempt: a 401 there is a wrong
    // password, and redirecting away from /sign-in would hide the error message.
    const isLoginRequest = error?.config?.url?.includes('/auth/login');

    if ((status === 401 || status === 403) && !isLoginRequest) {
      clearStoredToken();

      if (window.location.pathname !== '/sign-in') {
        window.location.href = '/sign-in';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

/**
 * The API answers with two different envelopes: `{ errorMessage }` from the catch-all
 * error handler, and `{ message }` from handled failures such as a bad credential. Both
 * are worth showing verbatim, since the server names the specific cause.
 */
export function extractError(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { errorMessage?: string; message?: string }
      | undefined;

    return data?.errorMessage || data?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}
