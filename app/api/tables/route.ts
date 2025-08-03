import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tables, workspaces } from "@/lib/db/schema";
import { createDynamicTable, dropDynamicTable } from "@/lib/db/dynamic";
import { generateTableName } from "@/utils/slugify";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, name } = await request.json();

    if (!workspaceId || !name) {
      return NextResponse.json(
        { error: "workspaceId and name are required" },
        { status: 400 }
      );
    }

    const workspace = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    if (workspace.length === 0) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const dbName = generateTableName(name);

    await createDynamicTable(dbName);

    const [newTable] = await db.insert(tables).values({
      workspaceId,
      name,
      dbName,
    }).returning();

    return NextResponse.json(newTable, { status: 201 });
  } catch (error) {
    console.error("Error creating table:", error);
    return NextResponse.json(
      { error: "Failed to create table" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const tableList = await db.select().from(tables).where(eq(tables.workspaceId, parseInt(workspaceId)));

    return NextResponse.json(tableList);
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      { error: "Failed to fetch tables" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("id");

    if (!tableId) {
      return NextResponse.json(
        { error: "Table ID is required" },
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

    await dropDynamicTable(table.dbName);
    await db.delete(tables).where(eq(tables.id, parseInt(tableId)));

    return NextResponse.json({ message: "Table deleted successfully" });
  } catch (error) {
    console.error("Error deleting table:", error);
    return NextResponse.json(
      { error: "Failed to delete table" },
      { status: 500 }
    );
  }
}