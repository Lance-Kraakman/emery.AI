'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { InputDefinition } from '@/app/mappers/skill-mapper';

interface ManualInputItemProps {
  input: InputDefinition;
  onRemove: () => void;
  onToggleRequired?: () => void;
}

export function ManualInputItem({ input, onRemove, onToggleRequired }: ManualInputItemProps) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-emerald-50/40 dark:bg-emerald-900/15 border-emerald-200/50 dark:border-emerald-800/30 text-[11px] group">
      <code className="font-mono">{input.name}</code>
      {input.type && input.type !== 'text' && (
        <span className="text-[9px] bg-muted px-1 rounded">{input.type}</span>
      )}
      {onToggleRequired ? (
        <button type="button" className="text-[9px] hover:opacity-70" onClick={onToggleRequired}>
          {input.required
            ? <span className="text-orange-600">req</span>
            : <span className="text-muted-foreground">opt</span>}
        </button>
      ) : (
        input.required && <span className="text-[9px] text-orange-600">req</span>
      )}
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
