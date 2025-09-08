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

    // Construct S3 key using the same pattern as uploads
    // Note: This is a simplified approach. In production, you'd query the row data
    // to get the exact s3Key from the FileFieldValue stored in the database
    const s3Key = `org-${table.organizationId}/table-${tableId}/field-${fieldId}/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${fileId}_${filename || 'file'}`;

    // Generate signed URL (15 minutes expiry)
    const downloadUrl = await fileStorageRepository.generateDownloadUrl(s3Key, {
      expiresIn: 900, // 15 minutes
      downloadFilename: filename || undefined
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