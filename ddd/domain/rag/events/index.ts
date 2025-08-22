// AIDEV-NOTE: Barrel export for RAG domain events
// Centralizes event exports for clean imports

export { 
  type RagIndexCreatedEvent,
  createRagIndexCreatedEvent 
} from './rag-index-created-event';

export { 
  type DataChangeEvent,
  type ChangeType,
  createDataChangeEvent 
} from './data-change-event';

// Common event interface
export interface DomainEvent {
  readonly eventType: string;
  readonly eventId: string;
  readonly occurredAt: Date;
}