'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { CellProps } from 'react-datasheet-grid';
import { CellWithTooltip } from '../CellWithTooltip';

/**
 * NumberCell - Custom cell component for number fields
 *
 * Features:
 * - Displays numbers with optional formatting
 * - Shows tooltip on hover when content overflows
 * - Supports inline editing when focused
 * - Validates numeric input
 */

export type NumberValue = number | null | undefined;

export interface NumberCellConfiguration {
  placeholder?: string;
  decimals?: number;
  prefix?: string;  // e.g., "$"
  suffix?: string;  // e.g., "%"
}

export type NumberCellProps = CellProps<NumberValue, NumberCellConfiguration>;

export function NumberCell({
  rowData,
  setRowData,
  focus,
  stopEditing,
  active,
  columnData,
}: NumberCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(rowData?.toString() ?? '');

  // Sync input value when rowData changes externally
  useEffect(() => {
    if (!focus) {
      setInputValue(rowData?.toString() ?? '');
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
    // Allow empty, numbers, decimal point, and negative sign
    const value = e.target.value;
    if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
      setInputValue(value);
    }
  }, []);

  const parseValue = useCallback((val: string): number | null => {
    if (val === '' || val === '-') return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }, []);

  const handleBlur = useCallback(() => {
    // Commit value on blur
    setRowData(parseValue(inputValue));
  }, [inputValue, setRowData, parseValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Commit and stop editing
      setRowData(parseValue(inputValue));
      stopEditing({ nextRow: true });
    } else if (e.key === 'Escape') {
      // Cancel edit
      setInputValue(rowData?.toString() ?? '');
      stopEditing({ nextRow: false });
    } else if (e.key === 'Tab') {
      // Commit on tab
      setRowData(parseValue(inputValue));
    }
  }, [inputValue, rowData, setRowData, stopEditing, parseValue]);

  // Format number for display
  const formatNumber = useCallback((val: NumberValue): string => {
    if (val === null || val === undefined) return '';

    const { decimals, prefix = '', suffix = '' } = columnData ?? {};
    let formatted = decimals !== undefined
      ? val.toFixed(decimals)
      : val.toString();

    return `${prefix}${formatted}${suffix}`;
  }, [columnData]);

  // When focused/editing, show input
  if (focus) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full bg-transparent outline-none border-none px-0 text-right"
        placeholder={columnData?.placeholder}
      />
    );
  }

  // When not focused, show display with tooltip
  const displayValue = formatNumber(rowData);

  return (
    <CellWithTooltip value={rowData} formatValue={formatNumber} className="text-right">
      {displayValue || <span className="text-muted-foreground">{columnData?.placeholder ?? ''}</span>}
    </CellWithTooltip>
  );
}

export default NumberCell;
