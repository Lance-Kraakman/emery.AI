'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { CellProps } from 'react-datasheet-grid';
import { CellWithTooltip } from '../CellWithTooltip';

/**
 * TextCell - Custom cell component for text, email, and phone fields
 *
 * Features:
 * - Displays text with truncation
 * - Shows tooltip on hover when content overflows
 * - Supports inline editing when focused
 */

export type TextValue = string | null | undefined;

export interface TextCellConfiguration {
  placeholder?: string;
}

export type TextCellProps = CellProps<TextValue, TextCellConfiguration>;

export function TextCell({
  rowData,
  setRowData,
  focus,
  stopEditing,
  active,
  columnData,
}: TextCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(rowData ?? '');

  // Sync input value when rowData changes externally
  useEffect(() => {
    if (!focus) {
      setInputValue(rowData ?? '');
    }
  }, [rowData, focus]);

  // Focus input when cell becomes active
  useEffect(() => {
    if (focus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [focus]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    // Commit value on blur
    setRowData(inputValue || null);
  }, [inputValue, setRowData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Commit and stop editing
      setRowData(inputValue || null);
      stopEditing({ nextRow: true });
    } else if (e.key === 'Escape') {
      // Cancel edit
      setInputValue(rowData ?? '');
      stopEditing({ nextRow: false });
    } else if (e.key === 'Tab') {
      // Commit on tab
      setRowData(inputValue || null);
    }
  }, [inputValue, rowData, setRowData, stopEditing]);

  // When focused/editing, show input
  if (focus) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full bg-transparent outline-none border-none px-0"
        placeholder={columnData?.placeholder}
      />
    );
  }

  // When not focused, show display with tooltip
  return (
    <CellWithTooltip value={rowData}>
      {rowData || <span className="text-muted-foreground">{columnData?.placeholder ?? ''}</span>}
    </CellWithTooltip>
  );
}

export default TextCell;
