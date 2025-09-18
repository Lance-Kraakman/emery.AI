import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from '@/src/lib/auth/test-auth';
import { getTableApplicationService } from "@/src/ddd/application/di/container";
import type { FieldType } from '@/src/ddd/domain/tables/value-objects/table-field';
import { TableId } from '@/src/ddd/domain/shared/value-objects';

// AIDEV-NOTE: Field types support text, number, boolean, date, file, relation (no email/url)
import type { CreateFieldCommand } from '@/src/ddd/application/services/tables/table-application-service';

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

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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

    return NextResponse.json({ message: "Field deleted successfully" });
  } catch (error) {
    console.error("Error deleting field:", error);
    return NextResponse.json(
      { error: "Failed to delete field" },
      { status: 500 }
    );
  }
}