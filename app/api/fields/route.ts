import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getFieldApplicationService } from "@/ddd/application/di/container";
import type { FieldType } from '@/ddd/domain/fields/entities/field';
import type { CreateFieldCommand } from '@/ddd/application/services/fields/field-application-service';

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

    // Use FieldApplicationService for field creation
    const fieldApplicationService = getFieldApplicationService();

    const command: CreateFieldCommand = {
      tableId: parseInt(tableId),
      name,
      type: type as FieldType,
      required,
      relatedTableId: relatedTableId ? parseInt(relatedTableId) : undefined,
      metadata: {}
    };

    const result = await fieldApplicationService.createField(command);

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

    // Use FieldApplicationService for field listing
    const fieldApplicationService = getFieldApplicationService();
    const fieldList = await fieldApplicationService.getFieldsForTable(parseInt(tableId));

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
    const fieldId = searchParams.get("id");

    if (!fieldId) {
      return NextResponse.json(
        { error: "Field ID is required" },
        { status: 400 }
      );
    }

    // Use FieldApplicationService for field deletion
    const fieldApplicationService = getFieldApplicationService();
    
    const result = await fieldApplicationService.deleteField(parseInt(fieldId));

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