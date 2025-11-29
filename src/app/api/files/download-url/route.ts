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

    // Validate that the s3Key belongs to the user's organization
    // The s3Key format is: org_{orgId}/table_{tableId}/field_{fieldId}/{fileId}_{filename}
    const keyParts = s3Key.split('/');
    if (keyParts.length < 2) {
      return {
        success: false,
        error: 'Invalid s3Key format',
        status: 400
      };
    }

    const orgPart = keyParts[0];
    if (user.organizationId && !orgPart.includes(`org_${user.organizationId}`)) {
      return {
        success: false,
        error: 'Access denied: file not in your organization',
        status: 403
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
