'use client';

/**
 * NumberInput Component
 *
 * Form input for number field types
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface NumberInputProps {
  field: FieldDTO;
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function NumberInput({
  field,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
}: NumberInputProps) {
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange(null);
    } else {
      const num = parseFloat(val);
      onChange(isNaN(num) ? null : num);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.id}`}>
        {inputLabel}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={`field-${field.id}`}
        type="number"
        value={value ?? ''}
        onChange={handleChange}
        placeholder={placeholder || `Enter ${inputLabel.toLowerCase()}`}
        required={isRequired}
        disabled={disabled}
        step="any"
      />
    </div>
  );
}
