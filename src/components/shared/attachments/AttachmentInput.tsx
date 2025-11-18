/**
 * Attachment Input Component
 *
 * File upload button with validation and hidden file input.
 * Extracted from CustomChatInput for reusability across the application.
 */

import React, { useRef } from 'react';
import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getFileValidationError,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_ACCEPTED_TYPES
} from '@/lib/validation/file-validation';

export interface AttachmentInputProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  maxSize?: number;
  accept?: string;
  acceptedTypes?: string[];
  multiple?: boolean;
  className?: string;
  buttonTitle?: string;
}

export function AttachmentInput({
  onFileSelect,
  disabled = false,
  maxSize = DEFAULT_MAX_FILE_SIZE,
  accept = 'image/*,audio/*,video/*,.pdf,.doc,.docx,.txt',
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  multiple = true,
  className,
  buttonTitle = 'Attach file (images, audio, documents)',
}: AttachmentInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    files.forEach((file) => {
      const error = getFileValidationError(file, maxSize, acceptedTypes);
      if (error) {
        alert(error);
        return;
      }

      onFileSelect(file);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Button
        onClick={handleButtonClick}
        disabled={disabled}
        variant="ghost"
        size="sm"
        className={`h-8 w-8 p-0 flex-shrink-0 ${className || ''}`}
        title={buttonTitle}
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );
}
