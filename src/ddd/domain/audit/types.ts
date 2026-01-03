/**
 * Audit Trail Domain Types
 */

export type AuditEventType = 'database' | 'agent' | 'skill' | 'app' | 'security' | 'billing';
export type AuditActorType = 'user' | 'agent' | 'system' | 'webhook' | 'public_app';

export interface AuditEventData {
  eventType: AuditEventType;
  eventCategory: string;
  eventAction: string;
  actorType: AuditActorType;
  actorId?: string;
  actorName?: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  parentResourceType?: string;
  parentResourceId?: string;
  eventData: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  durationMs?: number;
  success?: boolean;
  error?: string;
}

export interface AuditEvent extends AuditEventData {
  id: number;
  organizationId: number;
  occurredAt: Date;
  expiresAt?: Date;
  archivedAt?: Date;
}

export interface RowHistoryEntry {
  id: number;
  organizationId: number;
  tableId: number;
  rowId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  version: number;
  fieldChanges?: Record<string, { old: unknown; new: unknown }>;
  rowSnapshot?: Record<string, unknown>;
  changedByType: AuditActorType;
  changedById?: string;
  changedByName?: string;
  changedAt: Date;
  expiresAt?: Date;
}

export interface TaskToolCall {
  id: number;
  taskId: string;
  organizationId: number;
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  toolError?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  callIndex: number;
  tokensUsed: number;
}

export interface AuditQueryFilters {
  eventType?: AuditEventType;
  eventCategory?: string;
  actorType?: AuditActorType;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}
