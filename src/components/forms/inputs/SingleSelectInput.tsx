'use client';

/**
 * SingleSelectInput Component
 *
 * Form input for single-select field types
 * Uses SelectOption[] from field metadata.
 * Supports controlled and uncontrolled modes.
 */

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { SelectOption } from '@/ddd/domain/tables/value-objects/table-field';
import type { InputThemeClasses } from '../input-mapper';

interface SingleSelectInputProps {
  field: FieldDTO;
  name?: string;                    // For form collection
  value?: number | null;            // Controlled mode - SelectOption ID
  defaultValue?: number | null;     // Uncontrolled mode
  onChange?: (value: number | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  themeClasses?: InputThemeClasses;
}

export function SingleSelectInput({
  field,
  name,
  value,
  defaultValue,
  onChange,
  label,
  placeholder,
  required,
  disabled,
  themeClasses,
}: SingleSelectInputProps) {
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  // For uncontrolled mode, use local state
  const [localValue, setLocalValue] = useState<number | null>(defaultValue ?? null);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : localValue;

  // Extract options from field metadata
  const options = (field.metadata as Record<string, unknown>)?.options as SelectOption[] | undefined;

  if (!options || options.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{inputLabel}</Label>
        <p className="text-sm text-muted-foreground">No options configured</p>
      </div>
    );
  }

  const handleChange = (val: string) => {
    const newValue = val ? parseInt(val) : null;
    if (!isControlled) {
      setLocalValue(newValue);
    }
    onChange?.(newValue);
  };

  return (
    <div className={themeClasses?.fieldGroup || "space-y-2"}>
      {/* Hidden input for form submission */}
      {name && (
        <input type="hidden" name={name} value={currentValue?.toString() ?? ''} />
      )}
      <Label htmlFor={`field-${field.id}`} className={themeClasses?.label || undefined}>
        {inputLabel}
        {isRequired && <span className={themeClasses?.error || "text-destructive ml-1"}>*</span>}
      </Label>
      <Select
        value={currentValue?.toString() || ''}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger id={`field-${field.id}`} className={themeClasses?.select || undefined}>
          <SelectValue placeholder={placeholder || `Select ${inputLabel.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id.toString()}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
                {option.value}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
