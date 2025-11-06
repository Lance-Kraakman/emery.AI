/**
 * Attachment Metadata Value Objects
 *
 * AIDEV-NOTE: Lightweight metadata stored in chat_messages.metadata.attachments[]
 * Actual files stored in S3, these objects hold references and display info
 */

export type AttachmentType = 'image' | 'audio' | 'video' | 'document' | 'file'

export interface AttachmentMetadata {
  type: AttachmentType
  s3Key: string
  url: string // Pre-signed URL for access
  mimeType: string
  filename: string
  sizeBytes: number
  uploadedAt: Date
}

export interface ImageAttachmentMetadata extends AttachmentMetadata {
  type: 'image'
  width?: number
  height?: number
  thumbnailUrl?: string
}

export interface AudioAttachmentMetadata extends AttachmentMetadata {
  type: 'audio'
  durationSeconds?: number
  transcription?: string
}

export interface VideoAttachmentMetadata extends AttachmentMetadata {
  type: 'video'
  durationSeconds?: number
  thumbnailUrl?: string
}

export interface DocumentAttachmentMetadata extends AttachmentMetadata {
  type: 'document'
  pageCount?: number
  extractedText?: string
}

export type AnyAttachmentMetadata =
  | ImageAttachmentMetadata
  | AudioAttachmentMetadata
  | VideoAttachmentMetadata
  | DocumentAttachmentMetadata
  | AttachmentMetadata

/**
 * Helper to validate attachment metadata
 */
export function isValidAttachmentMetadata(data: unknown): data is AnyAttachmentMetadata {
  if (!data || typeof data !== 'object') return false

  const attachment = data as Partial<AttachmentMetadata>

  return !!(
    attachment.type &&
    attachment.s3Key &&
    attachment.url &&
    attachment.mimeType &&
    attachment.filename
  )
}

/**
 * Helper to create attachment metadata from upload result
 */
export function createAttachmentMetadata(
  type: AttachmentType,
  s3Key: string,
  url: string,
  file: File
): AttachmentMetadata {
  return {
    type,
    s3Key,
    url,
    mimeType: file.type,
    filename: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date()
  }
}
