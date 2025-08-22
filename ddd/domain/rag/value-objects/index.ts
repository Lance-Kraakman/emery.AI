export { RagIndexId } from './rag-index-id';
export { DocumentId } from './document-id';
export { OrganizationId } from './organization-id';
export { SearchQuery, type SimilarityMetric } from './search-query';

// RAG data transfer value objects
export {
  OrganizationDataSnapshot,
  TableDataSnapshot,
  FieldDataSnapshot,
  DatabaseDataSnapshot,
  AgentDataSnapshot,
  TeamDataSnapshot,
  FileDataSnapshot
} from './data-snapshots';

// Common types used across value objects
export type DomainType = 'table' | 'file' | 'agent' | 'team' | 'organization' | 'database';
export type IndexStatus = 'created' | 'building' | 'active' | 'error' | 'paused';