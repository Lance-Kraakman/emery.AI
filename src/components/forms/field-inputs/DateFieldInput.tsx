'use client';

/**
 * DateFieldInput - Form input component for date fields
 *
 * AIDEV-NOTE: Renders date input using HTML5 date input (native date picker).
 * Can be enhanced with a custom date picker library later (e.g., react-day-picker).
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface DateFieldInputProps {
  fieldId: number;
  name: string;
  value: string | null; // ISO date string (YYYY-MM-DD)
  onChange: (value: string | null) => void;
  label?: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  min?: string; // ISO date string
  max?: string; // ISO date string
  className?: string;
}

export function DateFieldInput({
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
  className,
}: DateFieldInputProps) {
  const displayLabel = label || name;
  const inputId = `field-${fieldId}`;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val || null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      <Label htmlFor={inputId} className="text-sm font-medium">
        {displayLabel}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Date Input */}
      <Input
        id={inputId}
        name={name}
        type="date"
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
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
