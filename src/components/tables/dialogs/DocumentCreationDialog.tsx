"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit3, Loader } from 'lucide-react';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { DocumentFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface DocumentCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  field: FieldDTO;
  organizationId: number;
  tableId: number;
  rowId?: string;  // Row ID for updating existing rows
  onDocumentCreated: (document: DocumentFieldValue, shouldOpen: boolean) => void;
}

export function DocumentCreationDialog({
  isOpen,
  onClose,
  field,
  organizationId,
  tableId,
  rowId,
  onDocumentCreated
}: DocumentCreationDialogProps) {
  const [documentName, setDocumentName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (shouldOpen: boolean) => {
    if (!documentName.trim()) {
      setError('Document name is required');
      return;
    }

    setIsCreating(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('organizationId', organizationId.toString());
      formData.append('tableId', tableId.toString());
      formData.append('fieldId', field.id.toString());
      formData.append('documentTitle', documentName.trim());
      formData.append('documentType', 'tiptap');
      formData.append('initialContent', JSON.stringify([]));
      if (rowId) {
        formData.append('rowId', rowId);
      }

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        onDocumentCreated(result.data, shouldOpen);
        handleClose();
      } else {
        const errorText = await response.text();
        setError(`Failed to create document: ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to create document:', error);
      setError('Failed to create document. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setDocumentName('');
    setError(null);
    setIsCreating(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating && documentName.trim()) {
      e.preventDefault();
      handleCreate(false); // Default to create without opening
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Create New Document
          </DialogTitle>
          <DialogDescription>
            Create a new document in the &quot;{field.name}&quot; field.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="document-name">Document Name</Label>
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter document name..."
              disabled={isCreating}
              autoFocus
            />
          </div>
          
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          
          <Button
            variant="outline"
            onClick={() => handleCreate(false)}
            disabled={isCreating || !documentName.trim()}
          >
            {isCreating ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Edit3 className="w-4 h-4 mr-2" />
            )}
            Create
          </Button>
          
          <Button
            onClick={() => handleCreate(true)}
            disabled={isCreating || !documentName.trim()}
          >
            {isCreating ? (
              <Loader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Edit3 className="w-4 h-4 mr-2" />
            )}
            Create & Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}