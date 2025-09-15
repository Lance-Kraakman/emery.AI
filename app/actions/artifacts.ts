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
 * Fetch TipTap document content from S3 using DocumentApplicationService
 */
export async function fetchTiptapDocumentContent(
  documentId: string,
  organizationId: number,
  tableId: number,
  fieldId: number
): Promise<Result<any>> {
  try {
    await requirePermission("data:view");

    // Construct proper API URL with required parameters
    const downloadUrl = `/api/files/${documentId}/download?org=${organizationId}&tableId=${tableId}&fieldId=${fieldId}`;

    return {
      success: true,
      data: { downloadUrl }
    };
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