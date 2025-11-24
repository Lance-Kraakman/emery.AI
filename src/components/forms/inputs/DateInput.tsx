'use client';

/**
 * DateInput Component
 *
 * Form input for date field types
 * Uses native HTML date input for now
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface DateInputProps {
  field: FieldDTO;
  value: Date | null;
  onChange: (value: Date | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DateInput({
  field,
  value,
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
      onChange(null);
    } else {
      onChange(new Date(val));
    }
  };

  // Format date to YYYY-MM-DD for input
  const formattedValue = value
    ? value.toISOString().split('T')[0]
    : '';

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.id}`}>
        {inputLabel}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={`field-${field.id}`}
        type="date"
        value={formattedValue}
        onChange={handleChange}
        required={isRequired}
        disabled={disabled}
      />
    </div>
  );
}
