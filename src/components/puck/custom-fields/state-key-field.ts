/**
 * State Key Field
 *
 * Custom field for Puck that allows selecting a variable or UI state flag
 * from a selected StateBlock container.
 *
 * Usage:
 * ```ts
 * import { createStateKeyField } from './custom-fields';
 *
 * fields: {
 *   key: createStateKeyField({
 *     label: 'Variable Key',
 *     containerProp: 'container', // Name of the prop holding container name
 *     filterType: 'all', // 'variables', 'uiState', or 'all'
 *   })
 * }
 * ```
 */

import {
  StateKeySelectorFieldRenderer,
  type StateKeyFilterType,
} from '../fields/StateKeySelectorField';

export interface StateKeyFieldConfig {
  /** Label shown above the selector */
  label?: string;
  /** Name of the prop that holds the container name (required) */
  containerProp: string;
  /** Filter to show only variables, only uiState, or all */
  filterType?: StateKeyFilterType;
}

export function createStateKeyField(params: StateKeyFieldConfig) {
  // Create a closure to pass params to the renderer
  const renderFn = (props: {
    value: string | undefined;
    onChange: (value: string) => void;
    readOnly?: boolean;
  }) => {
    return StateKeySelectorFieldRenderer({
      ...props,
      field: {
        label: params.label || 'State Key',
        containerProp: params.containerProp,
        filterType: params.filterType || 'all',
      },
    });
  };

  return {
    type: 'custom' as const,
    label: params.label || 'State Key',
    render: renderFn,
  };
}
