'use client';

import React from 'react';
import { FieldInput } from '@/components/tables/FieldInput';
import type { LabelDisplayItem } from '@/components/tables/LabelDisplay';
import type { DocumentArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface DocumentFieldDisplayProps {
  value: DocumentArrayFieldValue;
  fieldName: string;
  onDocumentOpen?: (document: any) => void; // Add document open handler
}

// Helper function to convert document data to LabelDisplayItem format
const documentsToLabelItems = (documents: DocumentArrayFieldValue): LabelDisplayItem[] => {
  if (!Array.isArray(documents)) return [];
  
  return documents.map((document: any) => ({
    id: document.id || document.name,
    value: document.documentMetadata?.title || document.name || 'Untitled Document',
    type: 'document' as const,
    metadata: document
  }));
};

export function DocumentFieldDisplay({ value, fieldName, onDocumentOpen }: DocumentFieldDisplayProps) {
  // Convert document data to LabelDisplayItem format
  const items = documentsToLabelItems(value);
  
  // Create field-specific messages
  const emptyMessage = `No ${fieldName.toLowerCase()} created`;
  const count = value?.length || 0;
  const countMessage = `${count} ${count === 1 ? 'document' : 'documents'} created`;

  const handleDocumentClick = (item: LabelDisplayItem) => {
    if (onDocumentOpen && item.metadata) {
      onDocumentOpen(item.metadata);
    } else {
      // Fallback: try to open document in new window if it has a URL
      const documentUrl = item.metadata?.url || item.metadata?.downloadUrl;
      if (documentUrl) {
        window.open(documentUrl, '_blank');
      }
    }
  };

  return (
    <FieldInput
      items={items}
      isEditMode={false}
      showPlusButton={true} // Always show (+) button
      onItemClick={handleDocumentClick}
      onAdd={() => {}} // Required but not used in read-only mode
      onRemove={() => {}} // Required but not used in read-only mode
    />
  );
}