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
 * Check if a URL points to a private/internal IP address
 */
function isPrivateUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // Block private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./, // Link-local
      /^0\./, // Current network
      /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
    ];

    for (const range of privateRanges) {
      if (range.test(hostname)) {
        return true;
      }
    }

    // Block internal hostnames (no dots or ends with .local, .internal, etc.)
    if (!hostname.includes('.') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.localhost')) {
      return true;
    }

    return false;
  } catch {
    return true; // Invalid URL, block it
  }
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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EmeryBot/1.0)',
        'Accept': 'image/*',
      },
      // Don't follow too many redirects
      redirect: 'follow',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    // Validate content type
    const contentType = response.headers.get('content-type')?.split(';')[0].trim();
    if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Invalid content type: ${contentType}. Only images are allowed.` },
        { status: 400 }
      );
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.` },
        { status: 413 }
      );
    }

    // Read the image data
    const arrayBuffer = await response.arrayBuffer();

    // Double-check size after reading
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.` },
        { status: 413 }
      );
    }

    // Return the image
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error fetching external image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch external image' },
      { status: 500 }
    );
  }
}
