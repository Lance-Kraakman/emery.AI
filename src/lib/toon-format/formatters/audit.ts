import type { AuditEvent } from '@/ddd/domain/audit/types';
import { escapeToonValue, type ToonConfig } from '../formatter';

/**
 * Format audit events to TOON format.
 *
 * Key fields only (default):
 * audit[10]{id,eventType,eventCategory,eventAction,actorType,actorName,resourceType,resourceName,occurredAt,success}:
 * 1,database,row_crud,create,agent,DataAgent,row,users-row-123,2024-01-16T10:30:00Z,true
 *
 * With metadata (?meta=1):
 * audit[10]{id,eventType,eventCategory,eventAction,actorType,actorName,resourceType,resourceName,occurredAt,success,actorId,resourceId,durationMs,error}:
 * 1,database,row_crud,create,agent,DataAgent,row,users-row-123,2024-01-16T10:30:00Z,true,agent-42,row-123,150,
 */
export function auditEventsToToon(events: AuditEvent[], config: ToonConfig = {}): string {
  const { includeMeta = false, maxItems = 50 } = config;

  const items = events.slice(0, maxItems);

  // Key fields for LLM consumption - most useful for understanding what happened
  const keyFields = [
    'id',
    'eventType',
    'eventCategory',
    'eventAction',
    'actorType',
    'actorName',
    'resourceType',
    'resourceName',
    'occurredAt',
    'success',
  ];
  const metaFields = includeMeta ? ['actorId', 'resourceId', 'durationMs', 'error'] : [];
  const fields = [...keyFields, ...metaFields];

  const header = `audit[${items.length}]{${fields.join(',')}}:`;

  const rows = items.map((e) => {
    const values: (string | number | boolean)[] = [
      e.id,
      escapeToonValue(e.eventType),
      escapeToonValue(e.eventCategory),
      escapeToonValue(e.eventAction),
      escapeToonValue(e.actorType),
      escapeToonValue(e.actorName || ''),
      escapeToonValue(e.resourceType),
      escapeToonValue(e.resourceName || ''),
      e.occurredAt?.toISOString() || '',
      e.success !== undefined ? e.success : '',
    ];
    if (includeMeta) {
      values.push(
        escapeToonValue(e.actorId || ''),
        escapeToonValue(e.resourceId || ''),
        e.durationMs ?? '',
        escapeToonValue(e.error || '')
      );
    }
    return values.join(',');
  });

  const result = [header, ...rows];

  if (events.length > maxItems) {
    result.push(`# truncated: ${events.length - maxItems} more`);
  }

  return result.join('\n');
}

export function auditEventToToon(event: AuditEvent, config: ToonConfig = {}): string {
  return auditEventsToToon([event], { ...config, includeMeta: true });
}
