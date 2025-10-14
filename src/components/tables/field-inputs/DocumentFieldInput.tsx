'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit3, Upload, ExternalLink, PlusCircle, Trash2 } from 'lucide-react';
import { FieldInput } from '@/components/tables/FieldInput';
import type { LabelDisplayItem } from '@/components/tables/LabelDisplay';
import type { DocumentArrayFieldValue, DocumentFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { DocumentCreationDialog } from '@/components/tables/dialogs/DocumentCreationDialog';
import type { FieldDTO } from '@/app/mappers/field-mapper';

interface DocumentFieldInputProps {
  value: DocumentArrayFieldValue;
  onChange: (value: DocumentArrayFieldValue) => void;
  required?: boolean;
  error?: string;
  field?: FieldDTO;
  organizationId?: number;
  tableId?: number;
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

export function DocumentFieldInput({
  value,
  onChange,
  required,
  error,
  field,
  organizationId = 1,
  tableId = 1
}: DocumentFieldInputProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredDocumentIndex, setHoveredDocumentIndex] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const dropdownMenuRef = useRef<HTMLButtonElement>(null);

  const documents = Array.isArray(value) ? value : [];
  const items = documentsToLabelItems(documents);

  const handleDocumentCreated = useCallback((document: DocumentFieldValue, shouldOpen: boolean) => {
    const newDocuments = [...documents, document];
    onChange(newDocuments);
  }, [documents, onChange]);

  const handleFileUpload = useCallback(async (file: File) => {
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

  const handleRemoveDocument = useCallback((index: number) => {
    const newDocuments = documents.filter((_, i) => i !== index);
    onChange(newDocuments);
  }, [documents, onChange]);

  const handleQuickOpen = useCallback((documentValue: DocumentFieldValue) => {
    console.log('Would open document:', documentValue.name);
    // TODO: Implement document opening logic when needed
  }, []);

  const handleCreateDocument = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  const handleUploadFile = useCallback(() => {
    document.getElementById(`doc-file-upload-${field?.id || 'unknown'}`)?.click();
  }, [field?.id]);

  return (
    <FieldInput
      items={items}
      onAdd={() => {
        // Show dropdown menu
        setShowDropdown(true);
      }}
      onRemove={handleRemoveDocument}
      error={error}
      requiredMessage={required ? 'At least one document is required' : undefined}
    >
      {/* Document actions dropdown */}
      <div className="flex items-center gap-2">
        <DropdownMenu open={showDropdown} onOpenChange={setShowDropdown}>
          <DropdownMenuTrigger asChild ref={dropdownMenuRef}>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={isCreating}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => {
              setShowDropdown(false);
              handleCreateDocument();
            }} disabled={isCreating}>
              <Edit3 className="w-4 h-4 mr-2" />
              Create Document
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setShowDropdown(false);
              handleUploadFile();
            }} disabled={isCreating}>
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Hidden file input */}
      <input
        id={`doc-file-upload-${field?.id || 'unknown'}`}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
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
    </FieldInput>
  );
}