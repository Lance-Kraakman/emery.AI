import { NextRequest, NextResponse } from "next/server";
import { auth, hasPermission } from "@/lib/auth";
import { getFileApplicationService, getTableApplicationService } from "@/ddd/application/di/container";
import { FieldId, OrganizationId, TableId, UserId } from "@/ddd/domain/shared/value-objects";
import type { UploadFileCommand } from "@/ddd/application/services/tables/file-application-service";
import { withAuthContext } from '@/lib/auth/with-context';

export async function POST(request: NextRequest) {
  return withAuthContext(async () => {
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
    const hasDataPermission = await hasPermission(session.user.id, "data:manage", session.user.currentOrganizationId);
    if (!hasDataPermission) {
      return NextResponse.json(
        { error: "Permission denied: data:manage required" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const organizationId = parseInt(formData.get('organizationId') as string);
    const tableId = parseInt(formData.get('tableId') as string);
    const fieldName = formData.get('fieldName') as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!organizationId || !tableId || !fieldName) {
      return NextResponse.json(
        { error: "organizationId, tableId, and fieldName are required" },
        { status: 400 }
      );
    }

    // Use TableApplicationService to find field by name and get its ID
      const tableApplicationService = getTableApplicationService();
      const table = await tableApplicationService.getTable(TableId.fromNumber(tableId));
      if (!table) {
        return NextResponse.json(
          { error: "Table not found" },
          { status: 404 }
        );
      }
      const field = table.getField(fieldName);
      if (!field) {
        return NextResponse.json(
          { error: `Field '${fieldName}' not found in table` },
          { status: 404 }
        );
      }

      // Use FileApplicationService for file upload
      const fileApplicationService = getFileApplicationService();
      
      const buffer = Buffer.from(await file.arrayBuffer());
      const command: UploadFileCommand = {
        organizationId: OrganizationId.fromNumber(organizationId),
        tableId: TableId.fromNumber(tableId),
        fieldId: field.id,
        file: {
          buffer,
          filename: file.name,
          mimeType: file.type
        },
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
  });
}