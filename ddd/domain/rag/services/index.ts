// AIDEV-NOTE: Barrel export for RAG domain services
// Centralizes domain service exports for clean imports

export { 
  IndexingDomainService,
  type IndexingResult
} from './indexing-domain-service';

export { 
  type ContentProcessor,
  type ProcessedContent,
  type ContentProcessingConfig,
  type FileProcessingContext
} from './content-processor';

export { 
  SearchDomainService,
  type SearchResult,
  type SearchFilters,
  type EmbeddingGenerator,
  type SearchLogger
} from './search-domain-service';

// OrganizationDataService removed - eliminated redundant aggregation layer
// Application services now call repositories directly