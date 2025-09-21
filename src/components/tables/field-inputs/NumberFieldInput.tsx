'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import type { NumberFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface NumberFieldInputProps {
  value: NumberFieldValue;
  onChange: (value: NumberFieldValue) => void;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
}

export function NumberFieldInput({
  value,
  onChange,
  placeholder,
  required,
  min,
  max,
  step,
  error
}: NumberFieldInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === '') {
      onChange(null as unknown as NumberFieldValue);
      return;
    }

    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  return (
    <div className="space-y-1">
      <Input
        type="number"
        value={value !== null && value !== undefined ? value.toString() : ''}
        onChange={handleChange}
        placeholder={placeholder || 'Enter a number'}
        required={required}
        min={min}
        max={max}
        step={step || 'any'}
        className={error ? 'border-destructive' : ''}
      />
      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
    </div>
  );
}