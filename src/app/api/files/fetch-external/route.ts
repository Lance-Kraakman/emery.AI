/**
 * External Image Fetch Proxy API
 *
 * Server-side proxy to fetch external images, bypassing CORS restrictions.
 * Used when pasting images from Google Docs, web pages, etc.
 *
 * Security considerations:
 * - Only allows image MIME types
 * - Blocks private/internal IP addresses (SSRF protection)
 * - Size limit to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isPrivateUrl } from '@/lib/security/url-validator';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB limit for external images
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
];

/**
 * Validate a fetch response contains a valid image and return it.
 */
async function validateAndReturnImage(response: Response): Promise<NextResponse> {
  if (!response.ok) {
    return NextResponse.json(
      { error: `Failed to fetch image: ${response.status} ${response.statusText}` },
      { status: 502 }
    );
  }

  const contentType = response.headers.get('content-type')?.split(';')[0].trim();
  if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: `Invalid content type: ${contentType}. Only images are allowed.` },
      { status: 400 }
    );
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': arrayBuffer.byteLength.toString(),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'Missing required query param: url' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP/HTTPS URLs are allowed' },
        { status: 400 }
      );
    }

    // Block private/internal URLs (SSRF protection)
    if (isPrivateUrl(url)) {
      return NextResponse.json(
        { error: 'Cannot fetch from private/internal URLs' },
        { status: 403 }
      );
    }

    // Fetch the external image
    // SECURITY: Use 'manual' redirect to prevent redirect-to-internal-URL attacks.
    // If the response is a redirect, validate the target before following.
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EmeryBot/1.0)',
        'Accept': 'image/*',
      },
      redirect: 'manual',
    });

    // Handle redirects safely — validate target URL before following
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        return NextResponse.json(
          { error: 'Redirect with no location header' },
          { status: 502 }
        );
      }
      const redirectUrl = new URL(location, url).toString();
      if (isPrivateUrl(redirectUrl)) {
        return NextResponse.json(
          { error: 'Cannot follow redirect to private/internal URL' },
          { status: 403 }
        );
      }
      const redirectResponse = await fetch(redirectUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EmeryBot/1.0)',
          'Accept': 'image/*',
        },
        redirect: 'manual',
      });
      return validateAndReturnImage(redirectResponse);
    }

    return validateAndReturnImage(response);
  } catch (error) {
    console.error('Error fetching external image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch external image' },
      { status: 500 }
    );
  }
}
