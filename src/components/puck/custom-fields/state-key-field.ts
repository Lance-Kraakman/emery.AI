/**
 * StateKeyField - Custom Puck field for selecting state keys
 *
 * A dropdown field for selecting state variables from PageStateConfig.
 * Used by ConditionalBlock and DialogBlock.
 *
 * Usage:
 * ```typescript
 * import { createStateKeyField } from './custom-fields';
 *
 * export const DialogBlock: ComponentConfig = {
 *   fields: {
 *     stateKey: createStateKeyField({
 *       label: 'State Variable',
 *       placeholder: 'Select a variable...'
 *     })
 *   }
 * }
 * ```
 */

import { StateKeyPicker } from '../fields/StateKeyPicker';

export interface StateKeyFieldOptions {
  /** Label shown above the field */
  label?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Optional filter for variable type (e.g., 'boolean' for dialogs) */
  filterType?: string;
}

/**
 * Create a dropdown field for selecting state keys
 *
 * @param options - Configuration options
 * @returns Puck custom field configuration
 */
export function createStateKeyField(options: StateKeyFieldOptions = {}) {
  return {
    type: 'custom' as const,
    label: options.label || 'State Key',
    render: (props: {
      value?: string;
      onChange: (value: string) => void;
      field: { label?: string };
      name: string;
      readOnly?: boolean;
    }) =>
      StateKeyPicker({
        value: props.value || '',
        onChange: props.onChange,
        placeholder: options.placeholder,
        filterType: options.filterType,
        disabled: props.readOnly,
      }),
  };
}
