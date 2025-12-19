/**
 * State Container Field
 *
 * Custom field for Puck that allows selecting a StateBlock container
 * from the available containers on the current page.
 *
 * Usage:
 * ```ts
 * import { createStateContainerField } from './custom-fields';
 *
 * fields: {
 *   container: createStateContainerField({
 *     label: 'State Container',
 *   })
 * }
 * ```
 */

import { StateContainerSelectorFieldRenderer } from '../fields/StateContainerSelectorField';

export interface StateContainerFieldConfig {
  /** Label shown above the selector */
  label?: string;
}

export function createStateContainerField(
  params: StateContainerFieldConfig = {}
) {
  // Create a closure to pass params to the renderer
  const renderFn = (props: {
    value: string | undefined;
    onChange: (value: string) => void;
    readOnly?: boolean;
  }) => {
    return StateContainerSelectorFieldRenderer({
      ...props,
      field: {
        label: params.label || 'State Container',
      },
    });
  };

  return {
    type: 'custom' as const,
    label: params.label || 'State Container',
    render: renderFn,
  };
}
