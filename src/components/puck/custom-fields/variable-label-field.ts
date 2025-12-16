/**
 * VariableLabelField - Custom Puck field for labels with variable support
 *
 * Allows using {fieldName} template syntax in labels with autocomplete.
 * Used by Button and LinkBlock for dynamic labels like "View {product_name}".
 *
 * Usage:
 * ```typescript
 * import { createVariableLabelField } from './custom-fields/variable-label-field';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     label: createVariableLabelField({ placeholder: "Button text" })
 *   }
 * }
 * ```
 */

import { VariableLabelFieldRenderer } from '../fields/VariableLabelFieldRenderer';

interface VariableLabelFieldOptions {
  label?: string;
  placeholder?: string;
}

/**
 * Create a label field with variable autocomplete support
 *
 * @param options - Configuration options
 * @returns Puck custom field configuration
 */
export function createVariableLabelField(options: VariableLabelFieldOptions = {}) {
  return {
    type: "custom" as const,
    label: options.label || "Label",
    render: (props: any) => VariableLabelFieldRenderer({ ...props, placeholder: options.placeholder }),
  };
}
