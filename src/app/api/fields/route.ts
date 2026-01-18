/**
 * Field management API endpoint
 *
 * Supports TOON format for LLM-optimized responses:
 * - ?format=llm → minimal TOON format
 * - ?format=llm&meta=1 → TOON with metadata
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getTableApplicationService } from "@/ddd/application/di/container";
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { TableId } from '@/ddd/domain/shared/value-objects';
import { fieldsToToon, operationToToon } from '@/lib/toon-format';

// AIDEV-NOTE: Field types support text, number, boolean, date, file, relation (no email/url)
import type { CreateFieldCommand } from '@/ddd/application/services/tables/table-application-service';

/**
 * POST /api/fields - Create a new field
 * ?format=llm → TOON format response
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { tableId, name, type, required = false, relatedTableId } = await request.json();

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
      metadata: {}
    };

    const result = await tableApplicationService.createField(command);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to create field" },
        { status: 400 }
      );
    }

    if (format === "llm") {
      // Extract ID - handle value object (.value) or plain number
      const idVal = result.data?.id;
      const fieldId = typeof idVal === 'object' && idVal !== null ? (idVal.value ?? 0) : (idVal ?? 0);
      const toon = operationToToon({
        action: 'created',
        entity: 'field',
        id: fieldId,
        data: { name: result.data?.name, type: result.data?.type }
      });
      return new NextResponse(toon, {
        status: 201,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
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
    const format = searchParams.get("format");
    const includeMeta = searchParams.get("meta") === "1";

    if (!tableId) {
      return NextResponse.json(
        { error: "tableId is required" },
        { status: 400 }
      );
    }

    // Use TableApplicationService for field listing
    const tableApplicationService = getTableApplicationService();
    const fieldList = await tableApplicationService.getFieldsForTable(TableId.fromNumber(parseInt(tableId)));

    // Return TOON format if requested
    if (format === "llm") {
      const toonData = fieldsToToon(fieldList, { includeMeta });
      return new NextResponse(toonData, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

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
 * ?format=llm → TOON format response
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  try {
    const tableId = searchParams.get("tableId");
    const fieldName = searchParams.get("fieldName");

    if (!tableId || !fieldName) {
      return NextResponse.json(
        { error: "Table ID and field name are required" },
        { status: 400 }
      );
    }

    // Use TableApplicationService for field deletion
    const tableApplicationService = getTableApplicationService();

    const result = await tableApplicationService.deleteField(TableId.fromNumber(parseInt(tableId)), fieldName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete field" },
        { status: 400 }
      );
    }

    if (format === "llm") {
      const toon = operationToToon({
        action: 'deleted',
        entity: 'field',
        id: fieldName  // Use field name as identifier
      });
      return new NextResponse(toon, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
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