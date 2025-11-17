import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_API_URL } from '../constants/urls';

const getToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('userToken');
};

const useApiInterceptor = (): AxiosInstance => {
  const apiInstance = axios.create({
    baseURL: BASE_API_URL,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  // retry logic with exponential backoff
  const retryOptions: IAxiosRetryConfig = {
    retries: 3,
    retryCondition: (err: AxiosError<any>) => {
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(err) ||
        err.response?.status === 429
      );
    },
    retryDelay: (retryCount: number, err: AxiosError<any>) => {
      if (err.response) {
        const retry_after = err.response.headers['retry-after'];
        if (retry_after) {
          return retry_after;
        }
      }
      return axiosRetry.exponentialDelay(retryCount);
    },
  };
  axiosRetry(apiInstance as any, retryOptions);
  apiInstance.interceptors.request.use(async config => {
    const token = await getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  });
  apiInstance.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Clear token
        await AsyncStorage.removeItem('userToken');
        // TODO: Navigate to the landing screen
      }

      return Promise.reject(error);
    },
  );
  return apiInstance;
};

export default useApiInterceptor;
