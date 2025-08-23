import { NextRequest, NextResponse } from "next/server";
import { auth, hasPermission } from "@/lib/auth";
import { getFileApplicationService } from "@/ddd/application/di/container";
import type { UploadFileCommand } from "@/ddd/application/use-cases/files/file-application-service";

export async function POST(request: NextRequest) {
  try {
    // Check authentication and permissions
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to manage data
    const hasDataPermission = await hasPermission(session.user.id, "manage_data");
    if (!hasDataPermission) {
      return NextResponse.json(
        { error: "Permission denied: manage_data required" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const organizationId = parseInt(formData.get('organizationId') as string);
    const tableId = parseInt(formData.get('tableId') as string);
    const fieldId = parseInt(formData.get('fieldId') as string);

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!organizationId || !tableId || !fieldId) {
      return NextResponse.json(
        { error: "organizationId, tableId, and fieldId are required" },
        { status: 400 }
      );
    }

    // Use FileApplicationService for file upload
    const fileApplicationService = getFileApplicationService();
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const command: UploadFileCommand = {
      organizationId,
      tableId,
      fieldId,
      file: {
        buffer,
        filename: file.name,
        mimeType: file.type
      },
      uploadedBy: session.user.id
    };

    const result = await fileApplicationService.uploadFile(command);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to upload file' },
        { status: 400 }
      );
    }

    if (!result.data) {
      return NextResponse.json(
        { error: "No file metadata returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...result.data,
      warnings: result.warnings
    }, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}