// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Table management API endpoint using TableApplicationService
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseJsonBody, requireParam } from '@/lib/api/base';
import { getTableApplicationService } from "@/ddd/application/di/container";
import { DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { CreateTableCommand } from '@/ddd/application/services/tables/table-application-service';
import { TableMapper } from '@/app/mappers/table-mapper';

/**
 * POST /api/tables - Create a new table
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const body = await parseJsonBody(request);

    if (!body) {
      return { success: false, error: 'Invalid request body', status: 400 };
    }

    const { name, description, organizationId, databaseId, metadata } = body;
    requireParam(name, 'name');
    requireParam(databaseId, 'databaseId');

    const tableApplicationService = getTableApplicationService();
    const command: CreateTableCommand = {
      name,
      databaseId: DatabaseId.fromNumber(databaseId),
      organizationId: OrganizationId.fromNumber(
        organizationId ? parseInt(organizationId) : user.organizationId || 1
      ),
      ownerId: UserId.fromString(user.id),
      description,
      metadata: metadata || {}
    };

    const result = await tableApplicationService.createTable(command);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create table', status: 400 };
    }

    return {
      success: true,
      data: { ...result.data, id: result.data?.id },
      message: 'Table created successfully'
    };
  });
}

/**
 * GET /api/tables - Get tables list
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'User has no current organization', status: 400 };
    }

    const tableApplicationService = getTableApplicationService();
    const userTables = await tableApplicationService.getTablesForOrganization(
      OrganizationId.fromNumber(user.organizationId)
    );

    return { success: true, data: userTables.map(TableMapper.toDTO) };
  });
}
