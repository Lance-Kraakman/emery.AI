import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CreateBucketCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from './client';
import { v4 as uuidv4 } from 'uuid';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  s3Key: string;
  uploadedAt: string;
}

export async function ensureBucketExists(): Promise<void> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: 'test'
    }));
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      // Bucket doesn't exist, create it
      await s3Client.send(new CreateBucketCommand({
        Bucket: BUCKET_NAME
      }));
    }
  }
}

export function generateS3Key(workspaceId: number, tableId: number, fieldId: number, fileId: string, fileName: string): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `files/workspace-${workspaceId}/table-${tableId}/field-${fieldId}/${fileId}/${sanitizedFileName}`;
}

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  workspaceId: number,
  tableId: number,
  fieldId: number
): Promise<FileMetadata> {
  
  const fileId = uuidv4();
  const s3Key = generateS3Key(workspaceId, tableId, fieldId, fileId, fileName);
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      originalName: fileName.replace(/[^\w.-]/g, '_'), // Sanitize filename for header
      uploadedAt: new Date().toISOString(),
    }
  });

  await s3Client.send(command);

  return {
    id: fileId,
    name: fileName,
    size: buffer.length,
    mimeType,
    s3Key,
    uploadedAt: new Date().toISOString(),
  };
}

export async function generateDownloadUrl(s3Key: string, expiresIn: number = 900): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  // Generate a signed URL for downloading (GET request)
  return await getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFile(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  await s3Client.send(command);
}

export function validateFileType(mimeType: string): boolean {
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/*',
    'application/pdf',
    'text/*'
  ];

  return allowedTypes.some(allowedType => {
    if (allowedType.endsWith('*')) {
      const prefix = allowedType.slice(0, -1);
      return mimeType.startsWith(prefix);
    }
    return mimeType === allowedType;
  });
}

export function validateFileSize(size: number): boolean {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
  return size <= maxSize;
}