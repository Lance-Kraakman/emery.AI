// AIDEV-NOTE: Barrel export for RAG value objects
// Centralizes value object exports for clean imports

export { RagIndexId } from './rag-index-id';
export { DocumentId } from './document-id';
export { OrganizationId } from './organization-id';
export { SearchQuery, type SimilarityMetric } from './search-query';

// Common types used across value objects
export type DomainType = 'table' | 'file' | 'agent' | 'team' | 'organization' | 'database';
export type IndexStatus = 'created' | 'building' | 'active' | 'error' | 'paused';
// AIDEV-NOTE: SourceType removed - use DomainType instead (they were duplicates)