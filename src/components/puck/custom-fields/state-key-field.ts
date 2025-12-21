/**
 * StateKeyField - Custom Puck field for selecting state keys
 *
 * A dropdown field for selecting UI flags or state variables from PageStateConfig.
 * Used by ConditionalBlock and DialogBlock.
 *
 * Usage:
 * ```typescript
 * import { createStateKeyField } from './custom-fields';
 *
 * export const DialogBlock: ComponentConfig = {
 *   fields: {
 *     stateKey: createStateKeyField({
 *       label: 'UI Flag',
 *       keyType: 'uiFlag',
 *       placeholder: 'Select a UI flag...'
 *     })
 *   }
 * }
 * ```
 */

import { StateKeyPicker, type StateKeyType } from '../fields/StateKeyPicker';

export interface StateKeyFieldOptions {
  /** Label shown above the field */
  label?: string;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Filter: 'uiFlag' | 'variable' | 'all' */
  keyType?: StateKeyType;
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
        keyType: options.keyType,
        disabled: props.readOnly,
      }),
  };
}
