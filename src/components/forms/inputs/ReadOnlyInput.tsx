'use client';

/**
 * ReadOnlyInput Component
 *
 * Form display for read-only field types (autonumber, timestamps, etc.)
 * These fields are managed by the system and cannot be edited
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { InputThemeClasses } from '../input-mapper';

interface ReadOnlyInputProps {
  field: FieldDTO;
  value: string | number | Date | null;
  label?: string;
  themeClasses?: InputThemeClasses;
}

export function ReadOnlyInput({ field, value, label, themeClasses }: ReadOnlyInputProps) {
  const inputLabel = label || field.name;

  // Format value based on field type
  const formatValue = () => {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toLocaleString();
    }

    if (field.type === 'autonumber') {
      // Format autonumber with prefix/suffix if configured
      const config = field.metadata as any;
      const prefix = config?.prefix || '';
      const suffix = config?.suffix || '';
      const digits = config?.digits || 0;
      const numValue = typeof value === 'number' ? value : parseInt(value.toString());

      const paddedNumber = digits > 0
        ? numValue.toString().padStart(digits, '0')
        : numValue.toString();

      return `${prefix}${paddedNumber}${suffix}`;
    }

    return value.toString();
  };

  const getFieldTypeLabel = () => {
    switch (field.type) {
      case 'autonumber':
        return 'Auto Number';
      case 'created-at':
        return 'Created';
      case 'last-updated':
        return 'Last Updated';
      default:
        return '';
    }
  };

  return (
    <div className={themeClasses?.fieldGroup || "space-y-2"}>
      <Label htmlFor={`field-${field.id}`} className={themeClasses?.label || undefined}>
        {inputLabel}
        <span className="ml-2 text-xs text-muted-foreground">
          ({getFieldTypeLabel()})
        </span>
      </Label>
      <Input
        id={`field-${field.id}`}
        value={formatValue()}
        disabled
        className={themeClasses?.input || "bg-muted cursor-not-allowed"}
      />
      <p className="text-xs text-muted-foreground">
        This field is automatically managed by the system
      </p>
    </div>
  );
}
