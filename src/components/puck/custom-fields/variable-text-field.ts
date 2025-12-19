/**
 * VariableTextField - Custom Puck field for text with variable support
 *
 * Allows using {fieldName}, {params.name}, and {state.container.key} template syntax
 * with autocomplete. Supports both single-line and multi-line text inputs.
 *
 * Usage:
 * ```typescript
 * import { createVariableTextField } from './custom-fields';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     title: createVariableTextField({ label: 'Title' }),
 *     description: createVariableTextField({
 *       label: 'Description',
 *       multiline: true,
 *       rows: 4
 *     })
 *   }
 * }
 * ```
 */

import { VariableTextFieldRenderer } from '../fields/VariableTextFieldRenderer';

export interface VariableTextFieldOptions {
  /** Label shown above the field */
  label?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether to use a textarea (multiline) instead of input */
  multiline?: boolean;
  /** Number of rows for textarea (default: 3) */
  rows?: number;
}

/**
 * Create a text field with variable autocomplete support
 *
 * @param options - Configuration options
 * @returns Puck custom field configuration
 */
export function createVariableTextField(options: VariableTextFieldOptions = {}) {
  return {
    type: 'custom' as const,
    label: options.label || 'Text',
    render: (props: {
      value?: string;
      onChange: (value: string) => void;
      field: { label?: string };
      name: string;
      readOnly?: boolean;
    }) =>
      VariableTextFieldRenderer({
        ...props,
        placeholder: options.placeholder,
        multiline: options.multiline,
        rows: options.rows,
      }),
  };
}
