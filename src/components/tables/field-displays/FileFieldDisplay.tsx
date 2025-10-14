'use client';

import React from 'react';
import { FieldInput } from '@/components/tables/FieldInput';
import type { LabelDisplayItem } from '@/components/tables/LabelDisplay';
import type { FileArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface FileFieldDisplayProps {
  value: FileArrayFieldValue;
  fieldName: string;
  onFileOpen?: (file: any) => void; // Add file open handler
}

// Helper function to convert file data to LabelDisplayItem format
const filesToLabelItems = (files: FileArrayFieldValue): LabelDisplayItem[] => {
  if (!Array.isArray(files)) return [];
  
  return files.map((file: any) => ({
    id: file.id || file.name,
    value: file.name || file.filename || 'Unknown File',
    type: 'file' as const,
    metadata: file
  }));
};

export function FileFieldDisplay({ value, fieldName, onFileOpen }: FileFieldDisplayProps) {
  // Convert file data to LabelDisplayItem format
  const items = filesToLabelItems(value);
  
  // Create field-specific messages
  const emptyMessage = `No ${fieldName.toLowerCase()} uploaded`;
  const count = value?.length || 0;
  const countMessage = `${count} ${count === 1 ? 'file' : 'files'} uploaded`;

  const handleFileClick = (item: LabelDisplayItem) => {
    if (onFileOpen && item.metadata) {
      onFileOpen(item.metadata);
    } else {
      // Fallback: try to open file in new window if it has a URL
      const fileUrl = item.metadata?.url || item.metadata?.downloadUrl;
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      }
    }
  };

  return (
    <FieldInput
      items={items}
      isEditMode={false}
      showPlusButton={true} // Always show (+) button
      onItemClick={handleFileClick}
      onAdd={() => {}} // Required but not used in read-only mode
      onRemove={() => {}} // Required but not used in read-only mode
    />
  );
}