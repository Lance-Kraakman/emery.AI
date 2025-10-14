'use client';

import React, { useCallback, useRef, useState } from 'react';
import { FieldBadgeList } from './FieldBadgeList';
import type { FieldBadgeItem } from './FieldBadgeList';
import type { FileArrayFieldValue, FileFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface FileFieldProps {
  value: FileArrayFieldValue;
  onChange?: (value: FileArrayFieldValue) => void;
  isEditMode?: boolean;
  onFileOpen?: (file: any) => void;
  maxFiles?: number;
  allowedTypes?: string[];
  compact?: boolean;
  disabled?: boolean;
  fieldName?: string;
  readOnly?: boolean;
}

/**
 * FileField - Unified component for file fields
 *
 * Display Mode (isEditMode=false):
 * - Shows files as compact badges with file icon
 * - Click badge → Opens file (download or viewer)
 *
 * Edit Mode (isEditMode=true):
 * - Shows files as badges with remove buttons
 * - Click + button → Opens file picker directly
 * - Shows file count badge (e.g., "3/10 files")
 * - Handles file upload
 *
 * Usage:
 * - Table cells: compact={true}
 * - Forms: compact={false}
 */
export function FileField({
  value,
  onChange,
  isEditMode = false,
  onFileOpen,
  maxFiles = 10,
  allowedTypes,
  compact = false,
  disabled = false,
  fieldName,
  readOnly = false
}: FileFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const files = Array.isArray(value) ? value : [];

  // Convert files to badge items
  const badgeItems: FieldBadgeItem[] = files.map((file: any) => ({
    id: file.id || file.name,
    label: file.name || file.filename || 'Unknown File',
    type: 'file' as const,
    metadata: file
  }));

  // Handle file click (display mode)
  const handleFileClick = useCallback((item: FieldBadgeItem) => {
    if (onFileOpen && item.metadata) {
      onFileOpen(item.metadata);
    } else {
      // Fallback: try to open file in new window
      const fileUrl = item.metadata?.url || item.metadata?.downloadUrl;
      if (fileUrl) {
        window.open(fileUrl, '_blank');
      }
    }
  }, [onFileOpen]);

  // Handle file removal (edit mode)
  const handleRemoveFile = useCallback((index: number) => {
    if (!onChange) return;
    const newFiles = files.filter((_, i) => i !== index);
    onChange(newFiles);
  }, [files, onChange]);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFiles: FileList) => {
    if (!onChange) return;

    setIsUploading(true);
    try {
      // TODO: Implement actual file upload logic
      // For now, create mock file objects
      const newFiles = Array.from(selectedFiles).map((file, index) => ({
        id: `temp-${Date.now()}-${index}`,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        s3Key: `temp://upload/${file.name}`,
        uploadedAt: new Date().toISOString()
      }));

      const updatedFiles = [...files, ...newFiles].slice(0, maxFiles);
      onChange(updatedFiles);
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setIsUploading(false);
    }
  }, [files, onChange, maxFiles]);

  // Handle add button click (edit mode)
  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const acceptedTypes = allowedTypes?.join(',') || '*/*';
  const canAddMore = files.length < maxFiles;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FieldBadgeList
          items={badgeItems}
          isEditMode={isEditMode}
          compact={compact}
          maxVisible={compact ? 2 : 3}
          showAddButton={canAddMore && !readOnly}
          onAdd={onChange && !readOnly ? handleAddClick : undefined}
          onRemove={isEditMode ? handleRemoveFile : undefined}
          onItemClick={!isEditMode ? handleFileClick : undefined}
          disabled={disabled || isUploading || !canAddMore}
          emptyMessage={compact ? undefined : `No ${fieldName?.toLowerCase() || 'files'}`}
        />

        {/* File count badge (edit mode, non-compact) */}
        {isEditMode && !compact && maxFiles > 1 && (
          <Badge variant="secondary" className="text-xs">
            {files.length} / {maxFiles}
          </Badge>
        )}
      </div>

      {/* Upload button (edit mode, non-compact only) */}
      {isEditMode && !compact && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading || !canAddMore}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>

          {allowedTypes && allowedTypes.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Accepted: {allowedTypes.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files);
          }
          e.target.value = ''; // Reset input
        }}
        className="hidden"
        disabled={disabled || isUploading || !canAddMore}
      />
    </div>
  );
}
