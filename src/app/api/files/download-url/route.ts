export const dynamic = 'force-dynamic';

/**
 * File Download URL Generation API
 *
 * GET: Generate a download URL for a file using its s3Key
 *
 * Query params:
 * - s3Key: The S3 storage key for the file
 *
 * AIDEV-NOTE: Returns a proxy URL (/api/files/stream) instead of raw S3 presigned URL
 * to avoid CORS issues with Docker-internal hostnames (minio-integration:9000).
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { validateS3KeyWithOrgAccess } from '@/lib/security/s3-key-validator';

/**
 * GET /api/files/download-url?s3Key=...
 * Generate a presigned download URL for a file
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const searchParams = request.nextUrl.searchParams;
    const s3Key = searchParams.get('s3Key');

    if (!s3Key) {
      return {
        success: false,
        error: 'Missing required query param: s3Key',
        status: 400
      };
    }

    // SECURITY: Validate S3 key format and org access (prevents path traversal)
    const validationError = validateS3KeyWithOrgAccess(s3Key, user.organizationId);
    if (validationError) {
      const isAccessDenied = validationError.includes('Access denied');
      return {
        success: false,
        error: validationError,
        status: isAccessDenied ? 403 : 400
      };
    }

    // Return proxy URL instead of raw S3 presigned URL
    // This avoids CORS issues with Docker-internal hostnames
    const downloadUrl = `/api/files/stream?s3Key=${encodeURIComponent(s3Key)}`;

    return {
      success: true,
      data: {
        downloadUrl
      }
    };
  });
}
