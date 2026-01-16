// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Table management API endpoint using TableApplicationService
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm → minimal TOON format
 * - ?format=llm&meta=1 → TOON with metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedRoute, parseJsonBody, requireParam } from '@/lib/api/base';
import { getTableApplicationService } from "@/ddd/application/di/container";
import { DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { CreateTableCommand } from '@/ddd/application/services/tables/table-application-service';
import { tablesToToon, operationToToon } from '@/lib/toon-format';
import { TableMapper } from '@/app/mappers/table-mapper';

/**
 * POST /api/tables - Create a new table
 * ?format=llm → TOON format response
 */
export async function POST(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  const response = await withAuthenticatedRoute(request, async (user) => {
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

  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      // Extract ID - handle value object (.value) or plain number
      const idVal = body.data?.id;
      const tableId = typeof idVal === 'object' && idVal !== null ? (idVal.value ?? 0) : (idVal ?? 0);
      const toon = operationToToon({
        action: 'created',
        entity: 'table',
        id: tableId,
        data: { name: body.data?.name, description: body.data?.description }
      });
      return new NextResponse(toon, {
        status: 201,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}

/**
 * GET /api/tables - Get tables list
 * ?format=llm → TOON format | ?format=llm&meta=1 → with metadata
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const includeMeta = searchParams.get('meta') === '1';

  const response = await withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'User has no current organization', status: 400 };
    }

    const tableApplicationService = getTableApplicationService();
    const userTables = await tableApplicationService.getTablesForOrganization(
      OrganizationId.fromNumber(user.organizationId)
    );

    return { success: true, data: userTables.map(TableMapper.toDTO) };
  });

  // Transform to TOON if requested
  if (format === 'llm') {
    const body = await response.clone().json();
    if (body.success) {
      return new NextResponse(tablesToToon(body.data, { includeMeta }), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  return response;
}
