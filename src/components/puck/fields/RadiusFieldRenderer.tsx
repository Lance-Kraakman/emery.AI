/**
 * RadiusFieldRenderer - Figma-style Border Radius Field for Puck Blocks
 *
 * Provides per-corner radius control with link/unlink functionality.
 */

"use client";

import * as React from "react";
import { FieldLabel } from "@measured/puck";
import { SpacingRadiusControl } from "../controls/SpacingRadiusControl";
import {
  type FourCornerRadius,
  DEFAULT_FOUR_CORNER_RADIUS,
} from "../types/spacing-types";

export interface RadiusFieldProps {
  value?: FourCornerRadius;
  onChange: (value: FourCornerRadius | undefined) => void;
  name: string;
  field: {
    label?: string;
  };
  readOnly?: boolean;
}

/**
 * Border radius field renderer for Puck custom fields
 *
 * Usage in block fields:
 * ```typescript
 * fields: {
 *   radius: {
 *     type: "custom",
 *     label: "Border Radius",
 *     render: RadiusFieldRenderer,
 *   }
 * }
 * ```
 */
export function RadiusFieldRenderer({
  value,
  onChange,
  field,
  readOnly,
}: RadiusFieldProps) {
  const handleChange = (newValue: FourCornerRadius) => {
    onChange(newValue);
  };

  const handleClear = () => {
    onChange(undefined);
  };

  return (
    <FieldLabel label={field.label || "Border Radius"}>
      <div className="space-y-2">
        <SpacingRadiusControl
          mode="radius"
          value={value || DEFAULT_FOUR_CORNER_RADIUS}
          onChange={handleChange}
          disabled={readOnly}
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
