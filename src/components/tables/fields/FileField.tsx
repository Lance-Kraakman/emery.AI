'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { FieldBadgeList } from './FieldBadgeList';
import type { FieldBadgeItem } from './FieldBadgeList';
import type { FileArrayFieldValue, FileFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Upload, X, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

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
  // Upload context - required for actual S3 upload
  organizationId?: number;
  tableId?: number;
  fieldId?: number;
  // DSG cell focus state - when true, show expanded dialog
  focus?: boolean;
  onClose?: () => void;
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
  readOnly = false,
  organizationId,
  tableId,
  fieldId,
  focus = false,
  onClose
}: FileFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const files = Array.isArray(value) ? value : [];

  // Listen for Cmd+Enter when focused (DSG integration)
  useEffect(() => {
    if (!focus) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setIsDialogOpen(true);
      }
      if (e.key === 'Escape' && isDialogOpen) {
        setIsDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focus, isDialogOpen]);

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    onClose?.();
  }, [onClose]);

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

  // Handle file selection - uploads directly to S3, no temp fallback
  const handleFileSelect = useCallback(async (selectedFiles: FileList) => {
    if (!onChange) return;
    setUploadError(null);

    // Require upload context - fail fast if not configured
    if (!organizationId || !tableId || !fieldId) {
      setUploadError('Upload not configured. Please contact support.');
      return;
    }

    setIsUploading(true);
    const uploadedFiles: FileFieldValue[] = [];
    const failedFiles: string[] = [];

    try {
      for (const file of Array.from(selectedFiles)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('organizationId', organizationId.toString());
        formData.append('tableId', tableId.toString());
        formData.append('fieldName', fieldId.toString());

        try {
          const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
          });
          const result = await response.json();

          if (result.data) {
            uploadedFiles.push(result.data);
          } else {
            console.error('Upload failed:', result.error);
            failedFiles.push(file.name);
          }
        } catch (err) {
          console.error('Upload error:', err);
          failedFiles.push(file.name);
        }
      }

      if (uploadedFiles.length > 0) {
        onChange([...files, ...uploadedFiles].slice(0, maxFiles));
      }

      if (failedFiles.length > 0) {
        setUploadError(`Failed to upload: ${failedFiles.join(', ')}`);
      }
    } finally {
      setIsUploading(false);
    }
  }, [files, onChange, maxFiles, organizationId, tableId, fieldId]);

  // Handle add button click (edit mode)
  const handleAddClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const acceptedTypes = allowedTypes?.join(',') || '*/*';
  const canAddMore = files.length < maxFiles;

  return (
    <Popover open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
      <PopoverAnchor asChild>
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
              onItemOpen={onFileOpen ? handleFileClick : undefined}
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
      </PopoverAnchor>

      {/* Expanded file manager popover (shown when DSG cell is focused) */}
      <PopoverContent
        className="w-[350px] p-3"
        align="start"
        side="bottom"
      >
        <div className="space-y-3">
          {/* File list */}
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
            {files.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No files attached
              </div>
            ) : (
              files.map((file: any, index: number) => (
                <div
                  key={file.id || file.name || index}
                  className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {file.name || file.filename || 'Unknown File'}
                    </div>
                    {file.size && (
                      <div className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {onFileOpen && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleFileClick({ id: file.id, label: file.name, metadata: file })}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Upload error message */}
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}

          {/* Upload button */}
          {!readOnly && canAddMore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="h-3.5 w-3.5 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </Button>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
            <span>{files.length} / {maxFiles} files</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
