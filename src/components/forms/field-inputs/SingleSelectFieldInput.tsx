'use client';

/**
 * SingleSelectFieldInput - Form input component for single-select fields
 *
 * AIDEV-NOTE: Wraps SingleSelectField component for form usage.
 * Options are managed by admins through field configuration (no inline creation).
 * Displays in non-compact mode for better form UX.
 */

import { SingleSelectField } from '@/components/tables/fields/SingleSelectField';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SelectOption } from '@/ddd/domain/tables/value-objects/table-field';

export interface SingleSelectFieldInputProps {
  fieldId: number;
  name: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  label?: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  options: SelectOption[];
}

export function SingleSelectFieldInput({
  fieldId,
  name,
  value,
  onChange,
  label,
  helpText,
  placeholder,
  required = false,
  disabled = false,
  error,
  className,
  options,
}: SingleSelectFieldInputProps) {
  const displayLabel = label || name;
  const inputId = `field-${fieldId}`;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <Label htmlFor={inputId} className="text-sm font-medium">
        {displayLabel}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Single Select Field */}
      <SingleSelectField
        value={value}
        onChange={onChange}
        options={options}
        isEditMode={true}
        compact={false}
        disabled={disabled}
        placeholder={placeholder || 'Select an option...'}
      />

      {/* Help Text */}
      {helpText && !error && (
        <p id={`${inputId}-help`} className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}

      {/* Error Message */}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
