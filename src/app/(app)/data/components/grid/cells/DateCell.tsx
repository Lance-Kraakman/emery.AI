'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { CellProps } from 'react-datasheet-grid';
import { CellWithTooltip } from '../CellWithTooltip';

/**
 * DateCell - Custom cell component for date fields
 *
 * Features:
 * - Displays dates with locale formatting
 * - Shows tooltip on hover when content overflows
 * - Supports inline editing with date picker when focused
 */

export type DateValue = Date | string | null | undefined;

export interface DateCellConfiguration {
  placeholder?: string;
  format?: 'date' | 'datetime' | 'time';
}

export type DateCellProps = CellProps<DateValue, DateCellConfiguration>;

export function DateCell({
  rowData,
  setRowData,
  focus,
  stopEditing,
  active,
  columnData,
}: DateCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert rowData to a date string for the input
  const getInputValue = useCallback((): string => {
    if (!rowData) return '';
    try {
      const date = rowData instanceof Date ? rowData : new Date(rowData);
      if (isNaN(date.getTime())) return '';
      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      return date.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  }, [rowData]);

  const [inputValue, setInputValue] = useState(getInputValue);

  // Sync input value when rowData changes externally
  useEffect(() => {
    if (!focus) {
      setInputValue(getInputValue());
    }
  }, [rowData, focus, getInputValue]);

  // Focus input when cell becomes active
  useEffect(() => {
    if (focus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focus]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const parseDate = useCallback((val: string): Date | null => {
    if (!val) return null;
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date;
  }, []);

  const handleBlur = useCallback(() => {
    // Commit value on blur
    setRowData(parseDate(inputValue));
  }, [inputValue, setRowData, parseDate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Commit and stop editing
      setRowData(parseDate(inputValue));
      stopEditing({ nextRow: true });
    } else if (e.key === 'Escape') {
      // Cancel edit
      setInputValue(getInputValue());
      stopEditing({ nextRow: false });
    } else if (e.key === 'Tab') {
      // Commit on tab
      setRowData(parseDate(inputValue));
    }
  }, [inputValue, setRowData, stopEditing, parseDate, getInputValue]);

  // Format date for display
  const formatDate = useCallback((val: DateValue): string => {
    if (!val) return '';
    try {
      const date = val instanceof Date ? val : new Date(val);
      if (isNaN(date.getTime())) return '';

      const format = columnData?.format ?? 'date';

      switch (format) {
        case 'datetime':
          return date.toLocaleString();
        case 'time':
          return date.toLocaleTimeString();
        case 'date':
        default:
          return date.toLocaleDateString();
      }
    } catch {
      return '';
    }
  }, [columnData?.format]);

  // When focused/editing, show date input
  if (focus) {
    return (
      <input
        ref={inputRef}
        type="datetime-local"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full bg-transparent outline-none border-none px-0 text-sm"
      />
    );
  }

  // When not focused, show display with tooltip
  const displayValue = formatDate(rowData);

  return (
    <CellWithTooltip value={rowData} formatValue={formatDate}>
      {displayValue || <span className="text-muted-foreground">{columnData?.placeholder ?? ''}</span>}
    </CellWithTooltip>
  );
}

export default DateCell;
