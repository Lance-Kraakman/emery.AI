/**
 * FileAttachment TipTap Node Extension
 *
 * Custom node for displaying non-image file attachments (PDFs, docs, etc.)
 * as styled cards within the TipTap document.
 */

import { Node, mergeAttributes, Attribute } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react';
import React, { useState } from 'react';
import { File as FileIcon, Music, Download, Loader2 } from 'lucide-react';
import { formatFileSize } from '@/lib/validation/file-validation';

export interface FileAttachmentAttributes {
  src: string | null;
  filename: string;
  mimeType: string;
  size: number;
  s3Key: string;
  organizationId: number | null;
  tableId: number | null;
  fieldId: number | null;
}

/**
 * React component for rendering the file attachment in the editor
 */
function FileAttachmentNodeView({ node, selected }: NodeViewProps) {
  const attrs = node.attrs as FileAttachmentAttributes;
  const { src, filename, mimeType, size, s3Key } = attrs;
  const [downloadUrl, setDownloadUrl] = useState<string | null>(src);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Determine icon based on mime type
  const getIcon = () => {
    if (mimeType.startsWith('audio/')) {
      return <Music className="w-5 h-5 text-muted-foreground" />;
    }
    return <FileIcon className="w-5 h-5 text-muted-foreground" />;
  };

  // Refresh URL if needed (S3 signed URLs expire)
  const refreshUrl = async () => {
    if (!s3Key) return;

    setIsRefreshing(true);
    try {
      const response = await fetch(
        `/api/files/download-url?s3Key=${encodeURIComponent(s3Key)}`
      );

      if (response.ok) {
        const data = await response.json();
        setDownloadUrl(data.data.downloadUrl);
      }
    } catch (error) {
      console.error('Failed to refresh download URL:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();

    // If URL might be expired (older than 10 minutes), refresh it first
    if (!downloadUrl) {
      await refreshUrl();
    }

    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <NodeViewWrapper>
      <div
        className={`
          inline-flex items-center gap-3 px-4 py-3 my-2
          bg-muted/50 border border-border rounded-lg
          cursor-pointer hover:bg-muted/70 transition-colors
          ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
        `}
        onClick={handleDownload}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleDownload(e as any);
          }
        }}
      >
        {/* File icon */}
        <div className="flex-shrink-0">
          {getIcon()}
        </div>

        {/* File info */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium truncate max-w-[300px]">
            {filename}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(size)}
          </span>
        </div>

        {/* Download indicator */}
        <div className="flex-shrink-0">
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

/**
 * FileAttachment TipTap Node Extension
 */
export const FileAttachment = Node.create({
  name: 'fileAttachment',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      filename: {
        default: '',
      },
      mimeType: {
        default: '',
      },
      size: {
        default: 0,
      },
      s3Key: {
        default: '',
      },
      organizationId: {
        default: null,
      },
      tableId: {
        default: null,
      },
      fieldId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-file-attachment]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-file-attachment': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentNodeView);
  },
});

export default FileAttachment;
