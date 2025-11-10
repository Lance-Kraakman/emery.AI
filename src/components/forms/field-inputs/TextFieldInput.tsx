'use client';

/**
 * TextFieldInput - Form input component for text fields
 *
 * AIDEV-NOTE: Renders text input fields with label, help text, placeholder, and validation.
 * Integrates with form view configuration for field-specific settings.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface TextFieldInputProps {
  fieldId: number;
  name: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function TextFieldInput({
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
}: TextFieldInputProps) {
  const displayLabel = label || name;
  const inputId = `field-${fieldId}`;

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
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
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
