/**
 * Shared Repository Interfaces
 *
 * Base interfaces for DDD repository pattern.
 * Domain-specific repositories extend these interfaces.
 */

export type {
  IBaseCRUDRepository,
  IOrganizationScopedRepository,
  IOwnerScopedRepository,
  IAgentScopedRepository,
  IReadOnlyRepository,
} from './base-repository';
