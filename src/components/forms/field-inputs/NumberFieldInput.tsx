'use client';

/**
 * NumberFieldInput - Form input component for number fields
 *
 * AIDEV-NOTE: Renders number input fields with label, help text, placeholder, and validation.
 * Supports min/max validation rules from form configuration.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface NumberFieldInputProps {
  fieldId: number;
  name: string;
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function NumberFieldInput({
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
  min,
  max,
  step = 1,
  className,
}: NumberFieldInputProps) {
  const displayLabel = label || name;
  const inputId = `field-${fieldId}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || val === null) {
      onChange(null);
    } else {
      const numValue = parseFloat(val);
      onChange(isNaN(numValue) ? null : numValue);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <Label htmlFor={inputId} className="text-sm font-medium">
        {displayLabel}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Input */}
      <Input
        id={inputId}
        name={name}
        type="number"
        value={value ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive"
        )}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
        }
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
