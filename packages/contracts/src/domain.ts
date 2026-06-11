/**
 * Core VivaMama domain types shared across services.
 *
 * These mirror the backend Score Engine and Recommendation Engine and the
 * shapes the mobile dashboard renders. They are intentionally minimal and
 * framework-agnostic; treat this file as the contract that the backend
 * implementation and the app UI both converge on.
 */

/** The three recovery categories scored for every check-in. */
export type ScoreCategory = 'physical' | 'lactation' | 'emotional';

export const SCORE_CATEGORIES: readonly ScoreCategory[] = [
  'physical',
  'lactation',
  'emotional',
] as const;

/** Recovery "zone" a score falls into (drives messaging and recommendations). */
export type ScoreZone = 'red' | 'amber' | 'green';

/** A single category's contribution to the overall score. */
export interface CategoryScore {
  category: ScoreCategory;
  /** Raw score before weighting. */
  raw: number;
  /** Weighted score used for the overall total. */
  weighted: number;
  zone: ScoreZone;
}

/** The Viva Recovery Score for one check-in. */
export interface VivaRecoveryScore {
  /** Postpartum week the score was computed for. */
  week: number;
  /** Overall (weighted, normalized) recovery score. */
  overall: number;
  overallZone: ScoreZone;
  categories: CategoryScore[];
  /** Category most in need of attention; surfaced as the focus area. */
  weakestCategory: ScoreCategory;
  computedAt: string; // ISO-8601
}

/** A personalized recommendation produced by the Recommendation Engine. */
export interface Recommendation {
  id: string;
  category: ScoreCategory;
  week: number;
  zone: ScoreZone;
  title: string;
  body: string;
  /** Optional linked content / product / expert ids. */
  contentIds?: string[];
  productIds?: string[];
  expertIds?: string[];
}

/** Standard success envelope returned by the API. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** Standard error envelope returned by the API. */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    correlationId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
