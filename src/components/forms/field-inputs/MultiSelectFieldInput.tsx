'use client';

/**
 * MultiSelectFieldInput - Form input component for multi-select fields
 *
 * AIDEV-NOTE: Wraps MultiSelectField component for form usage.
 * Options are managed by admins through field configuration (no inline creation).
 * Displays in non-compact mode showing all selected badges for better form UX.
 */

import { MultiSelectField } from '@/components/tables/fields/MultiSelectField';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SelectOption } from '@/ddd/domain/tables/value-objects/table-field';

export interface MultiSelectFieldInputProps {
  fieldId: number;
  name: string;
  value: number[] | null | undefined;
  onChange: (value: number[]) => void;
  label?: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  options: SelectOption[];
  maxSelections?: number;
}

export function MultiSelectFieldInput({
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
  maxSelections,
}: MultiSelectFieldInputProps) {
  const displayLabel = label || name;
  const inputId = `field-${fieldId}`;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <Label htmlFor={inputId} className="text-sm font-medium">
        {displayLabel}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Multi Select Field */}
      <MultiSelectField
        value={value}
        onChange={onChange}
        options={options}
        isEditMode={true}
        compact={false}
        disabled={disabled}
        placeholder={placeholder || 'Select options...'}
        maxSelections={maxSelections}
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
