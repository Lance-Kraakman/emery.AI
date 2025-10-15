// AIDEV-NOTE: Essential RAG domain exports only
// Simplified imports - use direct paths for better clarity

// Core entities
export { RagIndex } from './entities/rag-index';
export { RagDocument } from './entities/rag-document';

// Core value objects
export { RagIndexId } from './value-objects/rag-index-id';
export { DocumentId } from './value-objects/document-id';
export { SearchQuery } from './value-objects/search-query';

// Repository interfaces
export type { RagIndexRepository } from './repositories/rag-index-repository';
export type { RagDocumentRepository } from './repositories/rag-document-repository';

// Core domain services
export type { IndexingDomainService } from './services/indexing-domain-service';
export type { SearchDomainService } from './services/search-domain-service';