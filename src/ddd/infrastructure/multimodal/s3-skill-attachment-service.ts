/**
 * S3 Skill Attachment Service
 *
 * AIDEV-NOTE: Handles S3 storage for skill attachments (images, audio, files)
 * Reuses existing S3 infrastructure with skill-specific key structure:
 * skill-attachments/{org_id}/{skill_id}/{uuid}.{ext}
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { s3Client, BUCKET_NAME } from '@/lib/s3/client'
import type {
  AttachmentMetadata,
  ImageAttachmentMetadata,
  AudioAttachmentMetadata,
  DocumentAttachmentMetadata,
  AttachmentType
} from '@/ddd/domain/multimodal/value-objects/attachment-metadata'

export interface UploadSkillAttachmentRequest {
  file: File | Buffer
  organizationId: number
  skillId: number
  type: AttachmentType
}

export interface UploadSkillAttachmentResult {
  s3Key: string
  url: string
  metadata: AttachmentMetadata
}

export class S3SkillAttachmentService {
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
    const customEndpoint = process.env.AWS_ENDPOINT_URL
    return !customEndpoint
  }

  /**
   * Generate S3 key for skill attachment
   * Pattern: skill-attachments/{org_id}/{skill_id}/{uuid}.{ext}
   */
  private generateS3Key(
    organizationId: number,
    skillId: number,
    filename: string
  ): string {
    const fileId = uuidv4()
    const extension = filename.split('.').pop() || 'bin'
    const sanitizedExt = extension.replace(/[^\w.-]/g, '_')

    return `skill-attachments/${organizationId}/${skillId}/${fileId}.${sanitizedExt}`
  }

  /**
   * Upload attachment to S3
   */
  async uploadAttachment(
    request: UploadSkillAttachmentRequest
  ): Promise<UploadSkillAttachmentResult> {
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
        request.skillId,
        filename
      )

      const sizeBytes = buffer.length

      // Upload to S3 with optional encryption
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
        ...(this.shouldUseEncryption() && {
          ServerSideEncryption: 'AES256'
        })
      })

      await this.s3.send(putCommand)

      // Generate pre-signed URL
      const url = await this.generateAttachmentUrl(s3Key)

      // Create metadata based on type
      const baseMetadata = {
        s3Key,
        url,
        mimeType,
        filename,
        sizeBytes,
        uploadedAt: new Date()
      }

      let metadata: AttachmentMetadata

      switch (request.type) {
        case 'image':
          metadata = {
            ...baseMetadata,
            type: 'image'
          } as ImageAttachmentMetadata
          break
        case 'audio':
          metadata = {
            ...baseMetadata,
            type: 'audio'
          } as AudioAttachmentMetadata
          break
        case 'document':
          metadata = {
            ...baseMetadata,
            type: 'document'
          } as DocumentAttachmentMetadata
          break
        default:
          metadata = {
            ...baseMetadata,
            type: request.type
          }
      }

      return {
        s3Key,
        url,
        metadata
      }
    } catch (error) {
      console.error('[S3SkillAttachmentService] Upload failed:', error)
      throw new Error(`Failed to upload skill attachment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate pre-signed URL for attachment access
   */
  async generateAttachmentUrl(s3Key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      })

      const url = await getSignedUrl(this.s3, command, {
        expiresIn: this.urlExpirationSeconds
      })

      return url
    } catch (error) {
      console.error('[S3SkillAttachmentService] URL generation failed:', error)
      throw new Error(`Failed to generate attachment URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete attachment from S3
   */
  async deleteAttachment(s3Key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      })

      await this.s3.send(command)
    } catch (error) {
      console.error('[S3SkillAttachmentService] Delete failed:', error)
      throw new Error(`Failed to delete skill attachment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete all attachments for a skill
   */
  async deleteSkillAttachments(organizationId: number, skillId: number): Promise<void> {
    try {
      const prefix = `skill-attachments/${organizationId}/${skillId}/`

      // In production, would need to list objects first and batch delete
      // For now, this is a placeholder for the deletion logic
      console.log(`[S3SkillAttachmentService] Would delete all attachments with prefix: ${prefix}`)

      // TODO: Implement full deletion logic with object listing
    } catch (error) {
      console.error('[S3SkillAttachmentService] Bulk delete failed:', error)
      throw new Error(`Failed to delete skill attachments: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get MIME type from attachment type
   */
  private getMimeTypeFromType(type: AttachmentType): string {
    const mimeTypeMap: Record<AttachmentType, string> = {
      image: 'image/png',
      audio: 'audio/mpeg',
      video: 'video/mp4',
      document: 'application/pdf',
      file: 'application/octet-stream'
    }

    return mimeTypeMap[type] || 'application/octet-stream'
  }
}

// Singleton instance
export const s3SkillAttachmentService = new S3SkillAttachmentService()
