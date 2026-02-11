/**
 * Audit Events API
 *
 * Provides read access to audit events for the ResearchEmery agent.
 *
 * AIDEV-NOTE: This endpoint is READ-ONLY and designed for system introspection.
 * It supports filtering by event type, resource, actor, and time range.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getAuditApplicationService } from '@/ddd/application/di/getters';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { AuditQueryFilters, AuditEventType, AuditActorType } from '@/ddd/domain/audit/types';

/**
 * GET /api/audit
 *
 * Query audit events for the organization.
 *
 * Query parameters:
 * - eventType: Filter by event type (database, agent, skill, app, security)
 * - eventCategory: Filter by category (row_crud, task_execution, etc.)
 * - actorType: Filter by actor type (user, agent, system, webhook, public_app)
 * - actorId: Filter by specific actor ID
 * - resourceType: Filter by resource type (row, table, agent, skill, task, etc.)
 * - resourceId: Filter by specific resource ID
 * - before: Filter events before this date (ISO format)
 * - after: Filter events after this date (ISO format)
 * - limit: Maximum number of events to return (default: 50, max: 200)
 * - offset: Number of events to skip for pagination
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { searchParams } = new URL(request.url);

    // Build filters from query parameters
    const filters: AuditQueryFilters = {};

    // Event type filter
    const eventType = searchParams.get('eventType');
    if (eventType) {
      filters.eventType = eventType as AuditEventType;
    }

    // Event category filter
    const eventCategory = searchParams.get('eventCategory');
    if (eventCategory) {
      filters.eventCategory = eventCategory;
    }

    // Actor type filter
    const actorType = searchParams.get('actorType');
    if (actorType) {
      filters.actorType = actorType as AuditActorType;
    }

    // Actor ID filter
    const actorId = searchParams.get('actorId');
    if (actorId) {
      filters.actorId = actorId;
    }

    // Resource type filter
    const resourceType = searchParams.get('resourceType');
    if (resourceType) {
      filters.resourceType = resourceType;
    }

    // Resource ID filter
    const resourceId = searchParams.get('resourceId');
    if (resourceId) {
      filters.resourceId = resourceId;
    }

    // Date range filters
    const before = searchParams.get('before');
    if (before) {
      filters.before = new Date(before);
    }

    const after = searchParams.get('after');
    if (after) {
      filters.after = new Date(after);
    }

    // Pagination
    const limit = searchParams.get('limit');
    filters.limit = limit ? Math.min(parseInt(limit, 10), 200) : 50;

    const offset = searchParams.get('offset');
    if (offset) {
      filters.offset = parseInt(offset, 10);
    }

    // Query audit events
    const auditService = getAuditApplicationService();
    const organizationId = OrganizationId.fromNumber(user.organizationId!);
    const events = await auditService.queryEvents(organizationId, filters);

    return {
      success: true,
      data: {
        events,
        filters: {
          applied: Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v !== undefined)
          ),
          limit: filters.limit,
          offset: filters.offset || 0,
        },
      },
    };
  });
}
