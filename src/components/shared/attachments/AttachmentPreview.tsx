/**
 * Attachment Preview Component
 *
 * Displays a single file attachment as a badge with icon, name, size, and remove button.
 * Extracted from CustomChatInput for reusability across the application.
 */

import React from 'react';
import { X, Image as ImageIcon, File as FileIcon, Music } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatFileSize, getFileIconType } from '@/lib/validation/file-validation';

export interface AttachmentPreviewProps {
  file: File;
  onRemove: () => void;
  className?: string;
}

export function AttachmentPreview({ file, onRemove, className }: AttachmentPreviewProps) {
  const iconType = getFileIconType(file);

  const getIcon = () => {
    switch (iconType) {
      case 'image':
        return <ImageIcon className="w-3 h-3" />;
      case 'audio':
        return <Music className="w-3 h-3" />;
      default:
        return <FileIcon className="w-3 h-3" />;
    }
  };

  return (
    <Badge
      variant="secondary"
      className={`flex items-center gap-2 px-2 py-1 max-w-[200px] ${className || ''}`}
    >
      {getIcon()}
      <span className="text-xs truncate flex-1">{file.name}</span>
      <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-4 w-4 p-0 hover:bg-transparent"
      >
        <X className="h-3 w-3" />
      </Button>
    </Badge>
  );
}
