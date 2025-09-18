'use client';

import React from 'react';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import type { TextFieldValue } from '@/src/ddd/domain/tables/value-objects/field-values';

interface TextFieldInputProps {
  value: TextFieldValue;
  onChange: (value: TextFieldValue) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  error?: string;
}

export function TextFieldInput({
  value,
  onChange,
  placeholder,
  required,
  multiline = false,
  error
}: TextFieldInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const commonProps = {
    value: value || '',
    onChange: handleChange,
    placeholder,
    required,
    className: error ? 'border-destructive' : ''
  };

  if (multiline) {
    return (
      <div className="space-y-1">
        <Textarea
          {...commonProps}
          rows={4}
          className={`resize-none ${error ? 'border-destructive' : ''}`}
        />
        {error && (
          <div className="text-sm text-destructive">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input {...commonProps} />
      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
    </div>
  );
}