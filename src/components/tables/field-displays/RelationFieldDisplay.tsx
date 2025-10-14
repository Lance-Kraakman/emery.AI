'use client';

import React from 'react';
import { LabelDisplay, relationsToLabelItems } from '@/components/tables/LabelDisplay';
import type { RelationArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface RelationFieldDisplayProps {
  value: RelationArrayFieldValue;
  fieldName: string;
}

export function RelationFieldDisplay({ value, fieldName }: RelationFieldDisplayProps) {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return (
      <div className="text-muted-foreground italic">
        No {fieldName.toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Use LabelDisplay for consistent UI */}
      <LabelDisplay
        items={relationsToLabelItems(value)}
        isEditMode={false} // Read-only display
        compact={true}
        maxVisible={3} // Show more in display mode
      />
      
      {/* Additional details for display mode */}
      <div className="text-xs text-muted-foreground">
        {value.length} {value.length === 1 ? 'relation' : 'relations'} linked
      </div>
    </div>
  );
}
