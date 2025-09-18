'use client';

import React from 'react';
import type { NumberFieldValue } from '@/src/ddd/domain/tables/value-objects/field-values';

interface NumberFieldDisplayProps {
  value: NumberFieldValue;
  fieldName: string;
}

export function NumberFieldDisplay({ value, fieldName }: NumberFieldDisplayProps) {
  if (value === null || value === undefined) {
    return (
      <div className="text-muted-foreground italic">
        No {fieldName.toLowerCase()}
      </div>
    );
  }

  // Format number with appropriate decimals
  const formatted = typeof value === 'number'
    ? value % 1 === 0
      ? value.toString()
      : value.toFixed(2).replace(/\.?0+$/, '')
    : String(value);

  return (
    <div className="text-foreground font-mono">
      {formatted}
    </div>
  );
}