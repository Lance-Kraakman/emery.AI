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
  name?: string;                    // For form collection
  value?: string;                   // Controlled mode
  defaultValue?: string;            // Uncontrolled mode
  onChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export function TextInput({
  field,
  name,
  value,
  defaultValue,
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
        name={name}
        type={inputType}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder || `Enter ${inputLabel.toLowerCase()}`}
        required={isRequired}
        disabled={disabled}
      />
    </div>
  );
}
