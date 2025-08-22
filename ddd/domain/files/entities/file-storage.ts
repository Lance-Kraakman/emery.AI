// AIDEV-NOTE: File storage domain entities - abstracts file storage operations from specific providers
// Defines contracts for file storage that can be implemented by S3, Azure Blob, local filesystem, etc.

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
  organizationId?: number;              // Organization context
  tableId?: number;                     // Table context  
  fieldId?: number;                     // Field context
}

export interface FileDownloadResponse {
  content: Buffer;                      // File content
  metadata: StoredFile;                 // File metadata
}

export interface FileUrlOptions {
  expiresIn?: number;                   // URL expiry in seconds (default: 900 = 15 minutes)
  downloadFilename?: string;            // Override download filename
  contentType?: string;                 // Override content type
}

export interface FileListOptions {
  prefix?: string;                      // Filter by key prefix
  limit?: number;                       // Max number of files to return
  continuationToken?: string;           // For pagination
}

export interface FileListResponse {
  files: StoredFile[];
  nextContinuationToken?: string;       // For paginated results
  totalCount?: number;                  // Total files matching criteria
}

export interface FileStorageStats {
  totalFiles: number;
  totalSize: number;                    // Total size in bytes
  storageProvider: string;              // e.g., 'S3', 'Azure', 'Local'
  lastUpdated: Date;
}

export interface FileCleanupOptions {
  dryRun?: boolean;                     // Preview cleanup without executing
  olderThan?: Date;                     // Clean files older than date
  unreferenced?: boolean;               // Clean files not referenced in database
}

export interface FileCleanupResult {
  deletedFiles: string[];               // File keys that were deleted
  deletedCount: number;                 // Number of files deleted
  freedBytes: number;                   // Bytes freed up
  errors: Array<{                       // Files that couldn't be deleted
    key: string;
    error: string;
  }>;
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

// File processing and transformation
export interface FileTransformRequest {
  operation: 'resize' | 'compress' | 'convert' | 'thumbnail';
  parameters: Record<string, any>;      // Operation-specific parameters
  outputFormat?: string;                // Desired output format
}

export interface FileTransformResult {
  originalFile: StoredFile;
  transformedFile: StoredFile;
  operation: string;
  parameters: Record<string, any>;
}

// Integration with field system
export interface FileFieldAttachment {
  fileId: string;                       // File storage ID
  fieldId: number;                      // Field that references this file
  tableId: number;                      // Table containing the field
  organizationId: number;               // Organization context
  attachedAt: Date;                     // When file was attached to field
  displayName?: string;                 // Custom display name for this attachment
  description?: string;                 // Optional description
  sortOrder?: number;                   // Order within field's file list
}

// Storage provider configuration
export interface StorageProviderConfig {
  provider: 'S3' | 'Azure' | 'GCP' | 'Local';
  endpoint?: string;                    // Custom endpoint (for S3-compatible)
  region?: string;                      // Provider region
  bucket?: string;                      // Bucket/container name
  pathPrefix?: string;                  // Path prefix for all files
  credentials?: {                       // Provider-specific credentials
    accessKey?: string;
    secretKey?: string;
    connectionString?: string;
  };
  options?: Record<string, any>;        // Provider-specific options
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

export class FileValidationError extends Error {
  constructor(
    message: string,
    public violations: string[],
    public fileDetails?: Partial<StoredFile>
  ) {
    super(message);
    this.name = 'FileValidationError';
  }
}

// Utility types for file operations
export type FileKey = string;          // Storage key identifier
export type FileOperationResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;                   // Operation duration in ms
};

// File access patterns for security
export interface FileAccessPolicy {
  organizationId?: number;             // Restrict to organization
  userId?: string;                     // Restrict to specific user
  fieldId?: number;                    // Restrict to specific field
  permissions: ('read' | 'write' | 'delete')[];
  expiresAt?: Date;                    // Policy expiration
}

export interface FileAccessContext {
  userId?: string;                     // Current user
  organizationId?: number;             // Current organization context
  fieldId?: number;                    // Field being accessed
  operation: 'read' | 'write' | 'delete';
}

// Batch file operations
export interface FileBatchOperation {
  type: 'upload' | 'delete' | 'copy' | 'move';
  files: Array<{
    key?: string;                      // For delete/copy/move operations
    upload?: FileUploadRequest;        // For upload operations
    destination?: string;              // For copy/move operations
  }>;
}

export interface FileBatchResult {
  successful: Array<{
    key: string;
    result: any;
  }>;
  failed: Array<{
    key?: string;
    error: string;
    details?: any;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number;
  };
}