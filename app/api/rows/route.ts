import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tables, fields } from "@/lib/db/schema";
import { insertRow, updateRow, deleteRow, getRows } from "@/lib/db/dynamic";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { tableId, data } = await request.json();

    if (!tableId) {
      return NextResponse.json(
        { error: "tableId is required" },
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

    const tableFields = await db.select().from(fields).where(eq(fields.tableId, tableId));
    
    const processedData: Record<string, any> = {};
    
    for (const field of tableFields) {
      const fieldKey = `field_${field.id}`;
      const value = data[field.slug] || data[field.name];
      
      if (field.required && (value === undefined || value === null || value === "")) {
        return NextResponse.json(
          { error: `Field '${field.name}' is required` },
          { status: 400 }
        );
      }
      
      if (value !== undefined && value !== null) {
        // Handle JSONB fields for relations and files
        if (field.type === 'relation' || field.type === 'file') {
          // If value is a string, try to parse it as JSON
          if (typeof value === 'string') {
            try {
              processedData[fieldKey] = JSON.parse(value);
            } catch {
              processedData[fieldKey] = value;
            }
          } else {
            processedData[fieldKey] = value;
          }
        } else {
          processedData[fieldKey] = value;
        }
      }
    }

    await insertRow(table.dbName, processedData);

    return NextResponse.json({ message: "Row created successfully" }, { status: 201 });
  } catch (error) {
    console.error("Error creating row:", error);
    return NextResponse.json(
      { error: "Failed to create row" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!tableId) {
      return NextResponse.json(
        { error: "tableId is required" },
        { status: 400 }
      );
    }

    const [table] = await db.select().from(tables).where(eq(tables.id, parseInt(tableId))).limit(1);
    if (!table) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    const rows = await getRows(table.dbName, limit, offset);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching rows:", error);
    return NextResponse.json(
      { error: "Failed to fetch rows" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { tableId, rowId, data } = await request.json();

    if (!tableId || !rowId) {
      return NextResponse.json(
        { error: "tableId and rowId are required" },
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

    const tableFields = await db.select().from(fields).where(eq(fields.tableId, tableId));
    
    const processedData: Record<string, any> = {};
    
    for (const field of tableFields) {
      const fieldKey = `field_${field.id}`;
      const value = data[field.slug] || data[field.name];
      
      if (value !== undefined && value !== null) {
        // Handle JSONB fields for relations and files
        if (field.type === 'relation' || field.type === 'file') {
          // If value is a string, try to parse it as JSON
          if (typeof value === 'string') {
            try {
              processedData[fieldKey] = JSON.parse(value);
            } catch {
              processedData[fieldKey] = value;
            }
          } else {
            processedData[fieldKey] = value;
          }
        } else {
          processedData[fieldKey] = value;
        }
      }
    }

    await updateRow(table.dbName, rowId, processedData);

    return NextResponse.json({ message: "Row updated successfully" });
  } catch (error) {
    console.error("Error updating row:", error);
    return NextResponse.json(
      { error: "Failed to update row" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const rowId = searchParams.get("rowId");

    if (!tableId || !rowId) {
      return NextResponse.json(
        { error: "tableId and rowId are required" },
        { status: 400 }
      );
    }

    const [table] = await db.select().from(tables).where(eq(tables.id, parseInt(tableId))).limit(1);
    if (!table) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    await deleteRow(table.dbName, rowId);

    return NextResponse.json({ message: "Row deleted successfully" });
  } catch (error) {
    console.error("Error deleting row:", error);
    return NextResponse.json(
      { error: "Failed to delete row" },
      { status: 500 }
    );
  }
}