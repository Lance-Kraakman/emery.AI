// AIDEV-NOTE: Essential RAG domain service exports only
// Simplified export for commonly used service interfaces

export type { IndexingDomainService as IIndexingDomainService } from './indexing-domain-service';
export type { SearchDomainService as ISearchDomainService } from './search-domain-service';
export type { ContentProcessor } from './content-processor';

// These might be used by other services
export type { EmbeddingGenerator } from './indexing-domain-service';
export type { SearchLogger } from './search-domain-service';

// Export concrete classes that are needed by DI container
export { IndexingDomainService } from './indexing-domain-service';
export { SearchDomainService } from './search-domain-service';