'use client';

import React from 'react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Upload, Trash2, File } from 'lucide-react';
import type { FileArrayFieldValue } from '@/src/ddd/domain/tables/value-objects/field-values';

interface FileFieldInputProps {
  value: FileArrayFieldValue;
  onChange: (value: FileArrayFieldValue) => void;
  required?: boolean;
  allowedTypes?: string[];
  maxFiles?: number;
  error?: string;
}

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="relative"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Files
          <input
            type="file"
            multiple
            accept={acceptedTypes}
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={files.length >= maxFiles}
          />
        </Button>

        {maxFiles > 1 && (
          <Badge variant="secondary" className="text-xs">
            {files.length} / {maxFiles}
          </Badge>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2 border rounded-md p-3">
          {files.map((file, index) => (
            <div key={file.id || index} className="flex items-center justify-between p-2 bg-muted rounded">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <File className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {file.name}
                  </div>
                  {file.size && (
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveFile(index)}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {allowedTypes && allowedTypes.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Accepted types: {allowedTypes.join(', ')}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      {required && files.length === 0 && (
        <div className="text-sm text-muted-foreground">
          At least one file is required
        </div>
      )}
    </div>
  );
}