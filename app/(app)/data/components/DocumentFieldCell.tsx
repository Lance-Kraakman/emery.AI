"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit3, Eye, FileText, Plus, Upload, Loader, ExternalLink } from 'lucide-react';
import { useLayout } from '@/components/layout/LayoutProvider';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { DocumentFieldValueDTO, DocumentArrayFieldValueDTO } from '@/app/mappers/row-mapper';
import { DocumentField } from '@/ddd/domain/tables/entities/document-field-entity';
import { OrganizationId, TableId, FieldId, UserId } from '@/ddd/domain/shared/value-objects';
import { DocumentCreationDialog } from './DocumentCreationDialog';

interface DocumentFieldCellProps {
  field: FieldDTO;
  value: DocumentArrayFieldValueDTO | null | undefined;
  organizationId: number;
  tableId: number;
  onSave: (value: DocumentArrayFieldValueDTO) => void;
}

export function DocumentFieldCell({ 
  field, 
  value, 
  organizationId, 
  tableId, 
  onSave 
}: DocumentFieldCellProps) {
  const { setCanvasType, setDocumentContext, setCanvasState } = useLayout();
  const [isCreating, setIsCreating] = useState(false);
  const [hoveredDocumentIndex, setHoveredDocumentIndex] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Handle document array - now properly typed!
  const documents = value || [];

  const openDocumentInCanvas = (documentValue: DocumentFieldValueDTO, mode: 'view' | 'edit' = 'view') => {
    const documentField = DocumentField.fromFieldValue(
      documentValue,
      OrganizationId.fromNumber(organizationId),
      TableId.fromNumber(tableId),
      FieldId.fromNumber(field.id)
    );

    setCanvasType('document');
    setDocumentContext({
      tableId,
      fieldId: field.id,
      documentField: documentField,
      mode: documentField.isTiptapDocument() && mode === 'edit' ? 'edit' : 'view'
    });
    setCanvasState('expanded');
  };

  const handleQuickOpen = (documentValue: DocumentFieldValueDTO) => {
    const documentField = DocumentField.fromFieldValue(
      documentValue,
      OrganizationId.fromNumber(organizationId),
      TableId.fromNumber(tableId),
      FieldId.fromNumber(field.id)
    );
    
    // Smart opening: TipTap docs open in edit mode, files open in view mode
    const mode = documentField.isTiptapDocument() ? 'edit' : 'view';
    openDocumentInCanvas(documentValue, mode);
  };

  const handleDocumentCreated = (document: DocumentFieldValueDTO, shouldOpen: boolean) => {
    // Add the new document to the array
    const newDocuments = [...documents, document];
    onSave(newDocuments);
    
    // Open in canvas if requested
    if (shouldOpen) {
      openDocumentInCanvas(document, 'edit');
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organizationId', organizationId.toString());
      formData.append('tableId', tableId.toString());
      formData.append('fieldId', field.id.toString());

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        
        // Convert file to document field value
        const documentFieldValue: DocumentFieldValueDTO = {
          ...result.data,
          documentMetadata: {
            title: result.data.name,
            version: 1,
            documentType: 'file',
            lastEditedBy: 'current-user', // TODO: Get from auth context
            lastEditedAt: new Date().toISOString()
          }
        };
        
        const newDocuments = [...documents, documentFieldValue];
        onSave(newDocuments);
      } else {
        console.error('Failed to upload file:', await response.text());
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // No documents - show add button
  if (documents.length === 0) {
    return (
      <div className="document-field-cell-empty">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader className="w-4 h-4 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Document
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          {!isCreating && (
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Add Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.getElementById(`file-upload-${field.id}`)?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </DropdownMenuItem>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
        
        <input
          id={`file-upload-${field.id}`}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
        
        <DocumentCreationDialog
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          field={field}
          organizationId={organizationId}
          tableId={tableId}
          onDocumentCreated={handleDocumentCreated}
        />
      </div>
    );
  }

  // Has documents - show document list similar to file list
  return (
    <div className="document-field-cell">
      <div className="flex flex-wrap gap-1">
        {documents.slice(0, 2).map((doc, idx) => {
          const documentField = DocumentField.fromFieldValue(
            doc,
            OrganizationId.fromNumber(organizationId),
            TableId.fromNumber(tableId),
            FieldId.fromNumber(field.id)
          );
          
          return (
            <div 
              key={doc.id || idx}
              className="relative"
              onMouseEnter={() => setHoveredDocumentIndex(idx)}
              onMouseLeave={() => setHoveredDocumentIndex(null)}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleQuickOpen(doc);
              }}
            >
              <div className="flex items-center gap-1 p-1 border rounded text-xs bg-blue-50 border-blue-200">
                {documentField.isTiptapDocument() ? (
                  <Edit3 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                ) : (
                  <FileText className="w-3 h-3 text-gray-600 flex-shrink-0" />
                )}
                <span className="truncate max-w-[120px]">
                  {documentField.getDisplayName()}
                </span>
              </div>
              
              {hoveredDocumentIndex === idx && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickOpen(doc)}
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-white shadow-sm border-gray-200 hover:bg-gray-50 z-10"
                  title={documentField.isTiptapDocument() ? "Open for editing" : "Open for viewing"}
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}
        
        {documents.length > 2 && (
          <div className="text-xs text-gray-500 p-1">
            +{documents.length - 2} more
          </div>
        )}
        
        {/* Add button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isCreating} className="h-6 px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          {!isCreating && (
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Add Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => document.getElementById(`file-upload-${field.id}`)?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </DropdownMenuItem>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>
      
      <input
        id={`file-upload-${field.id}`}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />
    </div>
  );
}

// Helper functions
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}