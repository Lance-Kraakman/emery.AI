// AIDEV-NOTE: Repository interface for RAG indexes
// Defines data access patterns without implementation details

import { RagIndex } from '../entities';
import { RagIndexId, OrganizationId } from '../value-objects';

export interface RagIndexFilters {
  organizationId?: OrganizationId;
  agentId?: number;
  status?: string[];
  domainTypes?: string[];
}

export interface RagIndexRepository {
  /**
   * Find a RAG index by its unique identifier
   */
  findById(id: RagIndexId): Promise<RagIndex | null>;

  /**
   * Find RAG indexes by organization
   */
  findByOrganization(organizationId: OrganizationId): Promise<RagIndex[]>;

  /**
   * Find RAG indexes by agent
   */
  findByAgent(agentId: number): Promise<RagIndex[]>;

  /**
   * Find RAG indexes with complex filters
   */
  findByFilters(filters: RagIndexFilters): Promise<RagIndex[]>;

  /**
   * Check if an index exists by ID
   */
  exists(id: RagIndexId): Promise<boolean>;

  /**
   * Check if an index name is unique within an organization
   */
  isNameUnique(organizationId: OrganizationId, name: string, excludeId?: RagIndexId): Promise<boolean>;

  /**
   * Save a new RAG index
   */
  save(index: RagIndex): Promise<void>;

  /**
   * Update an existing RAG index
   */
  update(index: RagIndex): Promise<void>;

  /**
   * Delete a RAG index
   */
  delete(id: RagIndexId): Promise<void>;

  /**
   * Get total count of indexes for an organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;

  /**
   * Get indexes that need reindexing (error or stale status)
   */
  findIndexesNeedingReindexing(): Promise<RagIndex[]>;
}