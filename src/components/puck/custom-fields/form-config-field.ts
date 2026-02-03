/**
 * Form Configuration Field
 *
 * Custom field for Puck that allows configuring form fields, pages, and settings
 * directly in the editor sidebar.
 *
 * Usage:
 * ```ts
 * import { createFormConfigField } from './custom-fields';
 *
 * fields: {
 *   formConfig: createFormConfigField({ label: 'Form Fields' })
 * }
 * ```
 */

import { FormConfigFieldRenderer } from '../fields/FormConfigFieldRenderer';

export function createFormConfigField(params: {
  label?: string;
}) {
  const renderFn = (props: any) => {
    return FormConfigFieldRenderer({
      ...props,
      field: {
        label: params.label || 'Form Configuration',
      },
    });
  };

  return {
    type: 'custom' as const,
    label: params.label || 'Form Configuration',
    render: renderFn,
  };
}
