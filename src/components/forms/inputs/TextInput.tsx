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
import type { InputThemeClasses } from '../input-mapper';

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
  themeClasses?: InputThemeClasses;
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
  themeClasses,
}: TextInputProps) {
  const inputType = field.type === 'email' ? 'email' : 'text';
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;

  return (
    <div className={themeClasses?.fieldGroup || "space-y-2"}>
      <Label htmlFor={`field-${field.id}`} className={themeClasses?.label || undefined}>
        {inputLabel}
        {isRequired && <span className={themeClasses?.error || "text-destructive ml-1"}>*</span>}
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
        className={themeClasses?.input || undefined}
      />
    </div>
  );
}
