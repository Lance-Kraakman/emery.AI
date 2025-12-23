/**
 * S3Image TipTap Extension
 *
 * Custom image node that stores s3Key instead of signed URLs.
 * Regenerates signed URLs on render for proper persistence.
 *
 * Why this exists:
 * - S3 signed URLs are 400+ chars and expire after 1 hour
 * - Storing full URLs in TipTap JSON makes documents huge and breaks on reload
 * - s3Keys are ~60 chars and permanent - we regenerate signed URLs on demand
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

// Cache for signed URLs to avoid repeated API calls
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_DURATION_MS = 50 * 60 * 1000; // 50 minutes (URLs expire at 60 min)

/**
 * Fetch a signed URL for an s3Key
 */
async function getSignedUrl(s3Key: string): Promise<string | null> {
  // Check cache first
  const cached = urlCache.get(s3Key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const response = await fetch(
      `/api/files/download-url?s3Key=${encodeURIComponent(s3Key)}`
    );

    if (!response.ok) {
      console.error('[S3Image] Failed to get signed URL:', response.status);
      return null;
    }

    const result = await response.json();
    const url = result.data.downloadUrl;

    // Cache the URL
    urlCache.set(s3Key, {
      url,
      expiresAt: Date.now() + CACHE_DURATION_MS,
    });

    return url;
  } catch (error) {
    console.error('[S3Image] Error fetching signed URL:', error);
    return null;
  }
}

/**
 * React component for rendering S3 images
 */
function S3ImageNodeView({ node, selected }: NodeViewProps) {
  const { src, s3Key, alt, title } = node.attrs;
  const [imageUrl, setImageUrl] = useState<string | null>(src || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // If we have an s3Key but no valid URL, fetch it
    if (s3Key && !imageUrl && !fetchedRef.current) {
      fetchedRef.current = true;
      setIsLoading(true);
      setError(false);

      getSignedUrl(s3Key)
        .then((url) => {
          if (url) {
            setImageUrl(url);
          } else {
            setError(true);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [s3Key, imageUrl]);

  // Handle image load error - might be expired URL, try to refresh
  const handleError = async () => {
    if (s3Key && !isLoading) {
      console.log('[S3Image] Image failed to load, refreshing URL for:', s3Key);
      // Clear cache and refetch
      urlCache.delete(s3Key);
      setIsLoading(true);
      const newUrl = await getSignedUrl(s3Key);
      if (newUrl) {
        setImageUrl(newUrl);
      } else {
        setError(true);
      }
      setIsLoading(false);
    }
  };

  return (
    <NodeViewWrapper>
      <div
        className={`
          relative inline-block my-4
          ${selected ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}
        `}
      >
        {isLoading && (
          <div className="flex items-center justify-center w-64 h-48 bg-muted rounded-lg">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex items-center justify-center w-64 h-48 bg-muted rounded-lg text-muted-foreground text-sm">
            Failed to load image
          </div>
        )}

        {imageUrl && !error && (
          <img
            src={imageUrl}
            alt={alt || ''}
            title={title || ''}
            onError={handleError}
            className={`
              max-w-full h-auto rounded-lg border border-border
              ${isLoading ? 'opacity-50' : ''}
            `}
            style={{ display: isLoading ? 'none' : 'block' }}
            onLoad={() => setIsLoading(false)}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * S3Image TipTap Node Extension
 */
export const S3Image = Node.create({
  name: 's3Image',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        // Don't persist src - it's just for display
        // The s3Key is what we persist
      },
      s3Key: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[data-s3-image]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { 'data-s3-image': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(S3ImageNodeView);
  },
});

export default S3Image;
