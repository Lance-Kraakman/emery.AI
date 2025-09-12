"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit3, Eye, FileText, Plus, Upload, Loader, ExternalLink, PlusCircle } from 'lucide-react';
import { useLayout } from '@/components/layout/LayoutProvider';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { DocumentFieldValue, DocumentArrayFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { DocumentField } from '@/ddd/domain/tables/entities/document-field-entity';
import { OrganizationId, TableId, FieldId } from '@/ddd/domain/shared/value-objects';
import { DocumentCreationDialog } from './DocumentCreationDialog';

interface DocumentFieldCellProps {
  field: FieldDTO;
  value: DocumentArrayFieldValue | null | undefined;
  organizationId: number;
  tableId: number;
  onSave: (value: DocumentArrayFieldValue) => void;
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

  const openDocumentInCanvas = (documentValue: DocumentFieldValue, mode: 'view' | 'edit' = 'view') => {
    // Create domain entity only when needed for canvas context (which still expects it)
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
      mode: mode // Document fields are always editable
    });
    setCanvasState('expanded');
  };

  const handleQuickOpen = (documentValue: DocumentFieldValue) => {
    // Document fields are always TipTap documents - always open in edit mode
    openDocumentInCanvas(documentValue, 'edit');
  };

  const handleDocumentCreated = (document: DocumentFieldValue, shouldOpen: boolean) => {
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
        const documentFieldValue: DocumentFieldValue = {
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

  // Always use the same layout whether documents exist or not (matches file field pattern)
  return (
    <div className="flex flex-wrap gap-1">
      {documents.slice(0, 2).map((doc, idx) => {
        const displayName = doc.documentMetadata?.title || doc.name;
        
        return (
          <div 
            key={doc.id || idx}
            className="relative"
            onMouseEnter={() => setHoveredDocumentIndex(idx)}
            onMouseLeave={() => setHoveredDocumentIndex(null)}
          >
            <Badge variant="outline" className="text-xs">
              {displayName}
            </Badge>
            {hoveredDocumentIndex === idx && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickOpen(doc)}
                className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-white shadow-sm border-gray-200 hover:bg-gray-50 z-10"
                title="Open document"
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
        );
      })}
      
      {documents.length > 2 && (
        <Badge variant="outline" className="text-xs">
          +{documents.length - 2} more
        </Badge>
      )}
      
      {/* Add button - uses PlusCircle to match file field exactly */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={isCreating}>
            <PlusCircle className="h-4 w-4" />
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

// Helper functions
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}