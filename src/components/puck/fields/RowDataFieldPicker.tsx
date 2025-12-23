'use client';

/**
 * RowDataFieldPicker - Dropdown for selecting fields from parent DataBlock row
 *
 * Works in two modes:
 * 1. Editor mode: Receives `parentFields` prop from resolveFields (since context isn't available)
 * 2. Runtime mode: Falls back to `useRowData()` context
 *
 * Used by:
 * - MultiFilterField for "Parent Row" value type
 * - ConditionalBlock for "rowData" source type
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useParentRowData } from '../contexts/RowDataContext';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface RowDataFieldPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Parent fields passed from resolveFields in editor (context not available there) */
  parentFields?: FieldDTO[];
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS class */
  className?: string;
  /** Disable the picker */
  disabled?: boolean;
}

export function RowDataFieldPicker({
  value,
  onChange,
  parentFields: parentFieldsProp,
  placeholder = 'Select parent field...',
  className,
  disabled = false,
}: RowDataFieldPickerProps) {
  // Try to get fields from context (works at runtime)
  const parentContext = useParentRowData();
  const contextFields = parentContext?.getParentRowData()?.fields;

  // Use prop fields first (editor mode), fall back to context (runtime mode)
  const fields = parentFieldsProp || contextFields || [];

  if (fields.length === 0) {
    return (
      <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/20">
        Place inside a DataBlock to select parent row fields
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {fields.map(field => (
          <SelectItem key={field.id} value={field.name} className="text-xs">
            <span>{field.name}</span>
            <span className="ml-2 text-muted-foreground">({field.type})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default RowDataFieldPicker;
