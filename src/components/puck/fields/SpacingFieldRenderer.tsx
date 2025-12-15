/**
 * SpacingFieldRenderer - Figma-style Padding/Margin Field for Puck Blocks
 *
 * Provides per-side spacing control with link/unlink functionality.
 */

"use client";

import * as React from "react";
import { FieldLabel } from "@measured/puck";
import { SpacingRadiusControl } from "../controls/SpacingRadiusControl";
import {
  type FourSidedSpacing,
  DEFAULT_FOUR_SIDED_SPACING,
} from "../types/spacing-types";

export interface SpacingFieldProps {
  value?: FourSidedSpacing;
  onChange: (value: FourSidedSpacing | undefined) => void;
  name: string;
  field: {
    label?: string;
    /** 'padding' or 'margin' - defaults to 'padding' */
    mode?: "padding" | "margin";
  };
  readOnly?: boolean;
}

/**
 * Spacing field renderer for Puck custom fields
 *
 * Usage in block fields:
 * ```typescript
 * fields: {
 *   padding: {
 *     type: "custom",
 *     label: "Padding",
 *     render: SpacingFieldRenderer,
 *   },
 *   margin: {
 *     type: "custom",
 *     label: "Margin",
 *     render: (props) => <SpacingFieldRenderer {...props} field={{ ...props.field, mode: 'margin' }} />,
 *   }
 * }
 * ```
 */
export function SpacingFieldRenderer({
  value,
  onChange,
  field,
  readOnly,
}: SpacingFieldProps) {
  const mode = field.mode || "padding";
  const label = field.label || (mode === "padding" ? "Padding" : "Margin");

  const handleChange = (newValue: FourSidedSpacing) => {
    onChange(newValue);
  };

  const handleClear = () => {
    onChange(undefined);
  };

  return (
    <FieldLabel label={label}>
      <div className="space-y-2">
        <SpacingRadiusControl
          mode={mode}
          value={value || DEFAULT_FOUR_SIDED_SPACING}
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

/**
 * Margin field renderer - convenience wrapper with mode='margin'
 */
export function MarginFieldRenderer(props: SpacingFieldProps) {
  return (
    <SpacingFieldRenderer
      {...props}
      field={{ ...props.field, mode: "margin" }}
    />
  );
}
