import { NextRequest, NextResponse } from "next/server";
import { auth, hasPermission } from "@/lib/auth";
import { getFileApplicationService, getTableApplicationService, getDocumentApplicationService, getStorageQuotaApplicationService } from "@/ddd/application/di/container";
import { OrganizationId, TableId, UserId } from "@/ddd/domain/shared/value-objects";
import type { UploadFileCommand } from "@/ddd/application/services/tables/file-application-service";
import type { CreateTiptapDocumentCommand } from "@/ddd/application/services/tables/document-application-service";
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
    
    // Document-specific form fields
    const documentTitle = formData.get('documentTitle') as string | null;
    const documentType = formData.get('documentType') as 'tiptap' | 'file' | null;
    const initialContent = formData.get('initialContent') as string | null;

    // Validate common required fields
    if (!organizationId || !tableId || !fieldName) {
      return NextResponse.json(
        { error: "organizationId, tableId, and fieldName are required" },
        { status: 400 }
      );
    }

    // Validate based on request type
    const isTiptapDocumentRequest = documentType === 'tiptap' && documentTitle;
    
    if (!isTiptapDocumentRequest && !file) {
      return NextResponse.json(
        { error: "Either file or document creation parameters (documentTitle, documentType) must be provided" },
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

    // Check storage quota before upload
    const storageQuotaService = getStorageQuotaApplicationService();

    // Calculate upload size (actual file size or estimated for TipTap documents)
    const uploadSizeBytes = file ? file.size : (initialContent ? new Blob([initialContent]).size : 1024); // 1KB estimate for empty docs

    const quotaCheckResult = await storageQuotaService.checkQuota({
      organizationId,
      uploadSizeBytes,
      category: 'database' // Table uploads are categorized as database storage
    });

    if (!quotaCheckResult.success) {
      return NextResponse.json(
        { error: quotaCheckResult.error || 'Failed to check storage quota' },
        { status: 500 }
      );
    }

    if (!quotaCheckResult.data?.allowed) {
      return NextResponse.json(
        {
          error: quotaCheckResult.data?.reason || 'Storage quota exceeded',
          quotaInfo: {
            currentUsageBytes: quotaCheckResult.data?.currentUsageBytes,
            quotaBytes: quotaCheckResult.data?.quotaBytes,
            percentageUsed: quotaCheckResult.data?.percentageUsed
          }
        },
        { status: 413 } // 413 Payload Too Large
      );
    }

    // Route to appropriate service based on request type
    if (isTiptapDocumentRequest) {
      // Use DocumentApplicationService for TipTap document creation
      const documentApplicationService = getDocumentApplicationService();
      
      const command: CreateTiptapDocumentCommand = {
        organizationId: OrganizationId.fromNumber(organizationId),
        tableId: TableId.fromNumber(tableId),
        fieldId: field.id,
        title: documentTitle,
        initialContent: initialContent ? JSON.parse(initialContent) : undefined,
        createdBy: UserId.fromString(session.user.id)
      };

      const result = await documentApplicationService.createTiptapDocument(command);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to create TipTap document' },
          { status: 400 }
        );
      }

      if (!result.data) {
        return NextResponse.json(
          { error: "No document metadata returned" },
          { status: 500 }
        );
      }

      // Increment storage usage after successful document creation
      await storageQuotaService.incrementUsage({
        organizationId,
        uploadSizeBytes,
        category: 'database'
      });

      return NextResponse.json({
        data: result.data,
        warnings: result.warnings
      }, { status: 201 });

    } else {
      // Use FileApplicationService for regular file upload
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

      // Increment storage usage after successful file upload
      await storageQuotaService.incrementUsage({
        organizationId,
        uploadSizeBytes,
        category: 'database'
      });

      return NextResponse.json({
        data: result.data,
        warnings: result.warnings
      }, { status: 201 });
    }
  } catch (error) {
    console.error("Error uploading file or creating document:", error);
      return NextResponse.json(
        { error: "Failed to upload file or create document" },
        { status: 500 }
      );
    }
  });
}