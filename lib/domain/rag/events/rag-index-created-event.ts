// AIDEV-NOTE: Domain event for RAG index creation
// Triggers automatic indexing when a new RAG index is created

import { RagIndexId, OrganizationId, type DomainType } from '../value-objects';

export interface RagIndexCreatedEvent {
  readonly eventType: 'RagIndexCreated';
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: RagIndexId;
  readonly data: {
    indexId: RagIndexId;
    organizationId: OrganizationId;
    name: string;
    domainTypes: DomainType[];
    createdBy: string;
  };
}

export function createRagIndexCreatedEvent(
  indexId: RagIndexId,
  organizationId: OrganizationId,
  name: string,
  domainTypes: DomainType[],
  createdBy: string
): RagIndexCreatedEvent {
  return {
    eventType: 'RagIndexCreated',
    eventId: crypto.randomUUID(),
    occurredAt: new Date(),
    aggregateId: indexId,
    data: {
      indexId,
      organizationId,
      name,
      domainTypes: [...domainTypes],
      createdBy
    }
  };
}