'use client';

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { BooleanFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface BooleanFieldInputProps {
  value: BooleanFieldValue;
  onChange: (value: BooleanFieldValue) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export function BooleanFieldInput({
  value,
  onChange,
  label,
  required,
  error
}: BooleanFieldInputProps) {
  const handleChange = (checked: boolean | 'indeterminate') => {
    onChange(checked === true);
  };

  const inputId = React.useId();

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id={inputId}
          checked={value === true}
          onCheckedChange={handleChange}
        />
        {label && (
          <Label
            htmlFor={inputId}
            className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
              required ? 'after:content-["*"] after:ml-0.5 after:text-destructive' : ''
            }`}
          >
            {label}
          </Label>
        )}
      </div>
      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
    </div>
  );
}