'use server'

import { withAuthContext } from '@/lib/auth/with-context';
import { requirePermission } from './permissions';
import { getAuditApplicationService } from '@/ddd/application/di/container';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { AuditQueryFilters } from '@/ddd/domain/audit/types';

/**
 * Get audit events for the current organization
 * Requires agents:manage permission
 */
export async function getAuditEvents(filters: AuditQueryFilters) {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission('agents:manage');
      const auditService = getAuditApplicationService();

      const events = await auditService.queryEvents(
        OrganizationId.fromNumber(session.user.currentOrganizationId!),
        filters
      );

      return {
        success: true,
        data: events,
      };
    } catch (error) {
      console.error('Error fetching audit events:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit events',
      };
    }
  });
}

/**
 * Get row history for a specific row
 * Requires agents:view permission (uses table access)
 */
export async function getRowHistory(tableId: number, rowId: string, limit = 50) {
  return withAuthContext(async () => {
    try {
      await requirePermission('agents:view');
      const auditService = getAuditApplicationService();

      const history = await auditService.getRowHistory(tableId, rowId, limit);

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      console.error('Error fetching row history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch row history',
      };
    }
  });
}

/**
 * Get audit trail for a specific resource (agent, skill, etc.)
 */
export async function getResourceAuditTrail(resourceType: string, resourceId: string, limit = 50) {
  return withAuthContext(async () => {
    try {
      await requirePermission('agents:view');
      const auditService = getAuditApplicationService();

      const events = await auditService.getResourceAuditTrail(resourceType, resourceId, limit);

      return {
        success: true,
        data: events,
      };
    } catch (error) {
      console.error('Error fetching resource audit trail:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit trail',
      };
    }
  });
}
