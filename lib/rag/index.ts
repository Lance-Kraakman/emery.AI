/**
 * RAG module exports - RAG service, auto-reindex, and event-driven dispatcher
 */

export { ragService } from './service';
export { autoReindexService } from './auto-reindex';
export { ragDispatcher, type RagReindexRequest } from './dispatchers/rag-dispatcher';