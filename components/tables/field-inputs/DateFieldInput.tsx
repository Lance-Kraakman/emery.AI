'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface DateFieldInputProps {
  value: DateFieldValue;
  onChange: (value: DateFieldValue) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export function DateFieldInput({
  value,
  onChange,
  placeholder,
  required,
  error
}: DateFieldInputProps) {
  // Parse the current date value
  const currentDate = React.useMemo(() => {
    if (!value) return undefined;

    try {
      if (typeof value === 'string') {
        const parsed = parseISO(value);
        return isValid(parsed) ? parsed : undefined;
      }
      if (value instanceof Date) {
        return isValid(value) ? value : undefined;
      }
      const parsed = new Date(value);
      return isValid(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === '') {
      onChange(null as unknown as DateFieldValue);
      return;
    }

    try {
      // Convert datetime-local format to ISO string
      const date = new Date(inputValue);
      if (isValid(date)) {
        onChange(date.toISOString());
      }
    } catch {
      // Invalid date input, ignore
    }
  };

  return (
    <div className="space-y-1">
      <Input
        type="datetime-local"
        value={currentDate ? format(currentDate, "yyyy-MM-dd'T'HH:mm") : ''}
        onChange={handleInputChange}
        placeholder={placeholder || 'Select date and time'}
        required={required}
        className={cn(error && 'border-destructive')}
      />

      {currentDate && (
        <div className="text-xs text-muted-foreground">
          {format(currentDate, 'PPPp')}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
    </div>
  );
}