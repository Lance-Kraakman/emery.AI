'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import type { BooleanFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface BooleanFieldDisplayProps {
  value: BooleanFieldValue;
  fieldName: string;
}

export function BooleanFieldDisplay({ value, fieldName }: BooleanFieldDisplayProps) {
  if (value === null || value === undefined) {
    return (
      <div className="text-muted-foreground italic">
        No {fieldName.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge
        variant={value ? "default" : "secondary"}
        className="flex items-center gap-1"
      >
        {value ? (
          <>
            <Check className="h-3 w-3" />
            Yes
          </>
        ) : (
          <>
            <X className="h-3 w-3" />
            No
          </>
        )}
      </Badge>
    </div>
  );
}