'use client';

/**
 * TemplateGallery Component
 *
 * Grid layout for browsing templates with filtering and search.
 * Supports tabs for builtin vs saved templates.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@tanstack/react-store';
import { uiStateStore, uiStateSelectors } from '@/stores/ui-state.store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Upload, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { TemplateCard } from './TemplateCard';
import type { TemplateDTO, BuiltinTemplateInfo, TemplateEntityType } from '@/ddd/domain/templates/types';
import {
  deleteTemplate,
  exportTemplate,
  exportBuiltinTemplate,
  saveBuiltinToLibrary,
  applyBuiltinSkillTemplate,
  applyBuiltinDatabaseTemplate,
} from '@/app/actions/templates';

// =============================================================================
// Types
// =============================================================================

export interface TemplateGalleryProps {
  /** Builtin templates */
  builtinTemplates: BuiltinTemplateInfo[];
  /** Saved templates (organization's library) */
  savedTemplates: TemplateDTO[];
  /** Callback when import button is clicked */
  onImportClick?: () => void;
  /** Callback to refresh templates */
  onRefresh?: () => void;
  /** Whether data is being refreshed */
  isRefreshing?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const ENTITY_TYPE_OPTIONS: { value: TemplateEntityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'skill', label: 'Skills' },
  { value: 'agent', label: 'Agents' },
  { value: 'database', label: 'Databases' },
  { value: 'org_section', label: 'Org Sections' },
];

// =============================================================================
// Component
// =============================================================================

export function TemplateGallery({
  builtinTemplates,
  savedTemplates,
  onImportClick,
  onRefresh,
  isRefreshing = false,
}: TemplateGalleryProps) {
  const router = useRouter();

  // Layout-aware grid: reduce columns when both sidebar and chat are expanded
  const sidebarState = useStore(uiStateStore, uiStateSelectors.sidebarState);
  const chatState = useStore(uiStateStore, uiStateSelectors.chatState);
  const bothPanelsExpanded = sidebarState === 'expanded' && chatState === 'expanded';
  const gridClassName = bothPanelsExpanded
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3';

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<TemplateEntityType | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'builtin' | 'saved'>('builtin');

  // Action loading states
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  // Set loading state for a specific action
  const setActionLoading = useCallback((key: string, loading: boolean) => {
    setLoadingActions(prev => ({ ...prev, [key]: loading }));
  }, []);

  // Filter builtin templates
  const filteredBuiltins = useMemo(() => {
    return builtinTemplates.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = entityTypeFilter === 'all' || t.entityType === entityTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [builtinTemplates, searchQuery, entityTypeFilter]);

  // Filter saved templates
  const filteredSaved = useMemo(() => {
    return savedTemplates.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = entityTypeFilter === 'all' || t.entityType === entityTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [savedTemplates, searchQuery, entityTypeFilter]);

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  const handleApplyBuiltin = useCallback(async (template: BuiltinTemplateInfo) => {
    const key = `apply-${template.id}`;
    setActionLoading(key, true);

    try {
      if (template.entityType === 'skill') {
        const result = await applyBuiltinSkillTemplate(template.id);
        if (result.success) {
          toast.success(`Skill "${result.data?.skillName}" created successfully`);
          router.push('/skills');
        } else {
          toast.error(result.error || 'Failed to apply template');
        }
      } else if (template.entityType === 'database') {
        const result = await applyBuiltinDatabaseTemplate(template.id);
        if (result.success) {
          toast.success(`Database "${result.data?.name}" created successfully`);
          router.push('/data');
        } else {
          toast.error(result.error || 'Failed to apply template');
        }
      } else {
        toast.info('Template application for this type is not yet implemented');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Apply template error:', error);
    } finally {
      setActionLoading(key, false);
    }
  }, [router, setActionLoading]);

  const handleApplySaved = useCallback(async (template: TemplateDTO) => {
    const key = `apply-saved-${template.id}`;
    setActionLoading(key, true);

    try {
      // For saved templates, navigate to new skill page with template ID
      if (template.entityType === 'skill') {
        router.push(`/skills/new?templateId=${template.id}`);
      } else {
        toast.info('Template application for this type is not yet implemented');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Apply template error:', error);
    } finally {
      setActionLoading(key, false);
    }
  }, [router, setActionLoading]);

  const handleExportBuiltin = useCallback(async (template: BuiltinTemplateInfo) => {
    const key = `export-${template.id}`;
    setActionLoading(key, true);

    try {
      const result = await exportBuiltinTemplate(template.id);
      if (result.success && result.data) {
        // Download as file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}.enhancd.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Template downloaded');
      } else {
        toast.error(result.error || 'Failed to export template');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Export error:', error);
    } finally {
      setActionLoading(key, false);
    }
  }, [setActionLoading]);

  const handleExportSaved = useCallback(async (template: TemplateDTO) => {
    const key = `export-saved-${template.id}`;
    setActionLoading(key, true);

    try {
      const result = await exportTemplate(template.id);
      if (result.success && result.data) {
        // Download as file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.name.toLowerCase().replace(/\s+/g, '-')}.enhancd.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Template downloaded');
      } else {
        toast.error(result.error || 'Failed to export template');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Export error:', error);
    } finally {
      setActionLoading(key, false);
    }
  }, [setActionLoading]);

  const handleSaveToLibrary = useCallback(async (template: BuiltinTemplateInfo) => {
    const key = `save-${template.id}`;
    setActionLoading(key, true);

    try {
      const result = await saveBuiltinToLibrary(template.id);
      if (result.success) {
        toast.success('Template saved to your library');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to save template');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Save to library error:', error);
    } finally {
      setActionLoading(key, false);
    }
  }, [onRefresh, setActionLoading]);

  const handleDeleteSaved = useCallback(async (template: TemplateDTO) => {
    const key = `delete-${template.id}`;
    setActionLoading(key, true);

    try {
      const result = await deleteTemplate(template.id);
      if (result.success) {
        toast.success('Template deleted');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to delete template');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
      console.error('Delete error:', error);
    } finally {
      setActionLoading(key, false);
    }
  }, [onRefresh, setActionLoading]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={entityTypeFilter}
          onValueChange={(value) => setEntityTypeFilter(value as TemplateEntityType | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}

        {onImportClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onImportClick}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'builtin' | 'saved')}>
        <TabsList>
          <TabsTrigger value="builtin">
            Builtin Templates ({filteredBuiltins.length})
          </TabsTrigger>
          <TabsTrigger value="saved">
            My Library ({filteredSaved.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builtin" className="mt-4">
          {filteredBuiltins.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || entityTypeFilter !== 'all'
                ? 'No templates match your filters'
                : 'No builtin templates available'}
            </div>
          ) : (
            <div className={gridClassName}>
              {filteredBuiltins.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isBuiltin={true}
                  onApply={() => handleApplyBuiltin(template)}
                  onExport={() => handleExportBuiltin(template)}
                  onSaveToLibrary={() => handleSaveToLibrary(template)}
                  loading={
                    loadingActions[`apply-${template.id}`] ||
                    loadingActions[`export-${template.id}`] ||
                    loadingActions[`save-${template.id}`]
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="mt-4">
          {filteredSaved.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery || entityTypeFilter !== 'all'
                ? 'No templates match your filters'
                : 'No saved templates yet. Import a .brain file or save a builtin template to get started.'}
            </div>
          ) : (
            <div className={gridClassName}>
              {filteredSaved.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isBuiltin={false}
                  onApply={() => handleApplySaved(template)}
                  onExport={() => handleExportSaved(template)}
                  onDelete={() => handleDeleteSaved(template)}
                  loading={
                    loadingActions[`apply-saved-${template.id}`] ||
                    loadingActions[`export-saved-${template.id}`] ||
                    loadingActions[`delete-${template.id}`]
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TemplateGallery;
