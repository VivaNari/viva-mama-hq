import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'userToken';

let authToken: string | null = null;

/**
 * Load token once on app start
 */
export const initAuthToken = async () => {
  authToken = await AsyncStorage.getItem(TOKEN_KEY);
};

/**
 * Get token from memory (FAST)
 */
export const getAuthToken = (): string | null => {
  return authToken;
};

/**
 * Set token (login / refresh)
 */
export const setAuthToken = async (token: string | null) => {
  authToken = token;

  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
};
