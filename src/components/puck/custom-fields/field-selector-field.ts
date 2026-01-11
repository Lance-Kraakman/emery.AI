/**
 * Field Selector Field
 *
 * Custom field for Puck that allows selecting a field from the parent DataBlock.
 * Shows field names and types instead of raw IDs for better UX.
 *
 * Usage:
 * ```ts
 * import { createFieldSelectorField } from './custom-fields';
 *
 * fields: {
 *   fieldId: createFieldSelectorField({
 *     label: 'Field',
 *     filterTypes: ['text', 'email', 'url'], // Optional: limit to certain types
 *   })
 * }
 * ```
 */

import { FieldSelectorFieldRenderer } from '../fields/FieldSelectorField';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';

export interface FieldSelectorFieldConfig {
  /** Label shown above the selector */
  label?: string;
  /** Optional filter to limit which field types are shown */
  filterTypes?: FieldType[];
}

export function createFieldSelectorField(params: FieldSelectorFieldConfig = {}) {
  // Create a closure to pass params to the renderer
  const renderFn = (props: any) => {
    return FieldSelectorFieldRenderer({
      ...props,
      field: {
        label: params.label || 'Field',
        filterTypes: params.filterTypes,
      },
    });
  };

  return {
    type: 'custom' as const,
    label: params.label || 'Field',
    render: renderFn,
  };
}
