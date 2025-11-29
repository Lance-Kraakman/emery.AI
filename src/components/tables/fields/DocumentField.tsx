'use client';

import React, { useState, useCallback } from 'react';
import { FieldBadgeList } from './FieldBadgeList';
import type { FieldBadgeItem } from './FieldBadgeList';
import type { DocumentArrayFieldValue, DocumentFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Edit3, Upload, PlusCircle } from 'lucide-react';
import { DocumentCreationDialog } from '@/components/tables/dialogs/DocumentCreationDialog';

interface DocumentFieldProps {
  value: DocumentArrayFieldValue;
  onChange?: (value: DocumentArrayFieldValue) => void;
  isEditMode?: boolean;
  onDocumentOpen?: (document: any) => void;
  field?: FieldDTO;
  organizationId?: number;
  tableId?: number;
  compact?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
}

/**
 * DocumentField - Unified component for document fields
 *
 * Display Mode (isEditMode=false):
 * - Shows documents as compact badges with document icon
 * - Click badge → Opens document in canvas/viewer
 *
 * Edit Mode (isEditMode=true):
 * - Shows documents as badges with remove buttons
 * - Click + button → Dropdown menu (Create Document / Upload File)
 * - Manages document creation and file upload
 *
 * Usage:
 * - Table cells: compact={true}
 * - Forms: compact={false}
 */
export function DocumentField({
  value,
  onChange,
  isEditMode = false,
  onDocumentOpen,
  field,
  organizationId = 1,
  tableId = 1,
  compact = false,
  disabled = false,
  readOnly = false
}: DocumentFieldProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const documents = Array.isArray(value) ? value : [];

  // Convert documents to badge items
  const badgeItems: FieldBadgeItem[] = documents.map((doc: any) => ({
    id: doc.id || doc.name,
    label: doc.documentMetadata?.title || doc.name || 'Untitled Document',
    type: 'document' as const,
    metadata: doc
  }));

  // Handle document click (display mode)
  const handleDocumentClick = useCallback((item: FieldBadgeItem) => {
    if (onDocumentOpen && item.metadata) {
      onDocumentOpen(item.metadata);
    }
  }, [onDocumentOpen]);

  // Handle document removal (edit mode)
  const handleRemoveDocument = useCallback((index: number) => {
    if (!onChange) return;
    const newDocuments = documents.filter((_, i) => i !== index);
    onChange(newDocuments);
  }, [documents, onChange]);

  // Handle document created callback
  const handleDocumentCreated = useCallback((document: DocumentFieldValue, shouldOpen: boolean) => {
    if (!onChange) return;
    const newDocuments = [...documents, document];
    onChange(newDocuments);
    setShowCreateDialog(false);
  }, [documents, onChange]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!onChange) return;

    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organizationId', organizationId.toString());
      formData.append('tableId', tableId.toString());
      formData.append('fieldId', field?.id?.toString() || '0');

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();

        // Convert uploaded file to document field value
        const documentFieldValue: DocumentFieldValue = {
          ...result.data,
          documentMetadata: {
            title: result.data.name,
            version: 1,
            documentType: 'file',
            lastEditedBy: 'current-user',
            lastEditedAt: new Date().toISOString()
          }
        };

        const newDocuments = [...documents, documentFieldValue];
        onChange(newDocuments);
      } else {
        console.error('Failed to upload file:', await response.text());
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setIsCreating(false);
    }
  }, [documents, onChange, organizationId, tableId, field?.id]);

  return (
    <div className="flex items-center gap-1.5">
      <FieldBadgeList
        items={badgeItems}
        isEditMode={isEditMode}
        compact={compact}
        maxVisible={compact ? 2 : 3}
        showAddButton={false}
        onRemove={isEditMode ? handleRemoveDocument : undefined}
        onItemClick={!isEditMode ? handleDocumentClick : undefined}
        onItemOpen={onDocumentOpen ? handleDocumentClick : undefined}
        disabled={disabled || isCreating}
        emptyMessage={compact ? undefined : `No ${(field?.name || 'documents').toLowerCase()}`}
      />

      {/* Document actions dropdown with + button */}
      {onChange && !readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`
                ${compact ? 'h-5 w-5' : 'h-6 w-6'}
                hover:bg-accent hover:text-accent-foreground
                flex-shrink-0
              `}
              onClick={(e) => e.stopPropagation()}
              disabled={disabled || isCreating}
              title="Add document"
            >
              <PlusCircle className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => setShowCreateDialog(true)}
              disabled={isCreating || !field}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Create Document
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // Trigger file input
                const input = document.getElementById(`doc-upload-${field?.id || 'unknown'}`);
                input?.click();
              }}
              disabled={isCreating}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Hidden file input for upload */}
      <input
        id={`doc-upload-${field?.id || 'unknown'}`}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = ''; // Reset input
        }}
      />

      {/* Document creation dialog */}
      {field && (
        <DocumentCreationDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          field={field}
          organizationId={organizationId}
          tableId={tableId}
          onDocumentCreated={handleDocumentCreated}
        />
      )}
    </div>
  );
}
