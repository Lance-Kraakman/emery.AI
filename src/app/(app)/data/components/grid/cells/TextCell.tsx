'use client';

import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import type { CellProps } from 'react-datasheet-grid';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

export type TextValue = string | null | undefined;
export interface TextCellConfiguration { placeholder?: string; }
export type TextCellProps = CellProps<TextValue, TextCellConfiguration>;

export function TextCell({ focus, active, rowData, setRowData, columnData }: TextCellProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [localValue, setLocalValue] = useState(rowData ?? '');

  // Sync local state when rowData changes externally (e.g., undo, external update)
  useEffect(() => {
    setLocalValue(rowData ?? '');
  }, [rowData]);

  // Listen for Cmd+Enter when cell is active (selected but not necessarily focused)
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setPopoverOpen(true);
      }
      if (e.key === 'Escape' && popoverOpen) {
        setPopoverOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, popoverOpen]);

  useLayoutEffect(() => {
    if (focus && !popoverOpen) ref.current?.focus();
  }, [focus, popoverOpen]);

  const handleChange = (value: string) => {
    setLocalValue(value);
    setRowData(value || null);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={(open) => !open && setPopoverOpen(false)}>
      <PopoverAnchor asChild>
        <input
          ref={ref}
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onDoubleClick={() => setPopoverOpen(true)}
          placeholder={active ? columnData?.placeholder : undefined}
          className="w-full h-full bg-transparent outline-none border-none px-2"
          style={{ pointerEvents: focus ? 'auto' : 'none' }}
        />
      </PopoverAnchor>
      <PopoverContent className="w-[300px] p-2" align="start">
        <Textarea
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPopoverOpen(false);
          }}
          className="min-h-[120px] resize-none"
          autoFocus
        />
        <div className="text-xs text-muted-foreground mt-1">
          Esc to close
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default TextCell;
