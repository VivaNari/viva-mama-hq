/**
 * Local re-export of the shared API contract.
 *
 * Import shared endpoint paths and domain types from here (or directly from
 * `@vivamama/contracts`) instead of redefining them. This module is the seam
 * for incrementally migrating the inline types in `src/types/` onto the shared
 * contract — see MIGRATION_NOTES.md.
 *
 * @example
 *   import { apiRoutes, type VivaRecoveryScore } from '../shared/contracts';
 */
export * from '@vivamama/contracts';
