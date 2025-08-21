import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getFieldRepository, getDynamicTableRepository } from '@/lib/application/di/container';
import { slugify } from "@/utils/slugify";
import type { CreateFieldData, FieldType } from '@/lib/domain/entities/field';

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

    // Use domain repositories for field creation
    const fieldRepository = getFieldRepository();
    const dynamicTableRepository = getDynamicTableRepository();

    // Verify table exists and belongs to user's organization
    const table = await dynamicTableRepository.findById(parseInt(tableId));
    if (!table) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    if (!authResult.user || table.organizationId !== authResult.user.organizationId) {
      return NextResponse.json(
        { error: "Access denied: table not in your organization" },
        { status: 403 }
      );
    }

    const slug = slugify(name);

    // Check if field slug is unique using domain repository
    const isUnique = await fieldRepository.checkSlugUniqueness(parseInt(tableId), slug);
    if (!isUnique) {
      return NextResponse.json(
        { error: "Field with this name already exists" },
        { status: 400 }
      );
    }

    // Get max order index for proper ordering
    const existingFields = await fieldRepository.findByTableId(parseInt(tableId));
    const orderIndex = existingFields.length > 0 ? Math.max(...existingFields.map(f => f.orderIndex || 0)) + 1 : 0;

    // Create field using domain repository
    const fieldData: CreateFieldData = {
      tableId: parseInt(tableId),
      name,
      slug,
      type: type as FieldType,
      required,
      orderIndex,
      relatedTableId: relatedTableId ? parseInt(relatedTableId) : undefined,
    };

    const newField = await fieldRepository.create(fieldData);

    return NextResponse.json(newField, { status: 201 });
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

    // Use domain repository for field listing
    const fieldRepository = getFieldRepository();
    const fieldList = await fieldRepository.findByTableId(parseInt(tableId));

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

    // Use domain repository for field deletion
    const fieldRepository = getFieldRepository();
    
    // Check if field exists
    const field = await fieldRepository.findById(parseInt(fieldId));
    if (!field) {
      return NextResponse.json(
        { error: "Field not found" },
        { status: 404 }
      );
    }

    // Check if field can be safely deleted
    const canDelete = await fieldRepository.canDeleteField(parseInt(fieldId));
    if (!canDelete) {
      return NextResponse.json(
        { error: "Field cannot be deleted: it is required and contains data" },
        { status: 400 }
      );
    }

    // Delete field using domain repository (handles both metadata and physical column)
    await fieldRepository.delete(parseInt(fieldId));

    return NextResponse.json({ message: "Field deleted successfully" });
  } catch (error) {
    console.error("Error deleting field:", error);
    return NextResponse.json(
      { error: "Failed to delete field" },
      { status: 500 }
    );
  }
}