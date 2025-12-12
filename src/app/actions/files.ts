'use server'

// AIDEV-NOTE: Server Actions for file management using FileApplicationService
// Uses application service for business logic and validation

import { requirePermission } from "./permissions";
import { revalidatePath } from "next/cache";
import { getFileApplicationService, getTableApplicationService } from "@/ddd/application/di/container";
import { FieldId, OrganizationId, TableId } from "@/ddd/domain/shared/value-objects";
import type { UploadFileCommand, DeleteFileCommand } from "@/ddd/application/services/tables/file-application-service";
import type { Result } from "./types";

export async function uploadFileAction(formData: FormData): Promise<Result> {
  try {
    const session = await requirePermission("table:manage");

    const file = formData.get('file') as File;
    const organizationId = parseInt(formData.get('organizationId') as string);
    const tableId = parseInt(formData.get('tableId') as string);
    const fieldId = parseInt(formData.get('fieldId') as string);

    if (!file) {
      return {
        success: false,
        error: "No file provided"
      };
    }

    if (!organizationId || !tableId || !fieldId || isNaN(fieldId)) {
      return {
        success: false,
        error: "organizationId, tableId, and fieldId are required"
      };
    }

    // Use TableApplicationService to find field by ID
    const tableApplicationService = getTableApplicationService();
    const table = await tableApplicationService.getTable(TableId.fromNumber(tableId));
    if (!table) {
      return {
        success: false,
        error: "Table not found"
      };
    }
    const field = table.getFieldById(FieldId.fromNumber(fieldId));
    if (!field) {
      return {
        success: false,
        error: `Field with ID '${fieldId}' not found in table`
      };
    }

    // Use FileApplicationService for file upload
    const fileApplicationService = getFileApplicationService();
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const command: UploadFileCommand = {
      organizationId: OrganizationId.fromNumber(organizationId),
      tableId: TableId.fromNumber(tableId),
      fieldId: FieldId.fromNumber(field.id.value),
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

export async function deleteFileAction(fileId: string, fieldId: number, tableId: number, organizationId: number): Promise<Result> {
  try {
    const session = await requirePermission("table:manage");

    // Use TableApplicationService to find field by ID
    const tableApplicationService = getTableApplicationService();
    const table = await tableApplicationService.getTable(TableId.fromNumber(tableId));
    if (!table) {
      return {
        success: false,
        error: "Table not found"
      };
    }

    const field = table.getFieldById(FieldId.fromNumber(fieldId));
    if (!field) {
      return {
        success: false,
        error: `Field with ID '${fieldId}' not found in table`
      };
    }

    // Use FileApplicationService for file deletion
    const fileApplicationService = getFileApplicationService();
    
    const command: DeleteFileCommand = {
      fileId,
      fieldId: field.id,
      tableId: TableId.fromNumber(tableId),
      organizationId: OrganizationId.fromNumber(organizationId),
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
