export const dynamic = 'force-dynamic';

/**
 * File Streaming API
 *
 * GET: Stream file content from S3 storage
 *
 * Query params:
 * - s3Key: The S3 storage key for the file
 *
 * AIDEV-NOTE: Proxy endpoint to stream files from S3 without exposing internal
 * Docker hostnames. Solves CORS issues with presigned URLs that use minio-integration:9000.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { S3FileStorageRepository } from '@/ddd/infrastructure/storage/repositories/s3-file-storage-repository';
import { validateS3KeyWithOrgAccess } from '@/lib/security/s3-key-validator';

// Map common extensions to MIME types for Content-Type header
const mimeTypes: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  js: 'text/javascript',
  ts: 'text/typescript',
  tsx: 'text/typescript',
  jsx: 'text/javascript',
  html: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  xml: 'application/xml',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * GET /api/files/stream?s3Key=...
 * Stream file content from S3
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Authenticate the request manually (not using withAuthenticatedRoute for raw Response support)
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return Response.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const user = authResult.user;

    const searchParams = request.nextUrl.searchParams;
    const s3Key = searchParams.get('s3Key');

    if (!s3Key) {
      return Response.json(
        { success: false, error: 'Missing required query param: s3Key' },
        { status: 400 }
      );
    }

    // SECURITY: Validate S3 key format and org access (prevents path traversal)
    const validationError = validateS3KeyWithOrgAccess(s3Key, user.organizationId);
    if (validationError) {
      const isAccessDenied = validationError.includes('Access denied');
      return Response.json(
        { success: false, error: validationError },
        { status: isAccessDenied ? 403 : 400 }
      );
    }

    const fileStorage = new S3FileStorageRepository();
    const fileBuffer = await fileStorage.downloadFile(s3Key);

    // Extract filename from s3Key for Content-Type
    const filename = s3Key.split('/').pop() || 'file';
    const mimeType = getMimeType(filename);

    // Return file as streaming response
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[STREAM] Error streaming file:', error);
    return Response.json(
      { success: false, error: 'Failed to stream file' },
      { status: 500 }
    );
  }
}
