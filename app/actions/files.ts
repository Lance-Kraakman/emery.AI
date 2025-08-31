'use server'

// AIDEV-NOTE: Server Actions for file management using FileApplicationService
// Uses application service for business logic and validation

import { auth, hasPermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getFileApplicationService, getTableApplicationService } from "@/ddd/application/di/container";
import { FieldId, OrganizationId, TableId } from "@/ddd/domain/shared/value-objects";
import type { UploadFileCommand, DeleteFileCommand } from "@/ddd/application/services/tables/file-application-service";
import type { Result } from "./types";

export async function uploadFileAction(formData: FormData): Promise<Result> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Authentication required"
      };
    }

    const hasDataPermission = await hasPermission(session.user.id, "manage_data");
    if (!hasDataPermission) {
      return {
        success: false,
        error: "Permission denied: manage_data required"
      };
    }

    const file = formData.get('file') as File;
    const organizationId = parseInt(formData.get('organizationId') as string);
    const tableId = parseInt(formData.get('tableId') as string);
    const fieldName = formData.get('fieldName') as string;

    if (!file) {
      return {
        success: false,
        error: "No file provided"
      };
    }

    if (!organizationId || !tableId || !fieldName) {
      return {
        success: false,
        error: "organizationId, tableId, and fieldName are required"
      };
    }

    // Use TableApplicationService to find field by name and get its ID
    const tableApplicationService = getTableApplicationService();
    const table = await tableApplicationService.getTable(TableId.fromNumber(tableId));
    if (!table) {
      return {
        success: false,
        error: "Table not found"
      };
    }
    const field = table.getField(fieldName);
    if (!field) {
      return {
        success: false,
        error: `Field '${fieldName}' not found in table`
      };
    }

    // Use FileApplicationService for file upload
    const fileApplicationService = getFileApplicationService();
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const command: UploadFileCommand = {
      organizationId: OrganizationId.fromNumber(organizationId),
      tableId: TableId.fromNumber(tableId),
      fieldId: FieldId.fromNumber(field.id),
      file: {
        buffer,
        filename: file.name,
        mimeType: file.type
      },
    };

    const result = await fileApplicationService.uploadFile(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to upload file"
      };
    }

    revalidatePath('/mission-control');
    return { 
      success: true, 
      data: result.data
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to upload file" 
    };
  }
}

export async function deleteFileAction(fileId: string, fieldName: string, tableId: number, organizationId: number): Promise<Result> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Authentication required"
      };
    }

    const hasDataPermission = await hasPermission(session.user.id, "manage_data");
    if (!hasDataPermission) {
      return {
        success: false,
        error: "Permission denied: manage_data required"
      };
    }

    // Use TableApplicationService to find field by name and get its ID
    const tableApplicationService = getTableApplicationService();
    const table = await tableApplicationService.getTable(TableId.fromNumber(tableId));
    if (!table) {
      return {
        success: false,
        error: "Table not found"
      };
    }

    const field = table.getField(fieldName);
    if (!field) {
      return {
        success: false,
        error: `Field '${fieldName}' not found in table`
      };
    }

    // Use FileApplicationService for file deletion
    const fileApplicationService = getFileApplicationService();
    
    const command: DeleteFileCommand = {
      fileId,
      fieldId: FieldId.fromNumber(field.id),
      tableId: TableId.fromNumber(tableId),
      organizationId,
    };

    const result = await fileApplicationService.deleteFile(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete file"
      };
    }

    revalidatePath('/mission-control');
    return { 
      success: true
    };
  } catch (error) {
    console.error("Error deleting file:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to delete file" 
    };
  }
}
