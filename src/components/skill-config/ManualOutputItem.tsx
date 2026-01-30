'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { OutputDefinition } from '@/app/mappers/skill-mapper';

interface ManualOutputItemProps {
  output: OutputDefinition;
  onRemove: () => void;
}

export function ManualOutputItem({ output, onRemove }: ManualOutputItemProps) {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-muted/30 text-[11px] group">
      <code className="font-mono">{output.name}</code>
      {output.type && output.type !== 'text' && (
        <span className="text-[9px] bg-muted px-1 rounded">{output.type}</span>
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
