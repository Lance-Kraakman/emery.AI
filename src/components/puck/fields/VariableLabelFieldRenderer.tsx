'use client';

/**
 * VariableLabelFieldRenderer - Puck field renderer for labels with variable support
 *
 * Renders a VariableAutocompleteInput for the Puck sidebar, allowing
 * users to create dynamic labels like "View {product_name}".
 */

import React from 'react';
import { FieldLabel } from '@measured/puck';
import { VariableAutocompleteInput } from './VariableAutocompleteInput';

interface VariableLabelFieldRendererProps {
  value?: string;
  onChange: (value: string) => void;
  field: { label?: string };
  name: string;
  readOnly?: boolean;
  placeholder?: string;
}

export function VariableLabelFieldRenderer({
  value,
  onChange,
  field,
  readOnly = false,
  placeholder = 'Type { for variables...',
}: VariableLabelFieldRendererProps) {
  return (
    <FieldLabel label={field.label || 'Label'}>
      <VariableAutocompleteInput
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        disabled={readOnly}
      />
    </FieldLabel>
  );
}

export default VariableLabelFieldRenderer;
