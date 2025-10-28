'use client';

/**
 * StepInstructionsInput - Thin wrapper around shared InstructionsWithToolsInput
 *
 * Provides step-specific configuration for the reusable instructions input component.
 *
 * AIDEV-NOTE: Refactored to use shared InstructionsWithToolsInput component.
 * All @ mention logic, tool selection, and dropdown handling is now in the shared component.
 * This wrapper only provides step-specific props (placeholder, id based on stepIndex).
 */

import React from 'react';
import { InstructionsWithToolsInput } from '@/components/shared/InstructionsWithToolsInput';
import type { ToolConfigDTO } from '@/app/mappers/skill-mapper';

interface StepInstructionsInputProps {
  value: string;
  onChange: (value: string) => void;
  onToolsChange: (tools: ToolConfigDTO[]) => void;
  tools: ToolConfigDTO[];
  stepIndex: number;
}

export function StepInstructionsInput({
  value,
  onChange,
  onToolsChange,
  tools,
  stepIndex
}: StepInstructionsInputProps) {
  return (
    <InstructionsWithToolsInput
      value={value}
      onChange={onChange}
      tools={tools}
      onToolsChange={onToolsChange}
      id={`step-${stepIndex}-instructions`}
      placeholder="Describe what this step should do... (Type @ to add tools)"
      minHeight="300px"
    />
  );
}
