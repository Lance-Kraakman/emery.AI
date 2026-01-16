'use client';

/**
 * useSkillAttachments Hook
 *
 * Shared hook for managing skill attachments across AgenticSkillEditor and AgenticConfig.
 * Handles S3 uploads, pending state, and removal of attachments.
 */

import { useState, useCallback } from 'react';
import { uploadSkillAttachment, deleteSkillAttachment } from '@/app/actions/skills';

export interface SkillAttachment {
  url: string;
  filename: string;
  type: 'image' | 'file';
  size?: number;
  s3Key?: string;
}

interface UseSkillAttachmentsOptions {
  skillId?: number;
  existingAttachments?: SkillAttachment[];
  onAttachmentsChange?: (attachments: SkillAttachment[]) => void;
}

export function useSkillAttachments({
  skillId,
  existingAttachments = [],
  onAttachmentsChange,
}: UseSkillAttachmentsOptions) {
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleAttachmentAdd = useCallback(async (file: File) => {
    if (!skillId) {
      console.error('Cannot upload attachment: skillId is required');
      return;
    }

    setPendingAttachments((prev) => [...prev, file]);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', file.type.startsWith('image/') ? 'image' : 'file');

      const result = await uploadSkillAttachment(skillId, formData);

      if (result.success && result.data) {
        const newAttachment: SkillAttachment = {
          url: result.data.url,
          filename: result.data.filename,
          type: result.data.type as 'image' | 'file',
          size: result.data.sizeBytes,
          s3Key: result.data.s3Key,
        };
        onAttachmentsChange?.([...existingAttachments, newAttachment]);
      } else {
        console.error('Upload failed:', result.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setPendingAttachments((prev) => prev.filter((f) => f !== file));
      setIsUploading(false);
    }
  }, [skillId, existingAttachments, onAttachmentsChange]);

  const handleAttachmentRemove = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleExistingAttachmentRemove = useCallback(async (index: number) => {
    const attachment = existingAttachments[index];
    if (!attachment || !skillId) return;

    if (attachment.s3Key) {
      await deleteSkillAttachment(skillId, attachment.s3Key);
    }

    const newAttachments = existingAttachments.filter((_, i) => i !== index);
    onAttachmentsChange?.(newAttachments);
  }, [existingAttachments, skillId, onAttachmentsChange]);

  return {
    pendingAttachments,
    isUploading,
    handleAttachmentAdd,
    handleAttachmentRemove,
    handleExistingAttachmentRemove,
  };
}
