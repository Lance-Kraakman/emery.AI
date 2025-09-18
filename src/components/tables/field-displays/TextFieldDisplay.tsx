'use client';

import React from 'react';
import type { TextFieldValue } from '@/src/ddd/domain/tables/value-objects/field-values';

interface TextFieldDisplayProps {
  value: TextFieldValue;
  fieldName: string;
}

export function TextFieldDisplay({ value, fieldName }: TextFieldDisplayProps) {
  if (!value || value === '') {
    return (
      <div className="text-muted-foreground italic">
        No {fieldName.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="text-foreground whitespace-pre-wrap break-words">
      {value}
    </div>
  );
}