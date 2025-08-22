// AIDEV-NOTE: Barrel export for RAG value objects
// Centralizes value object exports for clean imports

export { RagIndexId } from './rag-index-id';
export { DocumentId } from './document-id';
export { OrganizationId } from './organization-id';
export { SearchQuery, type SimilarityMetric } from './search-query';

// Common types used across value objects
export type DomainType = 'tables' | 'files' | 'agents' | 'teams' | 'workflows' | 'organizations' | 'databases';
export type IndexStatus = 'created' | 'building' | 'active' | 'error' | 'paused';
export type SourceType = 'table' | 'file' | 'agent' | 'team' | 'workflow' | 'organization' | 'database';