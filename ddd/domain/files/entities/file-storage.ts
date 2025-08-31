// AIDEV-NOTE: File storage domain entities - abstracts file storage operations from specific providers
// Defines contracts for file storage that can be implemented by S3, Azure Blob, local filesystem, etc.

import { FieldId, OrganizationId, TableId } from "../../shared/value-objects";

export interface StoredFile {
  id: string;                            // Unique file identifier
  key: string;                          // Storage key/path for retrieval
  name: string;                         // Original filename
  size: number;                         // File size in bytes
  mimeType: string;                     // MIME type
  uploadedAt: Date;                     // Upload timestamp
  metadata?: Record<string, any>;       // Additional storage metadata
  checksums?: {                         // File integrity verification
    md5?: string;
    sha256?: string;
  };
}

export interface FileUploadRequest {
  buffer: Buffer;                       // File content
  filename: string;                     // Original filename
  mimeType: string;                     // MIME type
  metadata?: Record<string, any>;       // Additional metadata to store
  organizationId?: OrganizationId;              // Organization context
  tableId?: TableId;                     // Table context  
  fieldId?: FieldId;                     // Field context
}

export interface FileUrlOptions {
  expiresIn?: number;                   // URL expiry in seconds (default: 900 = 15 minutes)
  downloadFilename?: string;            // Override download filename
  contentType?: string;                 // Override content type
}

// File validation and constraints
export interface FileValidationRule {
  maxSize?: number;                     // Max file size in bytes
  allowedTypes?: string[];              // Allowed MIME types or patterns
  requiredExtensions?: string[];        // Required file extensions
  prohibitedContent?: string[];         // Prohibited content patterns
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Error types for file storage operations
export class FileStorageError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'ACCESS_DENIED' | 'QUOTA_EXCEEDED' | 'INVALID_FILE' | 'NETWORK_ERROR' | 'UNKNOWN',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'FileStorageError';
  }
}

// Utility types for file operations
export type FileKey = string;          // Storage key identifier

