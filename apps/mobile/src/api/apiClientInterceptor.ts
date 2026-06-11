import axios, { AxiosInstance, AxiosError } from "axios";
import axiosRetry, { IAxiosRetryConfig } from "axios-retry";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_API_URL } from "../constants/endpoints";

/**
 * In-memory token cache
 * (prevents AsyncStorage hit per request)
 */
let authToken: string | null = null;
let tokenInitialized = false;

const initTokenIfNeeded = async () => {
  if (!tokenInitialized) {
    authToken = await AsyncStorage.getItem("userToken");
    tokenInitialized = true;
  }
};

/**
 * SINGLETON INSTANCE
 */
let apiInstance: AxiosInstance | null = null;

const apiClientInterceptor = (): AxiosInstance => {
  // 👉 Return existing instance if already created
  if (apiInstance) {
    return apiInstance;
  }

  apiInstance = axios.create({
    baseURL: BASE_API_URL,
    timeout: 15000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  /**
   * RETRY CONFIG
   */
  const retryOptions: IAxiosRetryConfig = {
    retries: 5,
    retryCondition: (err: AxiosError) =>
      err.response?.status !== 200,

    retryDelay: (retryCount, err) => {
      const retryAfter = 1000;
      if (retryAfter) {
        return Number(retryAfter) * 1000; // seconds → ms
      }
      return axiosRetry.exponentialDelay(retryCount);
    },
  };

  axiosRetry(apiInstance as any, retryOptions);

  /**
   * REQUEST INTERCEPTOR
   */
  apiInstance.interceptors.request.use(
    async config => {
      authToken = await AsyncStorage.getItem("userToken");
      tokenInitialized = true;

      const isBackendRequest = config.baseURL?.includes(BASE_API_URL);

      if (authToken && isBackendRequest) {
        config.headers.Authorization = `Bearer ${authToken}`;
      }

      if (__DEV__) {
        console.log(
          `[API] ${config.method?.toUpperCase()} ${config.baseURL}${
            config.url
          }`,
        );
      }

      return config;
    },
    error => Promise.reject(error),
  );

  /**
   * RESPONSE INTERCEPTOR
   */
  apiInstance.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        authToken = null;
        tokenInitialized = true;
        await AsyncStorage.removeItem("userToken");
        // navigate to login if needed
      }
      return Promise.reject(error);
    },
  );

  return apiInstance;
};

export default apiClientInterceptor;
