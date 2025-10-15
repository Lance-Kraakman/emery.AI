import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from '@/lib/auth/test-auth';
import { createRow, updateRowData, deleteRowData, getRowsData } from '@/app/actions/rows';

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

    const { tableId, data } = await request.json();

    if (!tableId) {
      return NextResponse.json(
        { error: "tableId is required" },
        { status: 400 }
      );
    }

    // Use server action function to avoid duplication
    const result = await createRow({ tableId, data });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
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
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const limit = parseInt(searchParams.get("limit") || "1000");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!tableId) {
      return NextResponse.json(
        { error: "tableId is required" },
        { status: 400 }
      );
    }

    // Use server action function
    const rows = await getRowsData(parseInt(tableId), limit);
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
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { tableId, rowId, data } = await request.json();

    if (!tableId || !rowId) {
      return NextResponse.json(
        { error: "tableId and rowId are required" },
        { status: 400 }
      );
    }

    // Use server action function
    const result = await updateRowData({ tableId, rowId, data });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

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
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const rowId = searchParams.get("rowId");

    if (!tableId || !rowId) {
      return NextResponse.json(
        { error: "tableId and rowId are required" },
        { status: 400 }
      );
    }

    // Use server action function
    const result = await deleteRowData(parseInt(tableId), rowId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Row deleted successfully" });
  } catch (error) {
    console.error("Error deleting row:", error);
    return NextResponse.json(
      { error: "Failed to delete row" },
      { status: 500 }
    );
  }
}