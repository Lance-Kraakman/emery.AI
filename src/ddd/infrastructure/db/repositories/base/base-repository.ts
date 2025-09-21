import { BaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { DbClient } from '@/lib/db/client';

/**
 * Base repository abstract class providing standard CRUD operations
 * All repositories should extend this or DrizzleBaseRepository
 */
export abstract class BaseRepository<
  TEntity,
  TId extends { value: string | number },
  TCreateData,
  TUpdateData
> {
  constructor(protected readonly db: DbClient) {}
  
  // Core CRUD operations - must be implemented by all repositories
  abstract create(data: TCreateData): Promise<TEntity>;
  abstract update(id: TId, data: TUpdateData): Promise<TEntity>;
  abstract findById(id: TId): Promise<TEntity | null>;
  abstract delete(id: TId): Promise<void>;
  
  // Common pattern for organization-scoped entities - optional
  abstract findByOrganization?(orgId: OrganizationId): Promise<TEntity[]>;
}