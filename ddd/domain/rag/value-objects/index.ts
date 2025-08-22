export { RagIndexId } from './rag-index-id';
export { DocumentId } from './document-id';
export { OrganizationId } from './organization-id';
export { SearchQuery, type SimilarityMetric } from './search-query';

// RAG data transfer value objects removed - use domain entities directly for internal operations
// Value objects are only needed for external API boundaries

// Common types used across value objects
export type DomainType = 'table' | 'file' | 'agent' | 'team' | 'organization' | 'database';
export type IndexStatus = 'created' | 'building' | 'active' | 'error' | 'paused';