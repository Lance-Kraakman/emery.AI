'use client';

import React, { useRef, useLayoutEffect } from 'react';
import type { CellProps } from 'react-datasheet-grid';

export type NumberValue = number | null | undefined;
export interface NumberCellConfiguration {
  placeholder?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}
export type NumberCellProps = CellProps<NumberValue, NumberCellConfiguration>;

export function NumberCell({ focus, active, rowData, setRowData, columnData }: NumberCellProps) {
  const ref = useRef<HTMLInputElement>(null);

  // Focus the input when DSG gives us focus - required for keyboard input
  useLayoutEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);

  // Format for display when not focused
  const displayValue = (() => {
    if (rowData === null || rowData === undefined) return '';
    const { decimals, prefix = '', suffix = '' } = columnData ?? {};
    const formatted = decimals !== undefined ? rowData.toFixed(decimals) : rowData.toString();
    return focus ? rowData.toString() : `${prefix}${formatted}${suffix}`;
  })();

  return (
    <input
      ref={ref}
      type={focus ? 'number' : 'text'}
      value={displayValue}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '') {
          setRowData(null);
        } else {
          const parsed = parseFloat(val);
          if (!isNaN(parsed)) setRowData(parsed);
        }
      }}
      placeholder={active ? columnData?.placeholder : undefined}
      className="w-full h-full bg-transparent outline-none border-none px-2 text-right"
      style={{ pointerEvents: focus ? 'auto' : 'none' }}
    />
  );
}

export default NumberCell;
