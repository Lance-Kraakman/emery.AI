/**
 * Image Utilities for TipTap File Handling
 *
 * Pure utility functions for image processing.
 * No side effects - all functions are synchronous and stateless.
 */

/**
 * Check if a file is an image based on MIME type
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Convert a data URI to a Blob
 */
export function dataUriToBlob(dataUri: string): Blob | null {
  try {
    const [meta, base64] = dataUri.split(',');
    if (!meta || !base64) return null;

    const mimeMatch = meta.match(/:(.*?);/);
    const mimeType = mimeMatch?.[1] || 'image/png';

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('[image-utils] Failed to convert data URI to blob:', error);
    return null;
  }
}

/**
 * Extract image source URLs from HTML content
 */
export function extractImageSrcsFromHtml(html: string): string[] {
  const srcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  const srcs: string[] = [];
  let match;
  while ((match = srcRegex.exec(html)) !== null) {
    srcs.push(match[1]);
  }
  return srcs;
}

/**
 * Generate a filename from a URL or use a default
 */
export function getFilenameFromUrl(url: string, index: number): string {
  try {
    if (url.startsWith('data:')) {
      const mimeMatch = url.match(/data:(image\/\w+)/);
      const ext = mimeMatch?.[1]?.split('/')[1] || 'png';
      return `pasted-image-${index + 1}.${ext}`;
    }
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    if (filename && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(filename)) {
      return filename;
    }
    return `image-${index + 1}.png`;
  } catch {
    return `image-${index + 1}.png`;
  }
}
