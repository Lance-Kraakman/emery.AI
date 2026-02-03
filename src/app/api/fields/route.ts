/**
 * Field management API endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from '@/lib/auth/test-auth';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getTableApplicationService } from "@/ddd/application/di/container";
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { TableId } from '@/ddd/domain/shared/value-objects';

// AIDEV-NOTE: Field types support text, number, boolean, date, file, relation (no email/url)
import type { CreateFieldCommand } from '@/ddd/application/services/tables/table-application-service';
import { normalizeSelectMetadata } from '@/lib/utils/normalize-select-metadata';

/**
 * POST /api/fields - Create a new field
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { tableId, name, type, required = false, relatedTableId, metadata } = await request.json();

    if (!tableId || !name || !type) {
      return NextResponse.json(
        { error: "tableId, name, and type are required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: result.error || "Failed to create field" },
        { status: 400 }
      );
    }

    if (authResult.user) {
      logAgentMutation(request, authResult.user, {
        action: 'create',
        resourceType: 'field',
        resourceId: String(result.data?.id),
        resourceName: name,
      });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("Error creating field:", error);
    return NextResponse.json(
      { error: "Failed to create field" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");

    if (!tableId) {
      return NextResponse.json(
        { error: "tableId is required" },
        { status: 400 }
      );
    }

    // Use TableApplicationService for field listing
    const tableApplicationService = getTableApplicationService();
    const fieldList = await tableApplicationService.getFieldsForTable(TableId.fromNumber(parseInt(tableId)));

    return NextResponse.json(fieldList);
  } catch (error) {
    console.error("Error fetching fields:", error);
    return NextResponse.json(
      { error: "Failed to fetch fields" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fields - Delete a field
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const fieldName = searchParams.get("fieldName");

    if (!tableId || !fieldName) {
      return NextResponse.json(
        { error: "Table ID and field name are required" },
        { status: 400 }
      );
    }

    const tableApplicationService = getTableApplicationService();
    const result = await tableApplicationService.deleteField(TableId.fromNumber(parseInt(tableId)), fieldName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete field" },
        { status: 400 }
      );
    }

    if (authResult.user) {
      logAgentMutation(request, authResult.user, {
        action: 'delete',
        resourceType: 'field',
        resourceName: fieldName,
      });
    }

    return NextResponse.json({ message: "Field deleted successfully" });
  } catch (error) {
    console.error("Error deleting field:", error);
    return NextResponse.json(
      { error: "Failed to delete field" },
      { status: 500 }
    );
  }
}
