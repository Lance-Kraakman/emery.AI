'use server'

import { auth, hasPermission } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { fileRepository } from "@/ddd/application/di/rag-container";
import { S3FileStorageRepository } from "@/ddd/infrastructure/storage/repositories/s3-file-storage-repository";
import { FileFieldService } from "@/ddd/domain/files/services/file-field-service";
import { fieldRepository } from "@/ddd/application/di/rag-container";

// Initialize services
const fileStorageRepository = new S3FileStorageRepository();
const fileFieldService = new FileFieldService(fieldRepository, fileStorageRepository, {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxFilesPerField: 10
});

export async function uploadFileAction(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Authentication required");
    }

    const hasDataPermission = await hasPermission(session.user.id, "manage_data");
    if (!hasDataPermission) {
      throw new Error("Permission denied: manage_data required");
    }

    const file = formData.get('file') as File;
    const organizationId = parseInt(formData.get('organizationId') as string);
    const tableId = parseInt(formData.get('tableId') as string);
    const fieldId = parseInt(formData.get('fieldId') as string);

    if (!file) {
      throw new Error("No file provided");
    }

    if (!organizationId || !tableId || !fieldId) {
      throw new Error("organizationId, tableId, and fieldId are required");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Use FileFieldService to handle file attachment
    const result = await fileFieldService.attachFiles({
      fieldId,
      organizationId,
      tableId,
      files: [{
        buffer,
        filename: file.name,
        mimeType: file.type,
        metadata: {
          uploadedBy: session.user.id,
          uploadedAt: new Date().toISOString()
        }
      }]
    });

    if (!result.success) {
      throw new Error(result.errors?.join(', ') || 'Failed to upload file');
    }

    revalidatePath('/mission-control');
    return { 
      success: true, 
      data: result.files?.[0] || null,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to upload file" };
  }
}

export async function deleteFileAction(fileId: string, fieldId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Authentication required");
    }

    const hasDataPermission = await hasPermission(session.user.id, "manage_data");
    if (!hasDataPermission) {
      throw new Error("Permission denied: manage_data required");
    }

    // Use FileFieldService to handle file detachment
    const result = await fileFieldService.detachFiles({
      fieldId,
      fileIds: [fileId]
    });

    if (!result.success) {
      throw new Error(result.errors?.join(', ') || 'Failed to delete file');
    }

    revalidatePath('/mission-control');
    return { 
      success: true,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error deleting file:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete file" };
  }
}
