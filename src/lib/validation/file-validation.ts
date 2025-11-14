/**
 * File Validation Utilities
 *
 * Shared validation logic for file uploads across the application.
 * Used by chat attachments, skill attachments, and other file upload features.
 */

export const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const DEFAULT_ACCEPTED_TYPES = [
  'image/',
  'audio/',
  'video/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'text/',
];

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxBytes: number = DEFAULT_MAX_FILE_SIZE): boolean {
  return file.size <= maxBytes;
}

/**
 * Validate file type against allowed MIME types
 */
export function validateFileType(file: File, allowedTypes: string[] = DEFAULT_ACCEPTED_TYPES): boolean {
  return allowedTypes.some((type) => file.type.startsWith(type));
}

/**
 * Get file validation error message
 */
export function getFileValidationError(
  file: File,
  maxBytes: number = DEFAULT_MAX_FILE_SIZE,
  allowedTypes: string[] = DEFAULT_ACCEPTED_TYPES
): string | null {
  if (!validateFileSize(file, maxBytes)) {
    const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
    return `File ${file.name} is too large. Maximum size is ${maxMB}MB.`;
  }

  if (!validateFileType(file, allowedTypes)) {
    return `File type ${file.type} is not supported.`;
  }

  return null;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get icon type for file
 */
export function getFileIconType(file: File): 'image' | 'audio' | 'file' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}
