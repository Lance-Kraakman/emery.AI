'use server'

/**
 * Server Actions for artifact data fetching
 *
 * AIDEV-NOTE: These actions fetch real artifact data from ReferenceTool configs
 * instead of creating BS default values. Used by EmeryChat for proper artifact creation.
 */

import { requirePermission } from "./permissions";
import { getDocumentApplicationService, getFileApplicationService } from "@/ddd/application/di/container";
import { FieldId, OrganizationId, TableId, UserId } from "@/ddd/domain/shared/value-objects";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Result } from "./types";
import type { DocumentFieldValue, FileFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

/**
 * Fetch document artifact data from tool config
 */
export async function fetchDocumentArtifactData(
  documentId: string,
  organizationId: number,
  filename: string,
  mimeType: string
): Promise<Result<DocumentFieldValue>> {
  try {
    await requirePermission("data:view");

    // Create DocumentFieldValue with real metadata
    // Content will be fetched by DocumentArtifactViewer when needed
    const documentField: DocumentFieldValue = {
      id: documentId,
      name: filename,
      size: 0, // Size is handled by file system
      mimeType: mimeType,
      s3Key: documentId, // Document ID is the storage key
      uploadedAt: new Date().toISOString(), // TODO: Get real upload date if needed
      documentMetadata: {
        title: filename,
        version: 1.0, // TODO: Get real version if needed
        documentType: mimeType === 'application/vnd.tiptap+json' ? 'tiptap' : 'file'
      }
    }

    return {
      success: true,
      data: documentField
    };
  } catch (error) {
    console.error("Error fetching document artifact data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch document data"
    };
  }
}

/**
 * Fetch TipTap document content using DocumentApplicationService
 */
export async function fetchTiptapDocumentContent(
  documentId: string,
  organizationId: number,
  tableId: number,
  fieldId: number
): Promise<Result<{ content: object; metadata: any }>> {
  console.log('[FETCH-TIPTAP-ACTION] Called with:', {
    documentId,
    organizationId,
    tableId,
    fieldId
  });

  try {
    const session = await requirePermission("data:view");

    console.log('[FETCH-TIPTAP-ACTION] Permission check passed, getting DocumentApplicationService...');
    const documentService = getDocumentApplicationService();

    console.log('[FETCH-TIPTAP-ACTION] Calling documentService.getTiptapContent...');
    const result = await documentService.getTiptapContent({
      documentId,
      organizationId: OrganizationId.fromNumber(organizationId),
      tableId: TableId.fromNumber(tableId),
      fieldId: FieldId.fromNumber(fieldId),
      requestedBy: UserId.fromString(session.user.id)
    });

    console.log('[FETCH-TIPTAP-ACTION] DocumentService result:', {
      success: result.success,
      hasData: !!result.data,
      error: result.error
    });

    return result;
  } catch (error) {
    console.error("Error fetching TipTap content:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch TipTap content"
    };
  }
}

/**
 * Fetch file artifact data from tool config
 */
export async function fetchFileArtifactData(
  fileId: string,
  organizationId: number,
  filename: string,
  mimeType: string
): Promise<Result<FileFieldValue>> {
  try {
    await requirePermission("data:view");

    // Create FileFieldValue with real data from tool config
    const fileField: FileFieldValue = {
      id: fileId,
      name: filename,
      size: 0, // TODO: Get real size from storage if needed
      mimeType: mimeType,
      s3Key: fileId, // File ID is the storage key
      uploadedAt: new Date().toISOString() // TODO: Get real upload date if needed
    }

    return {
      success: true,
      data: fileField
    };
  } catch (error) {
    console.error("Error fetching file artifact data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch file data"
    };
  }
}

/**
 * Get file download URL for artifacts
 */
export async function getFileDownloadUrl(
  fileId: string,
  organizationId: number
): Promise<Result<string>> {
  try {
    await requirePermission("data:view");

    // TODO: Implement proper download URL generation
    // For now, return a placeholder URL structure
    const downloadUrl = `/api/files/${fileId}/download?org=${organizationId}`;

    return {
      success: true,
      data: downloadUrl
    };
  } catch (error) {
    console.error("Error getting file download URL:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get download URL"
    };
  }
}

/**
 * Update TipTap document content
 */
export async function updateTiptapDocumentContent(
  documentId: string,
  organizationId: number,
  tableId: number,
  fieldId: number,
  content: object
): Promise<Result<DocumentFieldValue>> {
  try {
    await requirePermission("data:manage");

    // Get current user from session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: "User not authenticated"
      };
    }

    const documentService = getDocumentApplicationService();
    const result = await documentService.updateTiptapDocument({
      documentId,
      organizationId: OrganizationId.fromNumber(organizationId),
      tableId: TableId.fromNumber(tableId),
      fieldId: FieldId.fromNumber(fieldId),
      content: content,
      updatedBy: UserId.fromString(session.user.id)
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update document"
      };
    }

    return {
      success: true,
      data: result.data!
    };
  } catch (error) {
    console.error("Error updating TipTap document:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update document"
    };
  }
}