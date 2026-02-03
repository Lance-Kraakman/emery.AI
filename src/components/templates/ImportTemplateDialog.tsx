'use client';

/**
 * ImportTemplateDialog Component
 *
 * Dialog for importing .enhancd template files via drag-and-drop or file picker.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileJson, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { importTemplate, applyOrgSectionTemplate, type ApplyOrgSectionResult } from '@/app/actions/templates';
import type { BrainTemplate, TemplateEntityType } from '@/ddd/domain/templates/types';

// =============================================================================
// Types
// =============================================================================

interface ImportTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  /**
   * When true, applies org_section templates immediately (creates entities)
   * instead of saving to library. Used by org chart import.
   */
  applyImmediately?: boolean;
  /**
   * Callback when entities are created (only called when applyImmediately=true)
   */
  onEntitiesCreated?: (result: ApplyOrgSectionResult) => void;
}

interface ParsedTemplate {
  raw: string;
  parsed: BrainTemplate;
  fileName: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getEntityTypeLabel(entityType: TemplateEntityType): string {
  switch (entityType) {
    case 'skill':
      return 'Skill';
    case 'database':
      return 'Database';
    case 'agent':
      return 'Agent';
    case 'org_section':
      return 'Org Section';
    case 'table':
      return 'Table';
    case 'app':
      return 'App';
    case 'organization':
      return 'Organization';
    default:
      return entityType;
  }
}

function validateBrainTemplate(data: unknown): data is BrainTemplate {
  if (typeof data !== 'object' || data === null) return false;

  const template = data as Record<string, unknown>;

  return (
    template.$format === 'brain-template' &&
    typeof template.$version === 'number' &&
    typeof template.metadata === 'object' &&
    template.metadata !== null &&
    typeof (template.metadata as Record<string, unknown>).name === 'string' &&
    typeof template.template === 'object' &&
    template.template !== null
  );
}

// =============================================================================
// Component
// =============================================================================

export function ImportTemplateDialog({
  isOpen,
  onClose,
  onImportComplete,
  applyImmediately = false,
  onEntitiesCreated,
}: ImportTemplateDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Reset state when dialog closes
  const handleClose = useCallback(() => {
    setParsedTemplate(null);
    setParseError(null);
    setIsDragging(false);
    onClose();
  }, [onClose]);

  // Parse file content
  const parseFile = useCallback(async (file: File) => {
    setParseError(null);
    setParsedTemplate(null);

    // Validate file extension
    if (!file.name.endsWith('.enhancd.json') && !file.name.endsWith('.json')) {
      setParseError('Invalid file type. Please upload a .enhancd.json file.');
      return;
    }

    try {
      const content = await file.text();
      const parsed = JSON.parse(content);

      if (!validateBrainTemplate(parsed)) {
        setParseError('Invalid template format. File does not contain a valid .enhancd template.');
        return;
      }

      setParsedTemplate({
        raw: content,
        parsed,
        fileName: file.name,
      });
    } catch (error) {
      setParseError('Failed to parse file. Please ensure it contains valid JSON.');
      console.error('Parse error:', error);
    }
  }, []);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  }, [parseFile]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseFile(file);
    }
  }, [parseFile]);

  // Handle import
  const handleImport = useCallback(async () => {
    if (!parsedTemplate) return;

    setIsImporting(true);

    try {
      // Apply immediately mode: create entities from template
      if (applyImmediately) {
        const templateType = parsedTemplate.parsed.template.type;

        // Only org_section templates support apply immediately
        if (templateType !== 'org_section') {
          toast.error(`Only org section templates can be applied directly. This is a ${getEntityTypeLabel(templateType)} template.`);
          setIsImporting(false);
          return;
        }

        const result = await applyOrgSectionTemplate(parsedTemplate.raw);

        if (result.success && result.data) {
          const { agents, skills, databases } = result.data;
          const parts = [];
          if (agents.length > 0) parts.push(`${agents.length} agent${agents.length > 1 ? 's' : ''}`);
          if (skills.length > 0) parts.push(`${skills.length} skill${skills.length > 1 ? 's' : ''}`);
          if (databases.length > 0) parts.push(`${databases.length} database${databases.length > 1 ? 's' : ''}`);

          toast.success(`Template applied: created ${parts.join(', ')}`);
          onEntitiesCreated?.(result.data);
          onImportComplete?.();
          handleClose();
        } else {
          toast.error(result.error || 'Failed to apply template');
        }
      } else {
        // Library mode: save template to library
        const result = await importTemplate(parsedTemplate.raw);

        if (result.success) {
          toast.success(`Template "${parsedTemplate.parsed.metadata.name}" imported successfully`);
          onImportComplete?.();
          handleClose();
        } else {
          toast.error(result.error || 'Failed to import template');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  }, [parsedTemplate, applyImmediately, onImportComplete, onEntitiesCreated, handleClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{applyImmediately ? 'Apply Template' : 'Import Template'}</DialogTitle>
          <DialogDescription>
            {applyImmediately
              ? 'Upload a .enhancd.json template file to create agents, skills, and databases.'
              : 'Upload a .enhancd.json template file to add it to your library.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Drop Zone */}
          {!parsedTemplate && (
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                ${parseError ? 'border-destructive' : ''}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.enhancd.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                {isDragging ? 'Drop file here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                .enhancd.json files only
              </p>
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <div className="flex items-start gap-2 p-3 mt-3 rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="text-sm">{parseError}</span>
            </div>
          )}

          {/* Parsed Template Preview */}
          {parsedTemplate && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                <FileJson className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{parsedTemplate.parsed.metadata.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{parsedTemplate.fileName}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {getEntityTypeLabel(parsedTemplate.parsed.template.type)}
                </Badge>
              </div>

              {parsedTemplate.parsed.metadata.description && (
                <p className="text-sm text-muted-foreground">
                  {parsedTemplate.parsed.metadata.description}
                </p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {parsedTemplate.parsed.metadata.category && (
                  <Badge variant="outline" className="text-xs">
                    {parsedTemplate.parsed.metadata.category}
                  </Badge>
                )}
                {parsedTemplate.parsed.metadata.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Valid template format (v{parsedTemplate.parsed.$version})</span>
              </div>

              {/* Change file button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setParsedTemplate(null);
                  setParseError(null);
                }}
                className="text-xs"
              >
                Choose a different file
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsedTemplate || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {applyImmediately ? 'Applying...' : 'Importing...'}
              </>
            ) : (
              applyImmediately ? 'Apply Template' : 'Import to Library'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportTemplateDialog;
