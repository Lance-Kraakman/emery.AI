/**
 * Row Audit Logging Helpers
 *
 * Encapsulates audit logging logic for row operations.
 * Uses non-blocking writes via AuditApplicationService.
 *
 * NOTE: This is NOT a Server Actions file - these are internal helpers
 * called from server-side code only (rows.ts, etc.)
 */

import { getAuditApplicationService } from '@/ddd/application/di/container';
import type { OrganizationId } from '@/ddd/domain/shared/value-objects';

// ============================================================================
// Types
// ============================================================================

// Actor types that can make row changes (subset of AuditActorType - excludes 'system')
export type RowChangeActorType = 'user' | 'agent' | 'webhook' | 'public_app';

export interface AuditActor {
  type: RowChangeActorType;
  id: string;
  name?: string;
}

export interface RowAuditContext {
  organizationId: number;
  tableId: number;
  tableName: string;
  actor: AuditActor;
}

export interface RowChangeData {
  rowId: string;
  rowSnapshot: Record<string, unknown>;
  fieldChanges?: Record<string, { old: unknown; new: unknown }>;
  previousData?: Record<string, unknown>;
}

// ============================================================================
// Field Change Computation
// ============================================================================

/**
 * Compute field-level changes between old and new row data
 * Returns only fields that actually changed
 */
export function computeFieldChanges(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  const allKeys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);

  for (const key of allKeys) {
    // Skip id field - it never changes
    if (key === 'id') continue;

    const oldValue = oldRow[key];
    const newValue = newRow[key];

    // Use JSON stringify for deep comparison
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = { old: oldValue, new: newValue };
    }
  }

  return changes;
}

// ============================================================================
// Audit Logging Functions
// ============================================================================

/**
 * Log a row creation event
 * Non-blocking - failures don't affect the main operation
 */
export function logRowCreate(
  context: RowAuditContext,
  data: { rowId: string; rowSnapshot: Record<string, unknown> }
): void {
  const auditService = getAuditApplicationService();

  // Log to row_history table
  auditService.logRowChange(
    { value: context.organizationId } as OrganizationId,
    context.tableId,
    data.rowId,
    'INSERT',
    {
      rowSnapshot: data.rowSnapshot,
      changedByType: context.actor.type,
      changedById: context.actor.id,
      changedByName: context.actor.name,
    }
  );

  // Log to audit_events table
  auditService.logEvent(
    { value: context.organizationId } as OrganizationId,
    {
      eventType: 'database',
      eventCategory: 'row_crud',
      eventAction: 'create',
      actorType: context.actor.type,
      actorId: context.actor.id,
      actorName: context.actor.name,
      resourceType: 'row',
      resourceId: data.rowId,
      parentResourceType: 'table',
      parentResourceId: String(context.tableId),
      eventData: { tableName: context.tableName },
      success: true,
    }
  );
}

/**
 * Log a row update event
 * Only logs if there are actual field changes
 * Non-blocking - failures don't affect the main operation
 */
export function logRowUpdate(
  context: RowAuditContext,
  data: RowChangeData
): void {
  // Skip if no field changes
  if (!data.fieldChanges || Object.keys(data.fieldChanges).length === 0) {
    return;
  }

  const auditService = getAuditApplicationService();
  const changedFields = Object.keys(data.fieldChanges);

  // Log to row_history table
  auditService.logRowChange(
    { value: context.organizationId } as OrganizationId,
    context.tableId,
    data.rowId,
    'UPDATE',
    {
      fieldChanges: data.fieldChanges,
      rowSnapshot: data.rowSnapshot,
      changedByType: context.actor.type,
      changedById: context.actor.id,
      changedByName: context.actor.name,
    }
  );

  // Log to audit_events table
  auditService.logEvent(
    { value: context.organizationId } as OrganizationId,
    {
      eventType: 'database',
      eventCategory: 'row_crud',
      eventAction: 'update',
      actorType: context.actor.type,
      actorId: context.actor.id,
      actorName: context.actor.name,
      resourceType: 'row',
      resourceId: data.rowId,
      parentResourceType: 'table',
      parentResourceId: String(context.tableId),
      eventData: { tableName: context.tableName, changedFields },
      previousData: data.previousData,
      success: true,
    }
  );
}

/**
 * Log a row deletion event
 * Non-blocking - failures don't affect the main operation
 */
export function logRowDelete(
  context: RowAuditContext,
  data: { rowId: string; rowSnapshot: Record<string, unknown> }
): void {
  const auditService = getAuditApplicationService();

  // Log to row_history table
  auditService.logRowChange(
    { value: context.organizationId } as OrganizationId,
    context.tableId,
    data.rowId,
    'DELETE',
    {
      rowSnapshot: data.rowSnapshot,
      changedByType: context.actor.type,
      changedById: context.actor.id,
      changedByName: context.actor.name,
    }
  );

  // Log to audit_events table
  auditService.logEvent(
    { value: context.organizationId } as OrganizationId,
    {
      eventType: 'database',
      eventCategory: 'row_crud',
      eventAction: 'delete',
      actorType: context.actor.type,
      actorId: context.actor.id,
      actorName: context.actor.name,
      resourceType: 'row',
      resourceId: data.rowId,
      parentResourceType: 'table',
      parentResourceId: String(context.tableId),
      eventData: { tableName: context.tableName },
      previousData: data.rowSnapshot,
      success: true,
    }
  );
}

/**
 * Log multiple row updates (bulk operation)
 * Logs each row individually for proper history tracking
 * Non-blocking - failures don't affect the main operation
 */
export function logBulkRowUpdates(
  context: RowAuditContext,
  updates: Array<RowChangeData>
): void {
  for (const update of updates) {
    logRowUpdate(context, update);
  }
}
