/**
 * Audit Application Service
 *
 * Provides unified audit logging across the platform.
 * Non-blocking writes ensure audit failures don't break operations.
 */

import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { IAuditRepository, IRowHistoryRepository } from '@/ddd/domain/audit/interfaces/audit-repository';
import type { AuditEvent, AuditEventData, AuditQueryFilters, RowHistoryEntry } from '@/ddd/domain/audit/types';
import { addDays } from 'date-fns';

const RETENTION_DAYS: Record<string, number> = {
  enterprise: 365,
  max: 180,
  pro: 90,
  free: 14,
};

export class AuditApplicationService {
  constructor(
    private readonly auditRepository: IAuditRepository,
    private readonly rowHistoryRepository: IRowHistoryRepository,
    private readonly getOrganizationPlan: (orgId: number) => Promise<string>
  ) {}

  /**
   * Log an audit event (non-blocking)
   */
  async logEvent(organizationId: OrganizationId, event: AuditEventData): Promise<void> {
    const plan = await this.getOrganizationPlan(organizationId.value);
    const retentionDays = RETENTION_DAYS[plan] ?? RETENTION_DAYS.free;
    const expiresAt = addDays(new Date(), retentionDays);

    // Non-blocking async write
    setImmediate(async () => {
      try {
        await this.auditRepository.create({
          organizationId: organizationId.value,
          ...event,
          occurredAt: new Date(),
          expiresAt,
        });
      } catch (error) {
        console.error('[AuditService] Failed to log event:', error);
      }
    });
  }

  /**
   * Log a row change for history tracking (non-blocking)
   */
  async logRowChange(
    organizationId: OrganizationId,
    tableId: number,
    rowId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    options: {
      fieldChanges?: Record<string, { old: unknown; new: unknown }>;
      rowSnapshot?: Record<string, unknown>;
      changedByType: 'user' | 'agent' | 'webhook' | 'public_app';
      changedById?: string;
      changedByName?: string;
    }
  ): Promise<void> {
    const plan = await this.getOrganizationPlan(organizationId.value);
    const retentionDays = RETENTION_DAYS[plan] ?? RETENTION_DAYS.free;
    const expiresAt = addDays(new Date(), retentionDays);

    setImmediate(async () => {
      try {
        const version = await this.rowHistoryRepository.getLatestVersion(tableId, rowId) + 1;
        await this.rowHistoryRepository.create({
          organizationId: organizationId.value,
          tableId,
          rowId,
          operation,
          version,
          fieldChanges: options.fieldChanges,
          rowSnapshot: options.rowSnapshot,
          changedByType: options.changedByType,
          changedById: options.changedById,
          changedByName: options.changedByName,
          changedAt: new Date(),
          expiresAt,
        });
      } catch (error) {
        console.error('[AuditService] Failed to log row change:', error);
      }
    });
  }

  /**
   * Query audit events for an organization
   */
  async queryEvents(organizationId: OrganizationId, filters: AuditQueryFilters): Promise<AuditEvent[]> {
    return this.auditRepository.query(organizationId.value, filters);
  }

  /**
   * Get row history for a specific row
   */
  async getRowHistory(tableId: number, rowId: string, limit = 50): Promise<RowHistoryEntry[]> {
    return this.rowHistoryRepository.getForRow(tableId, rowId, limit);
  }

  /**
   * Get audit trail for a specific resource
   */
  async getResourceAuditTrail(resourceType: string, resourceId: string, limit = 50): Promise<AuditEvent[]> {
    return this.auditRepository.getByResource(resourceType, resourceId, limit);
  }
}
