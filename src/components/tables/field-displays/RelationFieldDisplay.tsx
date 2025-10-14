'use client';

import React from 'react';
import { FieldInput } from '@/components/tables/FieldInput';
import { relationsToLabelItems } from '@/components/tables/LabelDisplay';
import type { LabelDisplayItem } from '@/components/tables/LabelDisplay';
import type { RelationArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface RelationFieldDisplayProps {
  value: RelationArrayFieldValue;
  fieldName: string;
  onRelationClick?: (relation: any) => void; // Add relation click handler
}

export function RelationFieldDisplay({ value, fieldName, onRelationClick }: RelationFieldDisplayProps) {
  // Convert relation data to LabelDisplayItem format
  const items = relationsToLabelItems(value);
  
  // Create field-specific messages
  const emptyMessage = `No ${fieldName.toLowerCase()} linked`;
  const count = value?.length || 0;
  const countMessage = `${count} ${count === 1 ? 'relation' : 'relations'} linked`;

  const handleRelationClick = (item: LabelDisplayItem) => {
    if (onRelationClick && item.metadata) {
      onRelationClick(item.metadata);
    }
  };

  return (
    <FieldInput
      items={items}
      isEditMode={false}
      showPlusButton={true} // Always show (+) button
      onItemClick={handleRelationClick}
      onAdd={() => {}} // Required but not used in read-only mode
      onRemove={() => {}} // Required but not used in read-only mode
    />
  );
}
