'use client';

/**
 * BooleanInput Component
 *
 * Form input for boolean field types (checkbox/switch)
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface BooleanInputProps {
  field: FieldDTO;
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function BooleanInput({
  field,
  value,
  onChange,
  label,
  disabled,
}: BooleanInputProps) {
  const inputLabel = label || field.name;

  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`field-${field.id}`}
        checked={value}
        onCheckedChange={(checked) => onChange(checked === true)}
        disabled={disabled}
      />
      <Label
        htmlFor={`field-${field.id}`}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
      >
        {inputLabel}
      </Label>
    </div>
  );
}
