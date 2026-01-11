'use client';

import React, { useState, useEffect } from 'react';
import { FieldLabel } from '@measured/puck';
import type { ViewDTO } from '@/app/mappers/view-mapper';
import { getViewsForOrganization } from '@/app/actions/views';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Globe, Lock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ViewConfigurationForm } from '@/components/shared/ViewConfigurationForm';

// View Details Display Component
function ViewDetailsDisplay({ view }: { view: ViewDTO }) {
  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem value="details" className="border rounded-md px-2">
        <AccordionTrigger className="text-xs py-2 hover:no-underline">
          View Details
        </AccordionTrigger>
        <AccordionContent className="text-xs space-y-2 pb-2">
          {/* Basic Info */}
          <div className="flex items-center gap-2">
            <span className="font-medium">Type:</span>{' '}
            <Badge variant="secondary" className="text-xs capitalize">
              {view.viewType}
            </Badge>
            {view.requiresAuth === false ? (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                <Globe className="h-3 w-3 mr-1" />
                Public
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <Lock className="h-3 w-3 mr-1" />
                Private
              </Badge>
            )}
          </div>

          {view.description && (
            <div>
              <span className="font-medium">Description:</span>
              <p className="text-muted-foreground mt-1">{view.description}</p>
            </div>
          )}

          {/* Filters */}
          {view.filters.length > 0 && (
            <div>
              <span className="font-medium">Filters:</span>
              <div className="mt-1 space-y-1">
                {view.filters.map((filter, i) => (
                  <div key={i} className="text-muted-foreground">
                    • Field {filter.fieldId} {filter.operator} {filter.value ?? '(empty)'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sorting */}
          {view.sorting.length > 0 && (
            <div>
              <span className="font-medium">Sorting:</span>
              <div className="mt-1 space-y-1">
                {view.sorting.map((sort, i) => (
                  <div key={i} className="text-muted-foreground">
                    {sort.priority + 1}. Field {sort.fieldId} ({sort.direction})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metric Config */}
          {view.viewType === 'metric' && view.viewConfig.type === 'metric' && (
            <div>
              <span className="font-medium">Metric:</span>
              <p className="text-muted-foreground mt-1">
                {((view.viewConfig as any).aggregation?.aggregationType || 'unknown').toUpperCase()}
                {' '}of field {(view.viewConfig as any).aggregation?.fieldId}
              </p>
            </div>
          )}

          {/* Chart Config */}
          {view.viewType === 'chart' && view.viewConfig.type === 'chart' && (
            <div>
              <span className="font-medium">Chart:</span>
              <p className="text-muted-foreground mt-1 capitalize">
                {(view.viewConfig as any).chartType} chart,
                {' '}{(view.viewConfig as any).dataMode} mode
              </p>
            </div>
          )}

          {/* Grid Config */}
          {view.viewType === 'grid' && view.viewConfig.type === 'grid' && (
            <div>
              <span className="font-medium">Display:</span>
              <p className="text-muted-foreground mt-1">
                {(view.viewConfig as any).defaultPageSize || 50} rows per page
              </p>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export interface ViewManagementFieldConfig {
  supportedViewTypes: Array<'grid' | 'metric' | 'chart' | 'form'>;
  label?: string;
}

interface ViewManagementFieldProps {
  value?: number; // viewId
  onChange: (value: number) => void;
  field: ViewManagementFieldConfig;
  name: string;
  readOnly?: boolean;
}

export function ViewManagementFieldRenderer({
  value,
  onChange,
  field,
  name,
  readOnly = false,
}: ViewManagementFieldProps) {
  const [views, setViews] = useState<ViewDTO[]>([]);
  const [loadingViews, setLoadingViews] = useState(true);
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');
  const [selectedView, setSelectedView] = useState<ViewDTO | undefined>();

  // Load views on mount
  useEffect(() => {
    loadViews();
  }, []);

  // Update selected view when value changes
  useEffect(() => {
    if (value && views.length > 0) {
      const view = views.find(v => v.id === value);
      setSelectedView(view);
    }
  }, [value, views]);

  const loadViews = async () => {
    try {
      setLoadingViews(true);
      const allViews = await getViewsForOrganization();

      // Filter views by supported types
      const filteredViews = allViews.filter(v =>
        field.supportedViewTypes.includes(v.viewType as any)
      );

      setViews(filteredViews);
    } catch (error) {
      console.error('Error loading views:', error);
    } finally {
      setLoadingViews(false);
    }
  };

  const handleCreateSuccess = (newView: ViewDTO) => {
    // Add new view to list
    setViews(prev => [...prev, newView]);
    // Auto-select the new view (this triggers Puck re-render)
    onChange(newView.id);
    setSelectedView(newView);
    // Return to view mode
    setMode('view');
  };

  const handleEditSuccess = (updatedView: ViewDTO) => {
    // Update view in list
    setViews(prev => prev.map(v => v.id === updatedView.id ? updatedView : v));
    setSelectedView(updatedView);
    // Trigger Puck re-render with updated view
    onChange(updatedView.id);
    // Return to view mode
    setMode('view');
  };

  // CREATE MODE: Show form for new view
  if (mode === 'create') {
    return (
      <FieldLabel label={field.label || 'View Configuration'}>
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Create New View</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode('view')}
              className="h-6 text-xs"
            >
              Cancel
            </Button>
          </div>
          <ViewConfigurationForm
            supportedViewTypes={field.supportedViewTypes}
            onSuccess={handleCreateSuccess}
            onCancel={() => setMode('view')}
          />
        </div>
      </FieldLabel>
    );
  }

  // EDIT MODE: Show form with selected view
  if (mode === 'edit' && selectedView) {
    return (
      <FieldLabel label={field.label || 'View Configuration'}>
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">Edit: {selectedView.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode('view')}
              className="h-6 text-xs"
            >
              Cancel
            </Button>
          </div>
          <ViewConfigurationForm
            view={selectedView}
            supportedViewTypes={field.supportedViewTypes}
            onSuccess={handleEditSuccess}
            onCancel={() => setMode('view')}
          />
        </div>
      </FieldLabel>
    );
  }

  // VIEW MODE: Show selector + view details
  return (
    <FieldLabel label={field.label || 'View Configuration'}>
      <div className="space-y-2">
        {/* View Selector */}
        <Select
          value={value?.toString()}
          onValueChange={(val) => {
            const parsed = parseInt(val);
            if (!isNaN(parsed)) {
              onChange(parsed);
            }
          }}
          disabled={readOnly || loadingViews}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue
              placeholder={
                loadingViews
                  ? 'Loading...'
                  : views.length === 0
                  ? 'No views available'
                  : 'Select a view'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {views.map((view) => (
              <SelectItem key={view.id} value={view.id.toString()}>
                {view.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => setMode('create')}
            disabled={readOnly}
          >
            <Plus className="h-3 w-3 mr-1" />
            Create
          </Button>
          {selectedView && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setMode('edit')}
              disabled={readOnly}
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>

        {/* View Details */}
        {selectedView && <ViewDetailsDisplay view={selectedView} />}
      </div>
    </FieldLabel>
  );
}
