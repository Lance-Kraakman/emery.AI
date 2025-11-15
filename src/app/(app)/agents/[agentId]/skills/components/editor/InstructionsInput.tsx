'use client';

/**
 * StepInstructionsInput - Wrapper around UnifiedChatInput for form usage
 *
 * Provides step-specific configuration for the instructions input.
 * Uses UnifiedChatInput in form mode without send button.
 *
 * AIDEV-NOTE: Refactored to use UnifiedChatInput component.
 * Same features as chat input (@ mentions, tool selection) but form-optimized.
 * File attachments disabled for now but can be enabled by adding attachment props.
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
}

export function InstructionsInput({
  value,
  onChange,
  onToolsChange,
  tools,
  stepIndex
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
      enableAttachments={false}
    />
  );
}
