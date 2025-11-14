/**
 * Attachment List Component
 *
 * Displays a list of file attachments with remove functionality.
 * Extracted from CustomChatInput for reusability across the application.
 */

import React from 'react';
import { AttachmentPreview } from './AttachmentPreview';

export interface AttachmentListProps {
  files: File[];
  onRemove: (index: number) => void;
  className?: string;
}

export function AttachmentList({ files, onRemove, className }: AttachmentListProps) {
  if (files.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className || ''}`}>
      {files.map((file, index) => (
        <AttachmentPreview
          key={index}
          file={file}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  );
}
