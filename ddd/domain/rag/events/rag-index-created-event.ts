// AIDEV-NOTE: Domain event for RAG index creation
// Triggers automatic indexing when a new RAG index is created

import { BaseDomainEvent, createBaseDomainEvent } from '@/ddd/domain/shared/events/base-domain-event';
import { RagIndexId, OrganizationId, type DomainType } from '../value-objects';

export interface RagIndexCreatedEvent extends BaseDomainEvent {
  readonly eventType: 'RagIndexCreated';
  readonly aggregateType: 'RagIndex';
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
    ...createBaseDomainEvent(
      'RagIndexCreated',
      indexId.value,
      'RagIndex',
      {
        indexId,
        organizationId,
        name,
        domainTypes: [...domainTypes],
        createdBy
      }
    ),
    eventType: 'RagIndexCreated',
    aggregateType: 'RagIndex'
  } as RagIndexCreatedEvent;
}