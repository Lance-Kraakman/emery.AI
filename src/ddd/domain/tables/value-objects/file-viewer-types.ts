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
  CODE: 'code',
  MARKDOWN: 'markdown',
  OFFICE: 'office',
  AUDIO: 'audio',
  VIDEO: 'video',
  GENERIC: 'generic'
} as const

export type FileViewerType = typeof FILE_VIEWER_TYPES[keyof typeof FILE_VIEWER_TYPES]

// File extension mappings for each viewer type
export const FILE_TYPE_EXTENSIONS: Record<FileViewerType, readonly string[]> = {
  [FILE_VIEWER_TYPES.PDF]: ['pdf'],
  [FILE_VIEWER_TYPES.IMAGE]: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'],
  [FILE_VIEWER_TYPES.TEXT]: ['txt', 'csv', 'log', 'ini', 'cfg'],
  [FILE_VIEWER_TYPES.CODE]: ['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'sql', 'sh', 'bash', 'zsh'],
  [FILE_VIEWER_TYPES.MARKDOWN]: ['md', 'mdx', 'markdown'],
  [FILE_VIEWER_TYPES.OFFICE]: ['doc', 'docx', 'ppt', 'pptx', 'odt', 'odp'],  // Note: xls, xlsx, ods removed - mammoth only handles DOCX
  [FILE_VIEWER_TYPES.AUDIO]: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'],
  [FILE_VIEWER_TYPES.VIDEO]: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'wmv'],
  [FILE_VIEWER_TYPES.GENERIC]: []
} as const

// MIME type mappings for each viewer type
// Note: Order matters - more specific patterns should come before generic ones
export const FILE_TYPE_MIME_PATTERNS: Record<FileViewerType, readonly string[]> = {
  [FILE_VIEWER_TYPES.PDF]: ['application/pdf'],
  [FILE_VIEWER_TYPES.IMAGE]: ['image/'],
  [FILE_VIEWER_TYPES.MARKDOWN]: ['text/markdown', 'text/x-markdown'],
  [FILE_VIEWER_TYPES.CODE]: [
    'application/javascript',
    'application/typescript',
    'text/javascript',
    'text/typescript',
    'text/x-python',
    'text/x-java',
    'text/x-c',
    'text/x-go',
    'text/x-rust',
    'text/x-ruby',
    'text/x-php',
    'text/x-sql',
    'text/x-shellscript',
    'application/json',
    'application/xml',
    'text/xml',
    'text/yaml',
    'text/css',
    'text/html'
  ],
  [FILE_VIEWER_TYPES.TEXT]: ['text/plain', 'text/csv'],
  [FILE_VIEWER_TYPES.OFFICE]: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument',
    'application/vnd.oasis.opendocument'
  ],
  [FILE_VIEWER_TYPES.AUDIO]: ['audio/'],
  [FILE_VIEWER_TYPES.VIDEO]: ['video/'],
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
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filename.length - 1) return ''
  return filename.slice(lastDot + 1).toLowerCase()
}

/**
 * Determine viewer type from file extension
 */
export function determineViewerTypeFromExtension(filename: string): FileViewerType {
  const ext = getFileExtension(filename)
  if (!ext) return FILE_VIEWER_TYPES.GENERIC

  for (const [viewerType, extensions] of Object.entries(FILE_TYPE_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return viewerType as FileViewerType
    }
  }

  return FILE_VIEWER_TYPES.GENERIC
}

/**
 * Determine the appropriate viewer type based on MIME type
 */
export function determineViewerType(mimeType: string, filename?: string): FileViewerType {
  if (!mimeType && !filename) return FILE_VIEWER_TYPES.GENERIC

  // First try MIME type matching
  if (mimeType) {
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
  }

  // Fall back to extension-based detection if MIME type didn't match
  if (filename) {
    const extType = determineViewerTypeFromExtension(filename)
    if (extType !== FILE_VIEWER_TYPES.GENERIC) {
      return extType
    }
  }

  return FILE_VIEWER_TYPES.GENERIC
}