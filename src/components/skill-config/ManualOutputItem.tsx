'use client';

import React from 'react';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OutputDefinition } from '@/app/mappers/skill-mapper';
import type { SkillParameterType } from '@/ddd/domain/skills/entities/skill';

/**
 * Available output types for manual skill outputs
 * AIDEV-NOTE: Matches SkillParameterType from skill.ts
 */
const OUTPUT_TYPES: Array<{ value: SkillParameterType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'json', label: 'JSON' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'email-thread', label: 'Email Thread' },
  { value: 'single-select', label: 'Single Select' },
  { value: 'multi-select', label: 'Multi Select' },
  { value: 'file', label: 'File' },
  { value: 'image', label: 'Image' },
  { value: 'document', label: 'Document' },
];

interface ManualOutputItemProps {
  output: OutputDefinition;
  onRemove: () => void;
  onTypeChange?: (type: SkillParameterType) => void;
}

export function ManualOutputItem({
  output,
  onRemove,
  onTypeChange,
}: ManualOutputItemProps) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-blue-50/40 dark:bg-blue-900/15 border-blue-200/50 dark:border-blue-800/30 text-[11px] group">
      <code className="font-mono">{output.name}</code>

      {/* Type selector */}
      {onTypeChange ? (
        <Select
          value={output.type || 'text'}
          onValueChange={(value) => onTypeChange(value as SkillParameterType)}
        >
          <SelectTrigger className="h-5 w-auto min-w-0 px-1.5 text-[9px] border-0 bg-muted hover:bg-muted/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTPUT_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        output.type && output.type !== 'text' && (
          <span className="text-[9px] bg-muted px-1 rounded">{output.type}</span>
        )
      )}

      {/* Remove button */}
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-1"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
