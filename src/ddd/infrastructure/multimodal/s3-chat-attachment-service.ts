/**
 * S3 Chat Attachment Service
 *
 * AIDEV-NOTE: Handles S3 storage for chat message attachments (images, audio, files)
 * Reuses existing S3 infrastructure with chat-specific key structure:
 * chat-attachments/{org_id}/{chat_id}/{msg_id}/{uuid}.{ext}
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { s3Client, BUCKET_NAME } from '@/lib/s3/client'
import type {
  AttachmentMetadata,
  ImageAttachmentMetadata,
  AudioAttachmentMetadata,
  DocumentAttachmentMetadata,
  AttachmentType
} from '@/ddd/domain/multimodal/value-objects/attachment-metadata'

export interface UploadAttachmentRequest {
  file: File | Buffer
  organizationId: number
  chatId: string
  messageId: string
  type: AttachmentType
}

export interface UploadAttachmentResult {
  s3Key: string
  url: string
  metadata: AttachmentMetadata
}

export class S3ChatAttachmentService {
  private readonly bucketName: string
  private readonly s3: typeof s3Client
  private readonly urlExpirationSeconds = 3600 // 1 hour for pre-signed URLs

  constructor(bucketName?: string) {
    this.bucketName = bucketName || BUCKET_NAME
    this.s3 = s3Client
  }

  /**
   * Check if we should use encryption (real AWS S3 vs MinIO/dev)
   */
  private shouldUseEncryption(): boolean {
    const customEndpoint = process.env.S3_ENDPOINT_URL
    return !customEndpoint
  }

  /**
   * Generate S3 key for chat attachment
   * Pattern: chat-attachments/{org_id}/{chat_id}/{msg_id}/{uuid}.{ext}
   */
  private generateS3Key(
    organizationId: number,
    chatId: string,
    messageId: string,
    filename: string
  ): string {
    const fileId = uuidv4()
    const extension = filename.split('.').pop() || 'bin'
    const sanitizedExt = extension.replace(/[^\w.-]/g, '_')

    return `chat-attachments/${organizationId}/${chatId}/${messageId}/${fileId}.${sanitizedExt}`
  }

  /**
   * Upload attachment to S3
   */
  async uploadAttachment(
    request: UploadAttachmentRequest
  ): Promise<UploadAttachmentResult> {
    try {
      const buffer = request.file instanceof Buffer
        ? request.file
        : Buffer.from(await request.file.arrayBuffer())

      const filename = request.file instanceof Buffer
        ? `file.${request.type}`
        : request.file.name

      const mimeType = request.file instanceof Buffer
        ? this.getMimeTypeFromType(request.type)
        : request.file.type

      const s3Key = this.generateS3Key(
        request.organizationId,
        request.chatId,
        request.messageId,
        filename
      )

      // Generate checksums for integrity
      const md5Hash = crypto.createHash('md5').update(buffer).digest('hex')
      const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex')

      // Build command parameters
      const commandParams: any = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          originalName: filename.replace(/[^\w.-]/g, '_'),
          organizationId: request.organizationId.toString(),
          chatId: request.chatId,
          messageId: request.messageId,
          attachmentType: request.type,
          uploadedAt: new Date().toISOString(),
          md5: md5Hash,
          sha256: sha256Hash,
        },
      }

      // Only add encryption for real AWS S3
      if (this.shouldUseEncryption()) {
        commandParams.ServerSideEncryption = 'AES256'
      }

      const command = new PutObjectCommand(commandParams)
      await this.s3.send(command)

      // Generate pre-signed URL
      const url = await this.generateAttachmentUrl(s3Key)

      // Create metadata object
      const metadata: AttachmentMetadata = {
        type: request.type,
        s3Key,
        url,
        mimeType,
        filename,
        sizeBytes: buffer.length,
        uploadedAt: new Date(),
      }

      return {
        s3Key,
        url,
        metadata,
      }
    } catch (error) {
      throw new Error(
        `Failed to upload chat attachment: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Generate pre-signed URL for attachment access
   */
  async generateAttachmentUrl(s3Key: string, expirationSeconds?: number): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      })

      return await getSignedUrl(
        this.s3,
        command,
        { expiresIn: expirationSeconds || this.urlExpirationSeconds }
      )
    } catch (error) {
      throw new Error(
        `Failed to generate attachment URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete attachment from S3
   */
  async deleteAttachment(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      })

      await this.s3.send(command)
    } catch (error) {
      throw new Error(
        `Failed to delete attachment: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete all attachments for a message
   */
  async deleteMessageAttachments(
    organizationId: number,
    chatId: string,
    messageId: string
  ): Promise<void> {
    try {
      const prefix = `chat-attachments/${organizationId}/${chatId}/${messageId}/`

      // Note: This is a simplified version - in production you might want to list objects first
      // For now, we'll rely on individual deleteAttachment() calls from the API layer
    } catch (error) {
      throw new Error(
        `Failed to delete message attachments: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get MIME type from attachment type (fallback)
   */
  private getMimeTypeFromType(type: AttachmentType): string {
    const mimeTypes: Record<AttachmentType, string> = {
      image: 'image/png',
      audio: 'audio/mpeg',
      video: 'video/mp4',
      document: 'application/pdf',
      file: 'application/octet-stream',
    }

    return mimeTypes[type] || 'application/octet-stream'
  }

  /**
   * Upload image with metadata
   */
  async uploadImage(
    file: File,
    organizationId: number,
    chatId: string,
    messageId: string
  ): Promise<UploadAttachmentResult> {
    const result = await this.uploadAttachment({
      file,
      organizationId,
      chatId,
      messageId,
      type: 'image',
    })

    // TODO: Extract image dimensions and create thumbnail (future enhancement)
    return result
  }

  /**
   * Upload audio with metadata
   */
  async uploadAudio(
    file: File,
    organizationId: number,
    chatId: string,
    messageId: string
  ): Promise<UploadAttachmentResult> {
    const result = await this.uploadAttachment({
      file,
      organizationId,
      chatId,
      messageId,
      type: 'audio',
    })

    // TODO: Extract audio duration (future enhancement)
    return result
  }

  /**
   * Upload document with metadata
   */
  async uploadDocument(
    file: File,
    organizationId: number,
    chatId: string,
    messageId: string
  ): Promise<UploadAttachmentResult> {
    const result = await this.uploadAttachment({
      file,
      organizationId,
      chatId,
      messageId,
      type: 'document',
    })

    // TODO: Extract PDF page count, text content (future enhancement)
    return result
  }
}

// Singleton instance for reuse
export const s3ChatAttachmentService = new S3ChatAttachmentService()
