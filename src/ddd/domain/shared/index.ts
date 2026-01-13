/**
 * Shared Domain Types and Utilities
 *
 * Common types and utilities used across all domain boundaries.
 */

export type { Result } from './result';
export {
  ResultHelpers,
  isSuccess,
  isFailure,
  hasValidationErrors,
  hasWarnings
} from './result';

// Base repository interfaces
export type {
  IBaseCRUDRepository,
  IOrganizationScopedRepository,
  IOwnerScopedRepository,
  IAgentScopedRepository,
  IReadOnlyRepository,
} from './repositories';