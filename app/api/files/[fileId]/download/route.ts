import { NextRequest, NextResponse } from "next/server";
import { auth, hasPermission } from "@/lib/auth";
import { S3FileStorageRepository } from "@/ddd/infrastructure/storage/repositories/s3-file-storage-repository";
import { db } from "@/lib/db/client";
import { fields, tables } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Initialize file storage repository
const fileStorageRepository = new S3FileStorageRepository();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check permissions
    const hasDataPermission = await hasPermission(session.user.id, "data:view", session.user.currentOrganizationId);
    if (!hasDataPermission) {
      return NextResponse.json(
        { error: "Permission denied: data:view required" },
        { status: 403 }
      );
    }

    const { fileId } = await params;
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");
    const fieldId = searchParams.get("fieldId");
    const filename = searchParams.get("filename"); // Optional filename for download

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

    // Query the row data to find the actual file with matching fileId
    // Dynamic table query using the field_{id} column pattern
    const columnName = `field_${fieldId}`;
    const tableName = `table_${tableId}`;

    // Validate column and table names (security check for SQL injection)
    if (!/^field_\d+$/.test(columnName) || !/^table_\d+$/.test(tableName)) {
      return NextResponse.json(
        { error: "Invalid table or field identifier" },
        { status: 400 }
      );
    }

    // Raw SQL query to find the file in the dynamic table
    // Note: Column and table names cannot be parameterized, but we validate them above
    const queryResult = await db.execute(`
      SELECT ${columnName} as file_data
      FROM ${tableName}
      WHERE organization_id = $1
      AND ${columnName} IS NOT NULL
    `, [table.organizationId]);

    // Find the row that contains our fileId
    let fileData: any = null;
    for (const row of queryResult.rows) {
      try {
        const files = Array.isArray(row.file_data) ? row.file_data : [row.file_data];
        const matchingFile = files.find((f: any) => f && f.id === fileId);
        if (matchingFile) {
          fileData = matchingFile;
          break;
        }
      } catch (error) {
        console.warn('Error parsing file data from row:', error);
        continue;
      }
    }

    if (!fileData || !fileData.s3Key) {
      return NextResponse.json(
        { error: "File not found in database" },
        { status: 404 }
      );
    }

    // Use the actual S3 key from the database
    const s3Key = fileData.s3Key;

    // Generate signed URL (15 minutes expiry)
    const downloadUrl = await fileStorageRepository.generateDownloadUrl(s3Key, {
      expiresIn: 900, // 15 minutes
      downloadFilename: fileData.name || filename || undefined
    });

    return NextResponse.json({ 
      downloadUrl,
      expiresIn: 900,
      fileId,
      filename: filename || undefined
    });
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}