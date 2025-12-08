'use client';

/**
 * BooleanInput Component
 *
 * Form input for boolean field types (checkbox/switch)
 * Supports both controlled and uncontrolled modes.
 */

import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface BooleanInputProps {
  field: FieldDTO;
  name?: string;                    // For form collection
  value?: boolean;                  // Controlled mode
  defaultValue?: boolean;           // Uncontrolled mode
  onChange?: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function BooleanInput({
  field,
  name,
  value,
  defaultValue,
  onChange,
  label,
  disabled,
}: BooleanInputProps) {
  const inputLabel = label || field.name;

  // For uncontrolled mode, use local state
  const [localValue, setLocalValue] = useState(defaultValue ?? false);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : localValue;

  const handleChange = (checked: boolean) => {
    if (!isControlled) {
      setLocalValue(checked);
    }
    onChange?.(checked);
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Hidden input for form submission */}
      {name && (
        <input type="hidden" name={name} value={currentValue ? 'true' : 'false'} />
      )}
      <Checkbox
        id={`field-${field.id}`}
        checked={currentValue}
        onCheckedChange={(checked) => handleChange(checked === true)}
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
