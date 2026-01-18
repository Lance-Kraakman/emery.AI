'use client';

/**
 * SaveAsTemplateDialog Component
 *
 * Dialog for saving an entity as a template in the library.
 * Used by skill/agent/database/table editors.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { createTemplate } from '@/app/actions/templates';
import type { TemplateEntityType, TemplateContent } from '@/ddd/domain/templates/types';

interface SaveAsTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Entity type being saved */
  entityType: TemplateEntityType;
  /** Current name of the entity (used as default template name) */
  entityName: string;
  /** Current description of the entity (optional) */
  entityDescription?: string;
  /** Async function to get the template content from the entity */
  onExportData: () => Promise<{ success: boolean; data?: TemplateContent; error?: string }>;
  /** Called after successful save */
  onSaved?: () => void;
}

export function SaveAsTemplateDialog({
  isOpen,
  onClose,
  entityType,
  entityName,
  entityDescription,
  onExportData,
  onSaved,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(entityName);
      setDescription(entityDescription || '');
      setCategory('');
    }
  }, [isOpen, entityName, entityDescription]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }

    setIsSaving(true);
    try {
      // Get the template content from the entity
      const exportResult = await onExportData();

      if (!exportResult.success || !exportResult.data) {
        toast.error(exportResult.error || 'Failed to export entity');
        return;
      }

      // Save to template library
      const saveResult = await createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        entityType,
        templateData: exportResult.data,
      });

      if (!saveResult.success) {
        toast.error(saveResult.error || 'Failed to save template');
        return;
      }

      toast.success('Template saved to library');
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const entityLabel = entityType === 'org_section' ? 'org section' : entityType;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Save this {entityLabel} as a reusable template in your library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`My ${entityLabel} template`}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Describe what this ${entityLabel} template does...`}
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-category">Category (optional)</Label>
            <Input
              id="template-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Data Processing, Customer Support"
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveAsTemplateDialog;
