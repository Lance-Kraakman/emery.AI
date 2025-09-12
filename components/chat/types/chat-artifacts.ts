/**
 * Custom artifact types for LlamaIndex chat-ui integration
 * 
 * These artifacts use existing DTOs for data structure consistency.
 * Documents and files are displayed in chat canvas overlay system.
 * 
 * AIDEV-NOTE: Custom artifact types using existing domain DTOs to maintain
 * data consistency and leverage existing type safety.
 */

import type { Artifact } from '@llamaindex/chat-ui'
import type { DocumentFieldValue, FileFieldValue } from '@/ddd/domain/tables/value-objects/field-values'

// ========================================
// Document Artifact Type
// ========================================

/**
 * Document artifact data structure using existing DocumentFieldValue DTO
 */
export interface DocumentArtifactData {
  /** Document data from existing DTO */
  documentField: DocumentFieldValue
  /** Table context for document */
  tableId: number
  /** Field context for document */
  fieldId: number
  /** Interaction mode - edit for TipTap, view for others */
  mode: 'view' | 'edit'
  /** Original file URL for fallback access */
  fileUrl?: string
}

/**
 * Document artifact for TipTap documents and other document types
 * Uses LlamaIndex Artifact<T> with custom 'emery-document' type
 */
export type DocumentArtifact = Artifact<DocumentArtifactData, 'emery-document'>

// ========================================
// File Artifact Type  
// ========================================

/**
 * File artifact data structure using existing FileFieldValue DTO
 */
export interface FileArtifactData {
  /** File data from existing DTO */
  fileField: FileFieldValue
  /** Table context for file */
  tableId: number
  /** Field context for file */
  fieldId: number
  /** Detected viewer type for appropriate rendering */
  viewerType: 'pdf' | 'image' | 'text' | 'office' | 'generic'
  /** Display filename */
  fileName: string
  /** File URL for viewing/downloading */
  fileUrl: string
}

/**
 * File artifact for PDFs, images, and other file types
 * Uses LlamaIndex Artifact<T> with custom 'emery-file' type
 */
export type FileArtifact = Artifact<FileArtifactData, 'emery-file'>

// ========================================
// Artifact Union and Type Guards
// ========================================

/**
 * Union of all custom artifact types
 */
export type EmeryArtifact = DocumentArtifact | FileArtifact

/**
 * Type guard to check if artifact is a document artifact
 */
export function isDocumentArtifact(artifact: any): artifact is DocumentArtifact {
  return artifact && artifact.type === 'emery-document'
}

/**
 * Type guard to check if artifact is a file artifact  
 */
export function isFileArtifact(artifact: any): artifact is FileArtifact {
  return artifact && artifact.type === 'emery-file'
}

/**
 * Type guard to check if artifact is any Emery custom artifact
 */
export function isEmeryArtifact(artifact: any): artifact is EmeryArtifact {
  return isDocumentArtifact(artifact) || isFileArtifact(artifact)
}

// ========================================
// Artifact Creation Helpers
// ========================================

/**
 * Helper to create a document artifact from DocumentFieldValue
 */
export function createDocumentArtifact(
  documentField: DocumentFieldValue,
  tableId: number,
  fieldId: number,
  mode: 'view' | 'edit' = 'view',
  fileUrl?: string
): DocumentArtifact {
  // Create artifact-like object for LlamaIndex integration
  // AIDEV-NOTE: Simplified structure that matches expected patterns
  return {
    type: 'emery-document',
    data: {
      documentField,
      tableId,
      fieldId,
      mode,
      fileUrl
    }
  } as DocumentArtifact
}

/**
 * Helper to create a file artifact from FileFieldValue
 */
export function createFileArtifact(
  fileField: FileFieldValue,
  tableId: number,
  fieldId: number,
  viewerType: FileArtifactData['viewerType'],
  fileUrl: string
): FileArtifact {
  // Create artifact-like object for LlamaIndex integration
  // AIDEV-NOTE: Simplified structure that matches expected patterns
  return {
    type: 'emery-file',
    data: {
      fileField,
      tableId,
      fieldId,
      viewerType,
      fileName: fileField.name,
      fileUrl
    }
  } as FileArtifact
}

// ========================================
// Artifact Metadata Utilities
// ========================================

/**
 * Extract display information from document artifact
 */
export function getDocumentDisplayInfo(artifact: DocumentArtifact) {
  const { documentField, mode } = artifact.data
  const metadata = documentField.documentMetadata
  
  return {
    title: metadata?.title || documentField.name,
    subtitle: `${documentField.mimeType} • ${mode} mode`,
    wordCount: metadata?.tiptapMetadata?.wordCount,
    readTime: metadata?.tiptapMetadata?.estimatedReadTime,
    lastEdited: metadata?.lastEditedAt,
    version: metadata?.version || 1
  }
}

/**
 * Extract display information from file artifact
 */
export function getFileDisplayInfo(artifact: FileArtifact) {
  const { fileField, viewerType } = artifact.data
  
  return {
    title: fileField.name,
    subtitle: `${fileField.mimeType} • ${viewerType} viewer`,
    size: fileField.size,
    uploadedAt: fileField.uploadedAt,
    sizeFormatted: formatFileSize(fileField.size)
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}