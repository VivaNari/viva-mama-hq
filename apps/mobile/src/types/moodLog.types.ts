export enum EMood {
  EXTREMELY_SAD = 1,
  SAD = 2,
  NEUTRAL = 3,
  HAPPY = 4,
  EXTREMELY_HAPPY = 5,
}

export interface MoodLog {
  _id: string;
  userId: string;
  mood: EMood;
  logDate: string; // "YYYY-MM-DD"
  createdAt: string;
  updatedAt: string;
}

export interface MoodOption {
  value: EMood;
  label: string;
  emoji: string;
  color: string;
  caption: string;
  // Layout hints for the scattered "messy" bubble cluster.
  size: number;
  offsetY: number;
  rotate: number;
}

// Generic backend envelope: { data, message, success, statusCode }
export interface ApiEnvelope<T> {
  data: T;
  totalCount?: number;
  message: string;
  success: boolean;
  statusCode: number;
}
