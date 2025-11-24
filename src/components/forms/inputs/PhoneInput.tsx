'use client';

/**
 * PhoneInput Component
 *
 * Form input for phone field types
 * Includes country code selector from metadata
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface PhoneInputProps {
  field: FieldDTO;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function PhoneInput({
  field,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
}: PhoneInputProps) {
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  // Extract default country code from metadata
  const defaultCountryCode =
    (field.metadata as any)?.defaultCountryCode || '+1';

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.id}`}>
        {inputLabel}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <div className="w-20 shrink-0">
          <Input
            type="text"
            value={defaultCountryCode}
            disabled
            className="text-center"
          />
        </div>
        <Input
          id={`field-${field.id}`}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '(555) 123-4567'}
          required={isRequired}
          disabled={disabled}
          className="flex-1"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Format: {defaultCountryCode} {placeholder || '(555) 123-4567'}
      </p>
    </div>
  );
}
