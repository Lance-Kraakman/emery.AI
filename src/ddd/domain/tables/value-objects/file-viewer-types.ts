/**
 * File Viewer Types - Domain Value Objects
 * 
 * Defines file types for the file viewer system as domain concepts.
 * These constants should be used throughout the system instead of 
 * hardcoded strings for file type detection and routing.
 * 
 * AIDEV-NOTE: Centralized file type definitions for domain consistency
 */

// File viewer type enumeration
export const FILE_VIEWER_TYPES = {
  PDF: 'pdf',
  IMAGE: 'image',
  TEXT: 'text',
  OFFICE: 'office',
  GENERIC: 'generic'
} as const

export type FileViewerType = typeof FILE_VIEWER_TYPES[keyof typeof FILE_VIEWER_TYPES]

// File extension mappings for each viewer type
export const FILE_TYPE_EXTENSIONS: Record<FileViewerType, readonly string[]> = {
  [FILE_VIEWER_TYPES.PDF]: ['pdf'],
  [FILE_VIEWER_TYPES.IMAGE]: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'],
  [FILE_VIEWER_TYPES.TEXT]: ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'log', 'ini', 'cfg'],
  [FILE_VIEWER_TYPES.OFFICE]: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'],
  [FILE_VIEWER_TYPES.GENERIC]: []
} as const

// MIME type mappings for each viewer type
export const FILE_TYPE_MIME_PATTERNS: Record<FileViewerType, readonly string[]> = {
  [FILE_VIEWER_TYPES.PDF]: ['application/pdf'],
  [FILE_VIEWER_TYPES.IMAGE]: ['image/'],
  [FILE_VIEWER_TYPES.TEXT]: ['text/', 'application/json', 'application/xml'],
  [FILE_VIEWER_TYPES.OFFICE]: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument',
    'application/vnd.oasis.opendocument'
  ],
  [FILE_VIEWER_TYPES.GENERIC]: []
} as const

// Document type constants for TipTap vs File distinction
export const DOCUMENT_TYPES = {
  TIPTAP: 'tiptap',
  FILE: 'file'
} as const

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES]

// TipTap specific MIME type
export const TIPTAP_MIME_TYPE = 'application/vnd.tiptap+json' as const

/**
 * Type guard to check if a MIME type is TipTap
 */
export function isTiptapMimeType(mimeType: string): boolean {
  return mimeType === TIPTAP_MIME_TYPE
}

/**
 * Type guard to check if a file viewer type is valid
 */
export function isValidFileViewerType(type: string): type is FileViewerType {
  return Object.values(FILE_VIEWER_TYPES).includes(type as FileViewerType)
}

/**
 * Determine the appropriate viewer type based on MIME type
 */
export function determineViewerType(mimeType: string): FileViewerType {
  if (!mimeType) return FILE_VIEWER_TYPES.GENERIC

  // Check each viewer type's MIME patterns
  for (const [viewerType, patterns] of Object.entries(FILE_TYPE_MIME_PATTERNS)) {
    for (const pattern of patterns) {
      // Handle prefix patterns (e.g., 'image/' matches 'image/png')
      if (pattern.endsWith('/')) {
        if (mimeType.startsWith(pattern)) {
          return viewerType as FileViewerType
        }
      } else {
        // Exact match or startsWith for patterns like 'application/vnd.openxmlformats-officedocument'
        if (mimeType === pattern || mimeType.startsWith(pattern)) {
          return viewerType as FileViewerType
        }
      }
    }
  }

  return FILE_VIEWER_TYPES.GENERIC
}