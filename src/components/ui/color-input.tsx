/**
 * ColorInput - Hybrid Color Picker Component
 *
 * Combines HTML5 color input (visual picker) with text input (hex code)
 * for flexible color selection.
 */

"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ColorInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ColorInput({
  label,
  value,
  onChange,
  disabled = false,
  className,
}: ColorInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const [error, setError] = React.useState<string | null>(null);

  // Sync local value when prop changes
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Validate hex color format
  const validateHexColor = (color: string): boolean => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
  };

  // Handle text input change with validation
  const handleTextChange = (newValue: string) => {
    setLocalValue(newValue);

    if (!newValue) {
      setError("Color is required");
      return;
    }

    if (validateHexColor(newValue)) {
      setError(null);
      onChange(newValue);
    } else {
      setError("Invalid hex color (e.g., #2563eb)");
    }
  };

  // Handle color picker change (always valid)
  const handleColorChange = (newValue: string) => {
    setLocalValue(newValue);
    setError(null);
    onChange(newValue);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}

      <div className="flex gap-2">
        {/* Visual Color Picker */}
        <div className="relative">
          <input
            type="color"
            value={localValue}
            onChange={(e) => handleColorChange(e.target.value)}
            disabled={disabled}
            className="w-14 h-10 rounded-md border border-input cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              // Remove default browser styling
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
            }}
          />
        </div>

        {/* Text Input for Hex Code */}
        <Input
          type="text"
          value={localValue}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={disabled}
          placeholder="#2563eb"
          className="flex-1 font-mono"
          maxLength={7}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
