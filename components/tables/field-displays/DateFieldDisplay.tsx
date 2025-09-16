'use client';

import React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar } from 'lucide-react';
import type { DateFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface DateFieldDisplayProps {
  value: DateFieldValue;
  fieldName: string;
}

export function DateFieldDisplay({ value, fieldName }: DateFieldDisplayProps) {
  if (!value) {
    return (
      <div className="text-muted-foreground italic">
        No {fieldName.toLowerCase()}
      </div>
    );
  }

  let date: Date;
  try {
    // Handle various date formats
    if (typeof value === 'string') {
      date = parseISO(value);
    } else if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }

    if (!isValid(date)) {
      throw new Error('Invalid date');
    }
  } catch {
    return (
      <div className="text-destructive text-sm">
        Invalid date format
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-foreground">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <div className="space-y-1">
        <div className="font-medium">
          {format(date, 'PPP')} {/* e.g., "April 29, 2023" */}
        </div>
        <div className="text-sm text-muted-foreground">
          {format(date, 'p')} {/* e.g., "3:30 PM" */}
        </div>
      </div>
    </div>
  );
}