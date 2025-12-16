'use client';

/**
 * DateInput Component
 *
 * Form input for date field types
 * Uses native HTML date input. Supports controlled and uncontrolled modes.
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface DateInputProps {
  field: FieldDTO;
  name?: string;                    // For form collection
  value?: Date | null;              // Controlled mode
  defaultValue?: Date | null;       // Uncontrolled mode
  onChange?: (value: Date | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DateInput({
  field,
  name,
  value,
  defaultValue,
  onChange,
  label,
  required,
  disabled,
}: DateInputProps) {
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange?.(null);
    } else {
      onChange?.(new Date(val));
    }
  };

  // Format date to YYYY-MM-DD for input
  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Determine if controlled or uncontrolled
  const isControlled = value !== undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.id}`}>
        {inputLabel}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={`field-${field.id}`}
        name={name}
        type="date"
        value={isControlled ? formatDate(value) : undefined}
        defaultValue={!isControlled ? formatDate(defaultValue) : undefined}
        onChange={onChange ? handleChange : undefined}
        required={isRequired}
        disabled={disabled}
      />
    </div>
  );
}
