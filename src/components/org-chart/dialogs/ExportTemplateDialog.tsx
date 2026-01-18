'use client';

/**
 * ExportTemplateDialog Component
 *
 * Dialog for exporting selected org chart entities as a .brain template file.
 * Allows editing metadata and choosing between download or save to library.
 */

import React, { useState, useCallback, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bot, Sparkles, Database, Download, Save, Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { exportOrgChartSelection, exportAndSaveOrgChartSelection } from '@/app/actions/templates';
import type { ExportPreview } from '../hooks/useOrgChartExport';

interface ExportTemplateDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Preview of entities to export */
  exportPreview: ExportPreview;
  /** Selection IDs for export */
  selection: {
    agentIds: number[];
    skillIds: number[];
    databaseIds: number[];
  };
  /** Callback after successful export/save */
  onExportComplete?: () => void;
}

export function ExportTemplateDialog({
  isOpen,
  onClose,
  exportPreview,
  selection,
  onExportComplete,
}: ExportTemplateDialogProps) {
  // Form state
  const [name, setName] = useState(() => {
    // Generate default name from selection
    if (exportPreview.agents.length === 1 && exportPreview.standaloneSkills.length === 0 && exportPreview.standaloneDatabases.length === 0) {
      return `${exportPreview.agents[0].name} Template`;
    }
    if (exportPreview.standaloneSkills.length === 1 && exportPreview.agents.length === 0 && exportPreview.standaloneDatabases.length === 0) {
      return `${exportPreview.standaloneSkills[0].name} Template`;
    }
    return 'Org Section Template';
  });
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Loading states
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens with new selection
  React.useEffect(() => {
    if (isOpen) {
      // Generate default name
      if (exportPreview.agents.length === 1 && exportPreview.standaloneSkills.length === 0 && exportPreview.standaloneDatabases.length === 0) {
        setName(`${exportPreview.agents[0].name} Template`);
      } else if (exportPreview.standaloneSkills.length === 1 && exportPreview.agents.length === 0 && exportPreview.standaloneDatabases.length === 0) {
        setName(`${exportPreview.standaloneSkills[0].name} Template`);
      } else {
        setName('Org Section Template');
      }
      setDescription('');
      setCategory('');
      setTags([]);
      setTagInput('');
    }
  }, [isOpen, exportPreview]);

  // Handle adding a tag
  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  // Handle removing a tag
  const handleRemoveTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  // Handle tag input keydown
  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  // Get metadata for export
  const getMetadata = useCallback(() => ({
    name: name.trim() || 'Untitled Template',
    description: description.trim(),
    category: category.trim() || undefined,
    tags: tags.length > 0 ? tags : undefined,
  }), [name, description, category, tags]);

  // Handle download as .brain file
  const handleDownload = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await exportOrgChartSelection(selection, getMetadata());

      if (!result.success) {
        toast.error(result.error || 'Failed to export template');
        return;
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name.toLowerCase().replace(/\s+/g, '-')}.brain.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Template downloaded');
      onExportComplete?.();
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export template');
    } finally {
      setIsExporting(false);
    }
  }, [selection, getMetadata, name, onExportComplete, onClose]);

  // Handle save to library
  const handleSaveToLibrary = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await exportAndSaveOrgChartSelection(selection, getMetadata());

      if (!result.success) {
        toast.error(result.error || 'Failed to save template');
        return;
      }

      toast.success('Template saved to library');
      onExportComplete?.();
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  }, [selection, getMetadata, onExportComplete, onClose]);

  const isLoading = isExporting || isSaving;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export as Template</DialogTitle>
          <DialogDescription>
            Export the selected items as a reusable .brain template file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Export Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Items to export</Label>
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 max-h-[150px] overflow-y-auto">
              {/* Agents */}
              {exportPreview.agents.map(agent => (
                <div key={`agent-${agent.id}`} className="flex items-start gap-2">
                  <Bot className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {agent.skillCount > 0 && `${agent.skillCount} skill${agent.skillCount !== 1 ? 's' : ''}`}
                      {agent.skillCount > 0 && agent.databaseCount > 0 && ', '}
                      {agent.databaseCount > 0 && `${agent.databaseCount} database${agent.databaseCount !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
              ))}

              {/* Standalone Skills */}
              {exportPreview.standaloneSkills.map(skill => (
                <div key={`skill-${skill.id}`} className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="text-sm truncate">{skill.name}</span>
                  {skill.agentId && <Badge variant="outline" className="text-xs">standalone</Badge>}
                </div>
              ))}

              {/* Standalone Databases */}
              {exportPreview.standaloneDatabases.map(db => (
                <div key={`db-${db.id}`} className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="text-sm truncate">{db.name}</span>
                  {db.agentId && <Badge variant="outline" className="text-xs">standalone</Badge>}
                </div>
              ))}

              {exportPreview.totalCount === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  No exportable items selected
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {exportPreview.totalCount} item{exportPreview.totalCount !== 1 ? 's' : ''} total
            </div>
          </div>

          <Separator />

          {/* Template Metadata Form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Template"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this template does..."
                rows={2}
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="template-category">Category</Label>
                <Input
                  id="template-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Sales, Marketing"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="template-tags">Tags</Label>
                <div className="flex gap-1">
                  <Input
                    id="template-tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Add tag..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddTag}
                    disabled={isLoading || !tagInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      disabled={isLoading}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={isLoading || exportPreview.totalCount === 0}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download
          </Button>
          <Button
            onClick={handleSaveToLibrary}
            disabled={isLoading || exportPreview.totalCount === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save to Library
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportTemplateDialog;
