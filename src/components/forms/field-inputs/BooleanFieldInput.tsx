'use client';

/**
 * BooleanFieldInput - Form input component for boolean fields
 *
 * AIDEV-NOTE: Renders checkbox input for boolean fields with label and help text.
 * Uses shadcn checkbox component for consistent styling.
 */

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface BooleanFieldInputProps {
  fieldId: number;
  name: string;
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function BooleanFieldInput({
  fieldId,
  name,
  value,
  onChange,
  label,
  helpText,
  required = false,
  disabled = false,
  error,
  className,
}: BooleanFieldInputProps) {
  const displayLabel = label || name;
  const inputId = `field-${fieldId}`;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Checkbox with Label */}
      <div className="flex items-start space-x-3">
        <Checkbox
          id={inputId}
          name={name}
          checked={value}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
          }
          className={cn(
            "mt-1",
            error && "border-destructive"
          )}
        />
        <div className="space-y-1 leading-none">
          <Label
            htmlFor={inputId}
            className="text-sm font-medium cursor-pointer"
          >
            {displayLabel}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {/* Help Text */}
          {helpText && !error && (
            <p id={`${inputId}-help`} className="text-sm text-muted-foreground">
              {helpText}
            </p>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-destructive pl-7">
          {error}
        </p>
      )}
    </div>
  );
}
