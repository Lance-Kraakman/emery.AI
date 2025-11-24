'use client';

/**
 * SingleSelectInput Component
 *
 * Form input for single-select field types
 * Uses SelectOption[] from field metadata
 */

import React from 'react';
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

interface SingleSelectInputProps {
  field: FieldDTO;
  value: number | null; // SelectOption ID
  onChange: (value: number | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SingleSelectInput({
  field,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
}: SingleSelectInputProps) {
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  // Extract options from field metadata
  const options = (field.metadata as any)?.options as SelectOption[] | undefined;

  if (!options || options.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{inputLabel}</Label>
        <p className="text-sm text-muted-foreground">No options configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.id}`}>
        {inputLabel}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select
        value={value?.toString() || ''}
        onValueChange={(val) => onChange(val ? parseInt(val) : null)}
        disabled={disabled}
      >
        <SelectTrigger id={`field-${field.id}`}>
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
