import { NextRequest, NextResponse } from "next/server";
import { generateDownloadUrl } from "@/lib/s3/operations";
import { db } from "@/lib/db/client";
import { fields, tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const fieldId = searchParams.get("fieldId");

    if (!tableId || !fieldId) {
      return NextResponse.json(
        { error: "tableId and fieldId are required" },
        { status: 400 }
      );
    }

    // Verify field exists and is a file field
    const [field] = await db
      .select()
      .from(fields)
      .where(eq(fields.id, parseInt(fieldId)))
      .limit(1);

    if (!field || field.type !== 'file') {
      return NextResponse.json(
        { error: "File field not found" },
        { status: 404 }
      );
    }

    // Get table info to construct S3 key
    const [table] = await db
      .select()
      .from(tables)
      .where(eq(tables.id, parseInt(tableId)))
      .limit(1);

    if (!table) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      );
    }

    // TODO: Find the actual file metadata from the row data
    // For now, we'll construct the S3 key pattern
    // In a real implementation, you'd query the row data to get the exact s3Key
    
    // Generate signed URL (15 minutes expiry)
    const signedUrl = await generateDownloadUrl(`files/organization-${table.organizationId}/table-${tableId}/field-${fieldId}/${fileId}/`, 900);

    return NextResponse.json({ downloadUrl: signedUrl });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}