'use client';

/**
 * TextInput Component
 *
 * Form input for text and email field types
 * Handles validation and appropriate input types
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface TextInputProps {
  field: FieldDTO;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function TextInput({
  field,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
}: TextInputProps) {
  const inputType = field.type === 'email' ? 'email' : 'text';
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.id}`}>
        {inputLabel}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={`field-${field.id}`}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || `Enter ${inputLabel.toLowerCase()}`}
        required={isRequired}
        disabled={disabled}
      />
    </div>
  );
}
