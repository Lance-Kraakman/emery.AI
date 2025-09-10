// AIDEV-NOTE: Repository interface for RAG indexes
// Defines data access patterns without implementation details

import { RagIndex } from '../entities';
import { RagIndexId, OrganizationId, type DomainType, type IndexStatus } from '../value-objects';

export interface RagIndexFilters {
  organizationId?: OrganizationId;
  agentId?: number;
  status?: string[];
  domainTypes?: string[];
}

// Data transfer objects for repository operations
export interface CreateRagIndexData {
  id: string;
  organizationId: number;
  name: string;
  description?: string;
  agentId?: number;
  domainTypes: DomainType[];
  domainFilters?: Record<string, any>;
  embeddingModel: string;
  embeddingDimensions: number;
  status: IndexStatus;
  documentCount: number;
  createdAt: Date;
  lastIndexedAt?: Date;
}

export interface UpdateRagIndexData {
  name?: string;
  description?: string;
  domainTypes?: DomainType[];
  domainFilters?: Record<string, any>;
  status?: IndexStatus;
  documentCount?: number;
  lastIndexedAt?: Date;
}

export interface RagIndexRepository {
  /**
   * Create a new RAG index
   */
  create(data: CreateRagIndexData): Promise<RagIndex>;

  /**
   * Update an existing RAG index
   */
  update(id: RagIndexId, data: UpdateRagIndexData): Promise<RagIndex>;

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