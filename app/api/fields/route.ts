import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { fields, tables } from "@/lib/db/schema";
import { addFieldToTable, removeFieldFromTable } from "@/lib/db/dynamic";
import { slugify } from "@/utils/slugify";
import { eq, and } from "drizzle-orm";
import { authenticateRequest } from '@/lib/auth/test-auth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { tableId, name, type, required = false } = await request.json();

    if (!tableId || !name || !type) {
      return NextResponse.json(
        { error: "tableId, name, and type are required" },
        { status: 400 }
      );
    }

    const [table] = await db.select().from(tables).where(eq(tables.id, tableId)).limit(1);
    if (!table) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    // Verify table belongs to user's organization
    if (table.organizationId !== authResult.user.organizationId) {
      return NextResponse.json(
        { error: "Access denied: table not in your organization" },
        { status: 403 }
      );
    }

    const slug = slugify(name);

    const existingField = await db.select()
      .from(fields)
      .where(and(eq(fields.tableId, tableId), eq(fields.slug, slug)))
      .limit(1);

    if (existingField.length > 0) {
      return NextResponse.json(
        { error: "Field with this name already exists" },
        { status: 400 }
      );
    }

    const maxOrder = await db.select().from(fields).where(eq(fields.tableId, tableId));
    const orderIndex = maxOrder.length > 0 ? Math.max(...maxOrder.map(f => f.orderIndex || 0)) + 1 : 0;

    const [newField] = await db.insert(fields).values({
      tableId,
      name,
      slug,
      type,
      required,
      orderIndex,
    }).returning();

    await addFieldToTable(table.dbName, newField.id, type, required);

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

    const fieldList = await db.select()
      .from(fields)
      .where(eq(fields.tableId, parseInt(tableId)))
      .orderBy(fields.orderIndex);

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

    const [field] = await db.select()
      .from(fields)
      .where(eq(fields.id, parseInt(fieldId)))
      .limit(1);

    if (!field) {
      return NextResponse.json(
        { error: "Field not found" },
        { status: 404 }
      );
    }

    const [table] = await db.select().from(tables).where(eq(tables.id, field.tableId)).limit(1);
    if (!table) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    await removeFieldFromTable(table.dbName, field.id);
    await db.delete(fields).where(eq(fields.id, parseInt(fieldId)));

    return NextResponse.json({ message: "Field deleted successfully" });
  } catch (error) {
    console.error("Error deleting field:", error);
    return NextResponse.json(
      { error: "Failed to delete field" },
      { status: 500 }
    );
  }
}