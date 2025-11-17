import { jwtDecode } from 'jwt-decode';

interface JWTPayload {
  _id: string; // or userId, depending on your JWT structure
  email?: string;
  iat?: number;
  exp?: number;
}

export const decodeToken = (token: string): string | null => {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    return decoded._id || null; // Adjust field name based on your JWT structure
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};
