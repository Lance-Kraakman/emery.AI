/**
 * S3Image TipTap Extension
 *
 * Custom image node that stores s3Key instead of signed URLs.
 * Regenerates signed URLs on render for proper persistence.
 * Supports drag-to-resize with corner handles and alignment controls.
 *
 * Why this exists:
 * - S3 signed URLs are 400+ chars and expire after 1 hour
 * - Storing full URLs in TipTap JSON makes documents huge and breaks on reload
 * - s3Keys are ~60 chars and permanent - we regenerate signed URLs on demand
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

// Cache for signed URLs to avoid repeated API calls
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_DURATION_MS = 50 * 60 * 1000; // 50 minutes (URLs expire at 60 min)

// Minimum image width in pixels
const MIN_WIDTH = 50;

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
 * Resize handle component - appears at corners when image is selected
 */
function ResizeHandle({
  position,
  onResizeStart
}: {
  position: 'nw' | 'ne' | 'sw' | 'se';
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, position: string) => void;
}) {
  const positionStyles: Record<string, React.CSSProperties> = {
    nw: { top: -4, left: -4, cursor: 'nwse-resize' },
    ne: { top: -4, right: -4, cursor: 'nesw-resize' },
    sw: { bottom: -4, left: -4, cursor: 'nesw-resize' },
    se: { bottom: -4, right: -4, cursor: 'nwse-resize' },
  };

  return (
    <div
      className="absolute w-3 h-3 bg-white border-2 border-primary rounded-full z-10 hover:scale-125 transition-transform"
      style={positionStyles[position]}
      onMouseDown={(e) => onResizeStart(e, position)}
      onTouchStart={(e) => onResizeStart(e, position)}
    />
  );
}

type ImageAlign = 'left' | 'center' | 'right';

/**
 * Alignment controls - appears above image when selected
 */
function AlignmentControls({
  currentAlign,
  onAlignChange
}: {
  currentAlign: ImageAlign;
  onAlignChange: (align: ImageAlign) => void;
}) {
  const buttons: { align: ImageAlign; Icon: typeof AlignLeft }[] = [
    { align: 'left', Icon: AlignLeft },
    { align: 'center', Icon: AlignCenter },
    { align: 'right', Icon: AlignRight },
  ];

  return (
    <div
      className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white border border-border rounded-md shadow-sm p-1 z-20"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {buttons.map(({ align, Icon }) => (
        <button
          key={align}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAlignChange(align);
          }}
          className={`
            p-1.5 rounded transition-colors
            ${currentAlign === align
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }
          `}
          title={`Align ${align}`}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}

/**
 * React component for rendering S3 images with resize and alignment support
 */
function S3ImageNodeView({ node, selected, updateAttributes, editor }: NodeViewProps) {
  const { s3Key, alt, title, width, align } = node.attrs;
  const currentAlign: ImageAlign = align || 'left';

  // Don't use src from attrs - it's an expired signed URL from when document was saved
  // Always fetch fresh signed URL from s3Key
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number | null>(width);

  const fetchedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  // Fetch signed URL on mount
  useEffect(() => {
    if (s3Key && !fetchedRef.current) {
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
    } else if (!s3Key) {
      setError(true);
    }
  }, [s3Key]);

  // Sync width from node attrs
  useEffect(() => {
    setCurrentWidth(width);
  }, [width]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, position: string) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const containerWidth = containerRef.current?.offsetWidth || 0;

    resizeStartRef.current = {
      x: clientX,
      width: containerWidth,
    };
    setIsResizing(true);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!resizeStartRef.current) return;

      const moveClientX = 'touches' in moveEvent
        ? moveEvent.touches[0].clientX
        : moveEvent.clientX;

      // For left-side handles (nw, sw), dragging left increases size
      // For right-side handles (ne, se), dragging right increases size
      const isLeftHandle = position === 'nw' || position === 'sw';
      const deltaX = isLeftHandle
        ? resizeStartRef.current.x - moveClientX
        : moveClientX - resizeStartRef.current.x;

      const newWidth = Math.max(MIN_WIDTH, resizeStartRef.current.width + deltaX);
      setCurrentWidth(newWidth);
    };

    const handleEnd = () => {
      if (resizeStartRef.current && currentWidth) {
        // Save the final width to node attributes
        updateAttributes({ width: currentWidth });
      }
      resizeStartRef.current = null;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }, [currentWidth, updateAttributes]);

  // Handle image load error - might be expired URL, try to refresh
  const handleError = async () => {
    if (s3Key && !isLoading) {
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

  // Get image natural size after load
  const handleImageLoad = () => {
    setIsLoading(false);
    // If no width is set, don't constrain it - let it be natural size
  };

  const isEditable = editor.isEditable;
  const showHandles = selected && isEditable && imageUrl && !error;

  // Handle alignment change
  const handleAlignChange = useCallback((newAlign: ImageAlign) => {
    updateAttributes({ align: newAlign });
  }, [updateAttributes]);

  // Alignment styles using margin
  const alignmentStyles: Record<ImageAlign, React.CSSProperties> = {
    left: { marginRight: 'auto' },
    center: { marginLeft: 'auto', marginRight: 'auto' },
    right: { marginLeft: 'auto' },
  };

  return (
    <NodeViewWrapper>
      <div
        ref={containerRef}
        className={`
          relative inline-block my-4
          ${selected ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}
          ${isResizing ? 'select-none' : ''}
        `}
        style={{
          width: currentWidth ? `${currentWidth}px` : 'auto',
          display: 'block',
          ...alignmentStyles[currentAlign],
        }}
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
          <>
            <img
              ref={imageRef}
              src={imageUrl}
              alt={alt || ''}
              title={title || ''}
              onError={handleError}
              onLoad={handleImageLoad}
              draggable={false}
              className={`
                max-w-full h-auto rounded-lg border border-border
                ${isLoading ? 'opacity-50' : ''}
              `}
              style={{
                display: isLoading ? 'none' : 'block',
                width: currentWidth ? '100%' : 'auto',
              }}
            />

            {/* Alignment and resize controls - only show when selected and editable */}
            {showHandles && (
              <>
                <AlignmentControls
                  currentAlign={currentAlign}
                  onAlignChange={handleAlignChange}
                />
                <ResizeHandle position="nw" onResizeStart={handleResizeStart} />
                <ResizeHandle position="ne" onResizeStart={handleResizeStart} />
                <ResizeHandle position="sw" onResizeStart={handleResizeStart} />
                <ResizeHandle position="se" onResizeStart={handleResizeStart} />
              </>
            )}
          </>
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

  // Note: removed atom: true - it was causing attrs to not serialize properly
  inline: false,

  draggable: true,

  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.src) return {};
          return { src: attributes.src };
        },
      },
      s3Key: {
        default: null,
        parseHTML: element => element.getAttribute('data-s3-key'),
        renderHTML: attributes => {
          if (!attributes.s3Key) return {};
          return { 'data-s3-key': attributes.s3Key };
        },
      },
      alt: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.alt) return {};
          return { alt: attributes.alt };
        },
      },
      title: {
        default: null,
        renderHTML: attributes => {
          if (!attributes.title) return {};
          return { title: attributes.title };
        },
      },
      width: {
        default: null,
        parseHTML: element => {
          const width = element.getAttribute('width');
          return width ? parseInt(width, 10) : null;
        },
        renderHTML: attributes => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      align: {
        default: 'left',
        parseHTML: element => element.getAttribute('data-align') || 'left',
        renderHTML: attributes => {
          if (!attributes.align || attributes.align === 'left') return {};
          return { 'data-align': attributes.align };
        },
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
