/**
 * Database DTOs
 *
 * Data Transfer Objects for database domain operations.
 * Uses primitives at boundaries, Value Objects used internally by application services.
 */

// Re-export DatabaseDTO from mapper to avoid duplication
export type { DatabaseDTO } from '@/app/mappers/database-mapper';

/**
 * DTO for creating a new database
 */
export interface CreateDatabaseDTO {
  name: string;
  description?: string;
  organizationId: number;
  ownerId: string;
  metadata?: Record<string, any>;
}

/**
 * DTO for updating an existing database
 */
export interface UpdateDatabaseDTO {
  databaseId: number;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * DTO for filtering databases in queries
 */
export interface DatabaseFiltersDTO {
  organizationId: number;
  searchQuery?: string;
  hasTables?: boolean;
}
