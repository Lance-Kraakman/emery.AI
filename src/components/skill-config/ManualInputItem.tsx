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
import type { InputDefinition } from '@/app/mappers/skill-mapper';
import type { SkillParameterType } from '@/ddd/domain/skills/entities/skill';

/**
 * Available input types for manual skill inputs
 * AIDEV-NOTE: Matches SkillParameterType from skill.ts
 */
const INPUT_TYPES: Array<{ value: SkillParameterType; label: string }> = [
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

interface ManualInputItemProps {
  input: InputDefinition;
  onRemove: () => void;
  onToggleRequired?: () => void;
  onTypeChange?: (type: SkillParameterType) => void;
}

export function ManualInputItem({
  input,
  onRemove,
  onToggleRequired,
  onTypeChange,
}: ManualInputItemProps) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-emerald-50/40 dark:bg-emerald-900/15 border-emerald-200/50 dark:border-emerald-800/30 text-[11px] group">
      <code className="font-mono">{input.name}</code>

      {/* Type selector */}
      {onTypeChange ? (
        <Select
          value={input.type || 'text'}
          onValueChange={(value) => onTypeChange(value as SkillParameterType)}
        >
          <SelectTrigger className="h-5 w-auto min-w-0 px-1.5 text-[9px] border-0 bg-muted hover:bg-muted/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INPUT_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        input.type && input.type !== 'text' && (
          <span className="text-[9px] bg-muted px-1 rounded">{input.type}</span>
        )
      )}

      {/* Required toggle */}
      {onToggleRequired ? (
        <button type="button" className="text-[9px] hover:opacity-70" onClick={onToggleRequired}>
          {input.required
            ? <span className="text-orange-600">req</span>
            : <span className="text-muted-foreground">opt</span>}
        </button>
      ) : (
        input.required && <span className="text-[9px] text-orange-600">req</span>
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
