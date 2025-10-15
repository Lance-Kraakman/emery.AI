// AIDEV-NOTE: Domain event for data changes requiring RAG reindexing
// Represents database changes that should trigger RAG index updates

import { BaseDomainEvent, createBaseDomainEvent } from '@/ddd/domain/shared/events/base-domain-event';
import { OrganizationId, type DomainType } from '../value-objects';

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface DataChangeEvent extends BaseDomainEvent {
  readonly eventType: 'DataChange';
  readonly aggregateType: 'DataChange';
  readonly data: {
    organizationId: OrganizationId;
    domainType: DomainType;
    changeType: ChangeType;
    sourceId: string;
    tableName?: string;
    metadata?: Record<string, any>;
  };
}

export function createDataChangeEvent(
  organizationId: OrganizationId,
  domainType: DomainType,
  changeType: ChangeType,
  sourceId: string,
  options?: {
    tableName?: string;
    metadata?: Record<string, any>;
  }
): DataChangeEvent {
  return {
    ...createBaseDomainEvent(
      'DataChange',
      sourceId,
      'DataChange',
      {
        organizationId,
        domainType,
        changeType,
        sourceId,
        tableName: options?.tableName,
        metadata: options?.metadata ? { ...options.metadata } : undefined
      }
    ),
    eventType: 'DataChange',
    aggregateType: 'DataChange'
  } as DataChangeEvent;
}