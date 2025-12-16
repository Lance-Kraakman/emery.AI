'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { FieldBadgeList } from './FieldBadgeList';
import type { FieldBadgeItem } from './FieldBadgeList';
import type { DocumentArrayFieldValue, DocumentFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Edit3, Upload, PlusCircle, X, ExternalLink } from 'lucide-react';
import { DocumentCreationDialog } from '@/components/tables/dialogs/DocumentCreationDialog';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

interface DocumentFieldProps {
  value: DocumentArrayFieldValue;
  onChange?: (value: DocumentArrayFieldValue) => void;
  isEditMode?: boolean;
  onDocumentOpen?: (document: any) => void;
  field?: FieldDTO;
  organizationId?: number;
  tableId?: number;
  rowId?: string;  // Row ID for updating existing rows when creating documents
  compact?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  // DSG cell focus state - when true, show expanded dialog
  focus?: boolean;
  onClose?: () => void;
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
  rowId,
  compact = false,
  disabled = false,
  readOnly = false,
  focus = false,
  onClose
}: DocumentFieldProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isExpandedDialogOpen, setIsExpandedDialogOpen] = useState(false);

  const documents = Array.isArray(value) ? value : [];

  // Listen for Cmd+Enter when focused (DSG integration)
  useEffect(() => {
    if (!focus) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setIsExpandedDialogOpen(true);
      }
      if (e.key === 'Escape' && isExpandedDialogOpen) {
        setIsExpandedDialogOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focus, isExpandedDialogOpen]);

  const handleExpandedDialogClose = useCallback(() => {
    setIsExpandedDialogOpen(false);
    onClose?.();
  }, [onClose]);

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
          rowId={rowId}
          onDocumentCreated={handleDocumentCreated}
        />
      )}

      {/* Expanded document manager popover (shown when DSG cell is focused) */}
      <Popover open={isExpandedDialogOpen} onOpenChange={(open) => !open && handleExpandedDialogClose()}>
        <PopoverAnchor />
        <PopoverContent
          className="w-[350px] p-3"
          align="start"
          side="bottom"
        >
          <div className="space-y-3">
            {/* Document list */}
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {documents.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No documents attached
                </div>
              ) : (
                documents.map((doc: any, index: number) => (
                  <div
                    key={doc.id || doc.name || index}
                    className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {doc.documentMetadata?.title || doc.name || 'Untitled Document'}
                      </div>
                      {doc.documentMetadata?.documentType && (
                        <div className="text-xs text-muted-foreground">
                          {doc.documentMetadata.documentType}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {onDocumentOpen && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onDocumentOpen(doc)}
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
                          onClick={() => handleRemoveDocument(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add document actions */}
            {!readOnly && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowCreateDialog(true)}
                  disabled={isCreating || !field}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                  Create
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => document.getElementById(`doc-upload-${field?.id || 'unknown'}`)?.click()}
                  disabled={isCreating}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload
                </Button>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
              <span>{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
