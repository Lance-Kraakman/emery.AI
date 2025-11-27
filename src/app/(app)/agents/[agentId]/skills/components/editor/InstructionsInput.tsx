'use client';

/**
 * StepInstructionsInput - Wrapper around UnifiedChatInput for form usage
 *
 * Provides step-specific configuration for the instructions input.
 * Uses UnifiedChatInput in form mode without send button.
 *
 * AIDEV-NOTE: Refactored to use UnifiedChatInput component.
 * Same features as chat input (@ mentions, tool selection, file attachments) but form-optimized.
 */

import React from 'react';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import type { ToolConfigDTO } from '@/app/mappers/skill-mapper';

interface InstructionsInputProps {
  value: string;
  onChange: (value: string) => void;
  onToolsChange: (tools: ToolConfigDTO[]) => void;
  tools: ToolConfigDTO[];
  stepIndex: number;
  // Attachment support (optional)
  pendingAttachments?: File[];
  onAttachmentAdd?: (file: File) => void;
  onAttachmentRemove?: (index: number) => void;
  // Existing attachments (already uploaded to S3)
  existingAttachments?: Array<{
    url: string;
    filename: string;
    type: 'image' | 'file';
    size?: number;
  }>;
  onExistingAttachmentRemove?: (index: number) => void;
}

export function InstructionsInput({
  value,
  onChange,
  onToolsChange,
  tools,
  stepIndex,
  pendingAttachments,
  onAttachmentAdd,
  onAttachmentRemove,
  existingAttachments,
  onExistingAttachmentRemove
}: InstructionsInputProps) {
  return (
    <UnifiedChatInput
      value={value}
      onChange={onChange}
      tools={tools}
      onToolsChange={onToolsChange}
      id={`step-${stepIndex}-instructions`}
      placeholder="Describe what this step should do... (Type @ to add tools)"
      mode="form"
      minHeight="300px"
      enableSendButton={false}
      enableAttachments={true}
      pendingAttachments={pendingAttachments}
      onAttachmentAdd={onAttachmentAdd}
      onAttachmentRemove={onAttachmentRemove}
      existingAttachments={existingAttachments}
      onExistingAttachmentRemove={onExistingAttachmentRemove}
    />
  );
}
