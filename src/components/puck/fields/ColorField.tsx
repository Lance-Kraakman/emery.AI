/**
 * ColorField - Reusable Color Picker Field for Puck Blocks
 *
 * AIDEV-NOTE: Standardized color field that integrates Puck's field system
 * with our ColorInput component. Use this for all per-block color customization.
 */

"use client";

import * as React from "react";
import { FieldLabel } from "@measured/puck";
import { ColorInput } from "@/components/ui/color-input";

export interface ColorFieldProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  name: string;
  field: {
    label?: string;
  };
  readOnly?: boolean;
}

/**
 * Color field renderer for Puck custom fields
 *
 * Usage in block fields:
 * ```typescript
 * fields: {
 *   backgroundColor: {
 *     type: "custom",
 *     label: "Background Color (Optional)",
 *     render: ColorFieldRenderer,
 *   }
 * }
 * ```
 */
export function ColorFieldRenderer({
  value,
  onChange,
  name,
  field,
  readOnly,
}: ColorFieldProps) {
  const handleChange = (newValue: string) => {
    // Allow clearing the color by setting to empty string
    onChange(newValue || undefined);
  };

  const handleClear = () => {
    onChange(undefined);
  };

  return (
    <FieldLabel label={field.label || "Color"}>
      <div className="space-y-2">
        <ColorInput
          value={value || "#000000"}
          onChange={handleChange}
          disabled={readOnly}
          className="w-full"
        />
        {value && !readOnly && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear (use theme default)
          </button>
        )}
      </div>
    </FieldLabel>
  );
}
