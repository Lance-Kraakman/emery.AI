'use client';

/**
 * TypeAwareValueInput - Value input that adapts to field type
 *
 * Shows appropriate input based on the selected field type:
 * - Boolean: True/False dropdown
 * - Number: Number input
 * - Date: Date input
 * - Single-select: Options dropdown (from field config)
 * - Text/others: Text input
 */

import React from 'react';
import { useDataLayoutContext } from '../contexts/DataLayoutContext';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface TypeAwareValueInputProps {
  value: string | undefined;
  onChange: (value: string) => void;
  /** Field name to determine type (for rowData source) */
  fieldName?: string;
  /** Source type to determine context */
  sourceType?: 'state' | 'params' | 'rowData';
  disabled?: boolean;
  placeholder?: string;
}

export function TypeAwareValueInput({
  value,
  onChange,
  fieldName,
  sourceType = 'rowData',
  disabled = false,
  placeholder = 'Enter value...',
}: TypeAwareValueInputProps) {
  const dataContext = useDataLayoutContext();

  // Determine field type and get field metadata
  const { fieldType, fieldMetadata } = React.useMemo(() => {
    // For state variables or params, we don't have type info - use text
    if (sourceType === 'state' || sourceType === 'params') {
      return { fieldType: 'text' as FieldType, fieldMetadata: null };
    }

    // For rowData source
    if (fieldName === 'id') {
      return { fieldType: 'number' as FieldType, fieldMetadata: null };
    }

    if (!fieldName || !dataContext?.fields) {
      return { fieldType: 'text' as FieldType, fieldMetadata: null };
    }

    const field = dataContext.fields.find(f => f.name === fieldName);
    return {
      fieldType: field?.type || 'text' as FieldType,
      fieldMetadata: (field?.metadata as Record<string, unknown>) || null,
    };
  }, [sourceType, fieldName, dataContext?.fields]);

  // Boolean field - True/False/null dropdown
  if (fieldType === 'boolean') {
    return (
      <Select
        value={value ?? ''}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select value...">
            {value === 'true' ? 'True' : value === 'false' ? 'False' : value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Number field - number input
  if (fieldType === 'number' || fieldType === 'autonumber') {
    return (
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 text-sm"
      />
    );
  }

  // Date field - date input
  if (fieldType === 'date' || fieldType === 'last-updated' || fieldType === 'created-at') {
    return (
      <Input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 text-sm"
      />
    );
  }

  // Single-select - options dropdown
  if (fieldType === 'single-select' && fieldMetadata?.options) {
    const options = fieldMetadata.options as Array<{ id: number; value: string; color?: string }>;
    return (
      <Select
        value={value ?? ''}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select option...">
            {options.find(o => o.value === value)?.value || value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.value}>
              <span className="flex items-center gap-2">
                {option.color && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                {option.value}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Default: text input
  return (
    <Input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-8 text-sm"
    />
  );
}

export default TypeAwareValueInput;
