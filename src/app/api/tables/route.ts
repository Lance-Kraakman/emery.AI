/**
 * Table management API endpoint using TableApplicationService
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseJsonBody, requireParam, parsePaginationParams, paginateResults } from '@/lib/api/base';
import { hasPermission } from '@/lib/auth';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getTableApplicationService } from "@/ddd/application/di/container";
import { DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { CreateTableCommand } from '@/ddd/application/services/tables/table-application-service';
import { TableMapper } from '@/app/mappers/table-mapper';

/**
 * POST /api/tables - Create a new table
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId || !await hasPermission(user.id, 'table:create', user.organizationId)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const body = await parseJsonBody(request);

    if (!body) {
      return { success: false, error: 'Invalid request body', status: 400 };
    }

    const { name, description, databaseId, metadata } = body;
    requireParam(name, 'name');
    requireParam(databaseId, 'databaseId');

    const tableApplicationService = getTableApplicationService();
    const command: CreateTableCommand = {
      name,
      databaseId: DatabaseId.fromNumber(databaseId),
      organizationId: OrganizationId.fromNumber(user.organizationId),
      ownerId: UserId.fromString(user.id),
      description,
      metadata: metadata || {}
    };

    const result = await tableApplicationService.createTable(command);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create table', status: 400 };
    }

    logAgentMutation(request, user, {
      action: 'create',
      resourceType: 'table',
      resourceId: String(result.data?.id),
      resourceName: name,
    });

    return {
      success: true,
      data: { ...result.data, id: result.data?.id },
      message: 'Table created successfully'
    };
  });
}

/**
 * GET /api/tables - Get tables list
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId || !await hasPermission(user.id, 'table:view', user.organizationId)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const tableApplicationService = getTableApplicationService();
    const userTables = await tableApplicationService.getTablesForOrganization(
      OrganizationId.fromNumber(user.organizationId)
    );

    // AIDEV-NOTE: Apply pagination to results
    const tableDTOs = userTables.map(TableMapper.toDTO);
    const paginationParams = parsePaginationParams(request);
    const paginatedResult = paginateResults(tableDTOs, paginationParams);

    return {
      success: true,
      data: paginatedResult.data,
      pagination: paginatedResult.pagination,
    };
  });
}
