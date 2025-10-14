'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, File } from 'lucide-react';
import { FieldInput } from '@/components/tables/FieldInput';
import type { LabelDisplayItem } from '@/components/tables/LabelDisplay';
import type { FileArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface FileFieldInputProps {
  value: FileArrayFieldValue;
  onChange: (value: FileArrayFieldValue) => void;
  required?: boolean;
  allowedTypes?: string[];
  maxFiles?: number;
  error?: string;
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

export function FileFieldInput({
  value,
  onChange,
  required,
  allowedTypes,
  maxFiles = 10,
  error
}: FileFieldInputProps) {
  const files = Array.isArray(value) ? value : [];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    // TODO: Implement actual file upload logic
    // For now, create mock file objects
    const newFiles = selectedFiles.map((file, index) => ({
      id: `temp-${Date.now()}-${index}`,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      s3Key: `temp://upload/${file.name}`,
      uploadedAt: new Date().toISOString()
    }));

    const updatedFiles = [...files, ...newFiles].slice(0, maxFiles);
    onChange(updatedFiles);

    // Reset the input
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    onChange(updatedFiles);
  };

  const acceptedTypes = allowedTypes?.join(',') || '*/*';
  const items = filesToLabelItems(files);

  return (
    <FieldInput
      items={items}
      onAdd={() => {
        // Trigger file input click
        const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
        fileInput?.click();
      }}
      onRemove={handleRemoveFile}
      error={error}
      showPlusButton={files.length < maxFiles}
      requiredMessage={required ? 'At least one file is required' : undefined}
    >
      {/* Hidden file input */}
      <input
        id="file-upload-input"
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={handleFileSelect}
        className="hidden"
        disabled={files.length >= maxFiles}
      />

      {/* File upload button */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
            fileInput?.click();
          }}
          disabled={files.length >= maxFiles}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Files
        </Button>

        {maxFiles > 1 && (
          <Badge variant="secondary" className="text-xs">
            {files.length} / {maxFiles}
          </Badge>
        )}
      </div>

      {allowedTypes && allowedTypes.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Accepted types: {allowedTypes.join(', ')}
        </div>
      )}
    </FieldInput>
  );
}