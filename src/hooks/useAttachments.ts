/**
 * Use Attachments Hook
 *
 * State management for file attachments.
 * Extracted from useChatGRPC for reusability across the application.
 */

import { useState, useCallback } from 'react';

export interface UseAttachmentsReturn {
  attachments: File[];
  addAttachment: (file: File) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
  hasAttachments: boolean;
}

export function useAttachments(): UseAttachmentsReturn {
  const [attachments, setAttachments] = useState<File[]>([]);

  const addAttachment = useCallback((file: File) => {
    setAttachments((prev) => [...prev, file]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    hasAttachments: attachments.length > 0,
  };
}
