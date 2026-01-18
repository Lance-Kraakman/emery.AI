'use client';

/**
 * TemplatePickerDialog Component
 *
 * Modal for selecting a template when creating a new entity.
 * Shows both builtin and saved templates filtered by entity type.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Sparkles,
  Database,
  Bot,
  LayoutGrid,
  Lock,
  Loader2,
  FileText,
} from 'lucide-react';
import type { TemplateDTO, BuiltinTemplateInfo, TemplateEntityType } from '@/ddd/domain/templates/types';
import { getBuiltinTemplatesByType, listTemplates } from '@/app/actions/templates';

// =============================================================================
// Types
// =============================================================================

interface TemplatePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Entity type to filter templates */
  entityType: TemplateEntityType;
  /** Called when a builtin template is selected */
  onSelectBuiltin?: (templateId: string) => void;
  /** Called when a saved template is selected */
  onSelectSaved?: (templateId: number) => void;
  /** Optional title override */
  title?: string;
  /** Optional description override */
  description?: string;
}

type SelectedTemplate =
  | { type: 'builtin'; id: string; name: string }
  | { type: 'saved'; id: number; name: string };

// =============================================================================
// Helper Functions
// =============================================================================

function getEntityTypeIcon(entityType: TemplateEntityType) {
  switch (entityType) {
    case 'skill':
      return <Sparkles className="h-4 w-4" />;
    case 'database':
      return <Database className="h-4 w-4" />;
    case 'agent':
      return <Bot className="h-4 w-4" />;
    case 'org_section':
      return <LayoutGrid className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getEntityTypeLabel(entityType: TemplateEntityType): string {
  switch (entityType) {
    case 'skill':
      return 'skill';
    case 'database':
      return 'database';
    case 'agent':
      return 'agent';
    case 'org_section':
      return 'org section';
    default:
      return entityType;
  }
}

// =============================================================================
// Template Item Component
// =============================================================================

interface TemplateItemProps {
  name: string;
  description: string;
  category?: string | null;
  tags?: string[];
  isBuiltin: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function TemplateItem({
  name,
  description,
  category,
  tags,
  isBuiltin,
  isSelected,
  onClick,
}: TemplateItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left p-3 rounded-lg border transition-colors
        ${isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:border-border hover:bg-muted/50'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm">{name}</span>
        {isBuiltin && (
          <Badge variant="outline" className="shrink-0 gap-1 text-xs">
            <Lock className="h-2.5 w-2.5" />
            Builtin
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
        {description || 'No description'}
      </p>
      {(category || (tags && tags.length > 0)) && (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {category && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {category}
            </Badge>
          )}
          {tags?.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {tags && tags.length > 2 && (
            <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>
          )}
        </div>
      )}
    </button>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function TemplatePickerDialog({
  isOpen,
  onClose,
  entityType,
  onSelectBuiltin,
  onSelectSaved,
  title,
  description,
}: TemplatePickerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'builtin' | 'saved'>('builtin');
  const [builtinTemplates, setBuiltinTemplates] = useState<BuiltinTemplateInfo[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<TemplateDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate | null>(null);

  // Fetch templates when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    async function fetchTemplates() {
      setIsLoading(true);
      setSelectedTemplate(null);
      setSearchQuery('');

      try {
        const [builtinResult, savedResult] = await Promise.all([
          getBuiltinTemplatesByType(entityType),
          listTemplates({ entityType }),
        ]);

        setBuiltinTemplates(builtinResult.success ? builtinResult.data || [] : []);
        setSavedTemplates(savedResult.success ? savedResult.data || [] : []);
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplates();
  }, [isOpen, entityType]);

  // Filter templates by search query
  const filteredBuiltins = useMemo(() => {
    if (!searchQuery) return builtinTemplates;
    const query = searchQuery.toLowerCase();
    return builtinTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    );
  }, [builtinTemplates, searchQuery]);

  const filteredSaved = useMemo(() => {
    if (!searchQuery) return savedTemplates;
    const query = searchQuery.toLowerCase();
    return savedTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    );
  }, [savedTemplates, searchQuery]);

  // Handle template selection
  const handleSelectBuiltin = useCallback((template: BuiltinTemplateInfo) => {
    setSelectedTemplate({ type: 'builtin', id: template.id, name: template.name });
  }, []);

  const handleSelectSaved = useCallback((template: TemplateDTO) => {
    setSelectedTemplate({ type: 'saved', id: template.id, name: template.name });
  }, []);

  // Handle apply
  const handleApply = useCallback(() => {
    if (!selectedTemplate) return;

    if (selectedTemplate.type === 'builtin') {
      onSelectBuiltin?.(selectedTemplate.id);
    } else {
      onSelectSaved?.(selectedTemplate.id);
    }
    onClose();
  }, [selectedTemplate, onSelectBuiltin, onSelectSaved, onClose]);

  const defaultTitle = `Choose a ${getEntityTypeLabel(entityType)} template`;
  const defaultDescription = `Start with a pre-built ${getEntityTypeLabel(entityType)} template`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getEntityTypeIcon(entityType)}
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription>
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'builtin' | 'saved')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="builtin">
                Builtin ({filteredBuiltins.length})
              </TabsTrigger>
              <TabsTrigger value="saved">
                My Library ({filteredSaved.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="builtin" className="mt-2">
              <ScrollArea className="h-[300px] pr-2">
                {filteredBuiltins.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {searchQuery ? 'No templates match your search' : 'No builtin templates available'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredBuiltins.map((template) => (
                      <TemplateItem
                        key={template.id}
                        name={template.name}
                        description={template.description}
                        category={template.category}
                        tags={template.tags}
                        isBuiltin={true}
                        isSelected={
                          selectedTemplate?.type === 'builtin' &&
                          selectedTemplate.id === template.id
                        }
                        onClick={() => handleSelectBuiltin(template)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="saved" className="mt-2">
              <ScrollArea className="h-[300px] pr-2">
                {filteredSaved.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {searchQuery
                      ? 'No templates match your search'
                      : 'No saved templates yet. Import a .brain file to get started.'}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredSaved.map((template) => (
                      <TemplateItem
                        key={template.id}
                        name={template.name}
                        description={template.description}
                        category={template.category}
                        tags={template.tags}
                        isBuiltin={false}
                        isSelected={
                          selectedTemplate?.type === 'saved' &&
                          selectedTemplate.id === template.id
                        }
                        onClick={() => handleSelectSaved(template)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedTemplate ? (
              <span>Selected: <strong>{selectedTemplate.name}</strong></span>
            ) : (
              <span>Select a template to continue</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!selectedTemplate}>
              Use Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplatePickerDialog;
