'use client';

/**
 * VariableTextFieldRenderer - Puck field renderer for text with variable support
 *
 * Renders a VariableAutocompleteInput for the Puck sidebar, allowing
 * users to create dynamic text like "Hello {user_name}".
 *
 * Supports both single-line (input) and multi-line (textarea) modes.
 */

import React from 'react';
import { FieldLabel } from '@measured/puck';
import { VariableAutocompleteInput } from './VariableAutocompleteInput';

interface VariableTextFieldRendererProps {
  value?: string;
  onChange: (value: string) => void;
  field: { label?: string };
  name: string;
  readOnly?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

export function VariableTextFieldRenderer({
  value,
  onChange,
  field,
  readOnly = false,
  placeholder = 'Type { for variables...',
  multiline = false,
  rows = 3,
}: VariableTextFieldRendererProps) {
  return (
    <FieldLabel label={field.label || 'Text'}>
      <VariableAutocompleteInput
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        disabled={readOnly}
        multiline={multiline}
        rows={rows}
      />
    </FieldLabel>
  );
}

export default VariableTextFieldRenderer;
