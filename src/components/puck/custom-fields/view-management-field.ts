/**
 * View Management Field
 *
 * Custom field for Puck that allows inline view creation and editing.
 * Replaces the simple external field for view selection with a richer UI
 * that includes create and edit capabilities.
 *
 * Usage:
 * ```ts
 * import { createViewManagementField } from './custom-fields';
 *
 * fields: {
 *   viewId: createViewManagementField({
 *     supportedViewTypes: ['grid']
 *   })
 * }
 * ```
 */

import { ViewManagementFieldRenderer } from '../fields/ViewManagementField';

export function createViewManagementField(params: {
  supportedViewTypes: Array<'grid' | 'metric' | 'chart' | 'form'>;
  label?: string;
}) {
  // Create a closure to pass params to the renderer
  const renderFn = (props: any) => {
    return ViewManagementFieldRenderer({
      ...props,
      field: {
        supportedViewTypes: params.supportedViewTypes,
        label: params.label,
      },
    });
  };

  return {
    type: 'custom' as const,
    label: params.label || 'View',
    render: renderFn,
  };
}
