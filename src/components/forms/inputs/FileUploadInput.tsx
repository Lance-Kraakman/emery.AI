'use client';

/**
 * FileUploadInput Component
 *
 * Form input for file and document field types
 * Supports file upload with type and size restrictions from metadata
 */

import React, { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, X, File } from 'lucide-react';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { InputThemeClasses, FormFieldOptions } from '../input-mapper';

interface FileUploadInputProps {
  field: FieldDTO;
  value: File | File[] | null;
  onChange: (value: File | File[] | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  themeClasses?: InputThemeClasses;
  formFieldOptions?: FormFieldOptions;
}

export function FileUploadInput({
  field,
  value,
  onChange,
  label,
  required,
  disabled,
  themeClasses,
  formFieldOptions,
}: FileUploadInputProps) {
  const inputLabel = label || field.name;
  const isRequired = required ?? field.required ?? false;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract file config from metadata, with form-level overrides
  const allowedTypes = (field.metadata as any)?.allowedTypes as string[] | undefined;
  const maxSize = (field.metadata as any)?.maxSize as number | undefined; // in bytes
  const multiple = formFieldOptions?.allowMultiple ?? (field.metadata as any)?.multiple as boolean | undefined;
  const maxFiles = formFieldOptions?.maxFiles as number | undefined;

  const files = value ? (Array.isArray(value) ? value : [value]) : [];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length === 0) {
      onChange(null);
      return;
    }

    // Validate file sizes
    if (maxSize) {
      const oversized = selectedFiles.find((file) => file.size > maxSize);
      if (oversized) {
        alert(`File "${oversized.name}" exceeds max size of ${formatBytes(maxSize)}`);
        return;
      }
    }

    // Enforce maxFiles limit
    let filesToAdd = selectedFiles;
    if (multiple && maxFiles && selectedFiles.length > maxFiles) {
      filesToAdd = selectedFiles.slice(0, maxFiles);
      alert(`Maximum ${maxFiles} files allowed. Only the first ${maxFiles} were added.`);
    }

    onChange(multiple ? filesToAdd : filesToAdd[0]);
  };

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    onChange(updatedFiles.length > 0 ? (multiple ? updatedFiles : updatedFiles[0]) : null);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={themeClasses?.fieldGroup || "space-y-2"}>
      <Label htmlFor={`field-${field.id}`} className={themeClasses?.label || undefined}>
        {inputLabel}
        {isRequired && <span className={themeClasses?.error || "text-destructive ml-1"}>*</span>}
      </Label>

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedTypes?.join(',') || undefined}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {files.length > 0 ? 'Change File(s)' : 'Upload File(s)'}
        </Button>

        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 border rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File className="h-4 w-4 shrink-0" />
                  <span className="text-sm truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(allowedTypes || maxSize) && (
        <p className="text-xs text-muted-foreground">
          {allowedTypes && `Allowed types: ${allowedTypes.join(', ')}`}
          {allowedTypes && maxSize && ' • '}
          {maxSize && `Max size: ${formatBytes(maxSize)}`}
        </p>
      )}
    </div>
  );
}
