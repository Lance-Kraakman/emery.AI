/**
 * Field management API endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { hasResourcePermission } from '@/lib/auth';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getTableApplicationService } from "@/ddd/application/di/container";
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { TableId } from '@/ddd/domain/shared/value-objects';
import { withAuthenticatedRoute, errorResponse } from '@/lib/api/base';

// AIDEV-NOTE: Field types support text, number, boolean, date, file, relation (no email/url)
import type { CreateFieldCommand, UpdateFieldCommand } from '@/ddd/application/services/tables/table-application-service';
import { normalizeSelectMetadata } from '@/lib/utils/normalize-select-metadata';

/**
 * POST /api/fields - Create a new field
 */
export async function POST(request: NextRequest) {
  return withAuthenticatedRoute(request, async (user) => {
    const { tableId, name, type, required = false, relatedTableId, metadata } = await request.json();

    if (!tableId || !name || !type) {
      return { success: false, error: "tableId, name, and type are required", status: 400 };
    }

    if (!user.organizationId || !await hasResourcePermission(user.id, 'table:manage', user.organizationId, 'tables', parseInt(tableId))) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    // Use TableApplicationService for field creation
    const tableApplicationService = getTableApplicationService();

    const command: CreateFieldCommand = {
      tableId: TableId.fromNumber(parseInt(tableId)),
      name,
      type: type as FieldType,
      required,
      relatedTableId: relatedTableId ? TableId.fromNumber(parseInt(relatedTableId)) : undefined,
      metadata: normalizeSelectMetadata(type, metadata || {})
    };

    const result = await tableApplicationService.createField(command);

    if (!result.success) {
      return { success: false, error: result.error || "Failed to create field", status: 400 };
    }

    logAgentMutation(request, user, {
      action: 'create',
      resourceType: 'field',
      resourceId: String(result.data?.id),
      resourceName: name,
    });

    return { success: true, data: result.data };
  });
}

/**
 * GET /api/fields - List fields for a table
 */
export async function GET(request: NextRequest) {
  return withAuthenticatedRoute(request, async (user) => {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");

    if (!tableId) {
      return { success: false, error: "tableId is required", status: 400 };
    }

    if (!user.organizationId || !await hasResourcePermission(user.id, 'table:view', user.organizationId, 'tables', parseInt(tableId))) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    // Use TableApplicationService for field listing
    const tableApplicationService = getTableApplicationService();
    const fieldList = await tableApplicationService.getFieldsForTable(TableId.fromNumber(parseInt(tableId)));

    return { success: true, data: fieldList };
  });
}

/**
 * PATCH /api/fields - Update a field
 */
export async function PATCH(request: NextRequest) {
  return withAuthenticatedRoute(request, async (user) => {
    const { tableId, fieldName, name, type, required, metadata } = await request.json();

    if (!tableId || !fieldName) {
      return { success: false, error: "tableId and fieldName are required", status: 400 };
    }

    if (!user.organizationId || !await hasResourcePermission(user.id, 'table:manage', user.organizationId, 'tables', parseInt(tableId))) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const tableApplicationService = getTableApplicationService();

    const command: UpdateFieldCommand = {
      tableId: TableId.fromNumber(parseInt(tableId)),
      fieldName,
      name,
      type: type as FieldType | undefined,
      required,
      metadata: metadata ? normalizeSelectMetadata(type, metadata) : undefined,
    };

    const result = await tableApplicationService.updateField(command);

    if (!result.success) {
      return { success: false, error: result.error || "Failed to update field", status: 400 };
    }

    logAgentMutation(request, user, {
      action: 'update',
      resourceType: 'field',
      resourceName: fieldName,
    });

    return { success: true, data: result.data };
  });
}

/**
 * DELETE /api/fields - Delete a field
 */
export async function DELETE(request: NextRequest) {
  return withAuthenticatedRoute(request, async (user) => {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const fieldName = searchParams.get("fieldName");

    if (!tableId || !fieldName) {
      return { success: false, error: "Table ID and field name are required", status: 400 };
    }

    if (!user.organizationId || !await hasResourcePermission(user.id, 'table:manage', user.organizationId, 'tables', parseInt(tableId))) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const tableApplicationService = getTableApplicationService();
    const result = await tableApplicationService.deleteField(TableId.fromNumber(parseInt(tableId)), fieldName);

    if (!result.success) {
      return { success: false, error: result.error || "Failed to delete field", status: 400 };
    }

    logAgentMutation(request, user, {
      action: 'delete',
      resourceType: 'field',
      resourceName: fieldName,
    });

    return { success: true, data: { message: "Field deleted successfully" } };
  });
}
