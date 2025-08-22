// AIDEV-NOTE: Domain event for data changes requiring RAG reindexing
// Represents database changes that should trigger RAG index updates

import { OrganizationId, type DomainType } from '../value-objects';

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface DataChangeEvent {
  readonly eventType: 'DataChange';
  readonly eventId: string;
  readonly occurredAt: Date;
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
    eventType: 'DataChange',
    eventId: crypto.randomUUID(),
    occurredAt: new Date(),
    data: {
      organizationId,
      domainType,
      changeType,
      sourceId,
      tableName: options?.tableName,
      metadata: options?.metadata ? { ...options.metadata } : undefined
    }
  };
}