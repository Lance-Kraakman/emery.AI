/**
 * File Type Detector - Domain Service
 * 
 * Domain service responsible for detecting file viewer types based on
 * file names and MIME types. Uses domain constants and business logic
 * to classify files for appropriate viewer routing.
 * 
 * AIDEV-NOTE: Stateless domain service following DDD patterns
 */

import { 
  FileViewerType, 
  FILE_VIEWER_TYPES, 
  FILE_TYPE_EXTENSIONS, 
  FILE_TYPE_MIME_PATTERNS,
  TIPTAP_MIME_TYPE,
  isTiptapMimeType
} from '../value-objects/file-viewer-types'

export class FileTypeDetector {
  /**
   * Detect file viewer type based on filename and MIME type
   * 
   * @param fileName - Original filename with extension
   * @param mimeType - MIME type of the file (optional)
   * @returns FileViewerType for routing to appropriate viewer
   */
  static detectViewerType(fileName: string, mimeType?: string): FileViewerType {
    // First check MIME type if available (more reliable)
    if (mimeType) {
      const typeFromMime = this.detectFromMimeType(mimeType)
      if (typeFromMime !== FILE_VIEWER_TYPES.GENERIC) {
        return typeFromMime
      }
    }

    // Fall back to extension-based detection
    return this.detectFromExtension(fileName)
  }

  /**
   * Detect if file is a TipTap document
   */
  static isTiptapDocument(mimeType?: string): boolean {
    return mimeType ? isTiptapMimeType(mimeType) : false
  }

  /**
   * Get file extension from filename
   */
  static getFileExtension(fileName: string): string | null {
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1).toLowerCase() : null
  }

  /**
   * Check if file type supports in-app viewing
   */
  static isViewableInApp(viewerType: FileViewerType): boolean {
    return viewerType !== FILE_VIEWER_TYPES.GENERIC
  }

  /**
   * Get display name for file viewer type
   */
  static getViewerTypeDisplayName(viewerType: FileViewerType): string {
    switch (viewerType) {
      case FILE_VIEWER_TYPES.PDF:
        return 'PDF Document'
      case FILE_VIEWER_TYPES.IMAGE:
        return 'Image'
      case FILE_VIEWER_TYPES.TEXT:
        return 'Text Document'
      case FILE_VIEWER_TYPES.OFFICE:
        return 'Office Document'
      case FILE_VIEWER_TYPES.GENERIC:
      default:
        return 'File'
    }
  }

  /**
   * Private method to detect type from MIME type
   */
  private static detectFromMimeType(mimeType: string): FileViewerType {
    // Check each viewer type's MIME patterns
    for (const [viewerType, patterns] of Object.entries(FILE_TYPE_MIME_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.endsWith('/')) {
          // Pattern like "image/" - check if MIME type starts with it
          if (mimeType.startsWith(pattern)) {
            return viewerType as FileViewerType
          }
        } else {
          // Exact match pattern
          if (mimeType === pattern || mimeType.includes(pattern)) {
            return viewerType as FileViewerType
          }
        }
      }
    }

    return FILE_VIEWER_TYPES.GENERIC
  }

  /**
   * Private method to detect type from file extension
   */
  private static detectFromExtension(fileName: string): FileViewerType {
    const extension = this.getFileExtension(fileName)
    if (!extension) {
      return FILE_VIEWER_TYPES.GENERIC
    }

    // Check each viewer type's extensions
    for (const [viewerType, extensions] of Object.entries(FILE_TYPE_EXTENSIONS)) {
      if (extensions.includes(extension)) {
        return viewerType as FileViewerType
      }
    }

    return FILE_VIEWER_TYPES.GENERIC
  }
}