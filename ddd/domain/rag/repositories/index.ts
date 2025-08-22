// AIDEV-NOTE: Barrel export for RAG repository interfaces
// Centralizes repository exports for clean imports

export { 
  type RagIndexRepository, 
  type RagIndexFilters 
} from './rag-index-repository';

export { 
  type RagDocumentRepository,
  type DocumentFilters,
  type VectorSearchParams,
  type VectorSearchResult,
  type DocumentSyncResult
} from './rag-document-repository';

export {
  type RagQueryLogRepository,
  type QueryLogEntry,
  type QueryAnalytics
} from './rag-query-log-repository';

// OrganizationDataRepository and data interfaces removed
// Use domain entities directly instead of intermediate data interfaces