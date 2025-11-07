'use client';

import React, { useState, useEffect } from 'react';
import type { ViewDTO } from '@/app/mappers/view-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createView, updateView } from '@/app/actions/views';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ViewType } from '@/ddd/domain/views/value-objects/view-type';
import { ViewConfig } from '@/ddd/domain/views/value-objects/view-config';
import type { AggregationType, FormatType } from '@/ddd/domain/views/value-objects/aggregation-config';
import { ViewTypeSelector } from './ViewTypeSelector';
import { MetricConfigurationSection } from './MetricConfigurationSection';
import { GridConfigurationSection, type GridFilterConfig, type GridSortConfig, type GridFieldMapping } from './GridConfigurationSection';
import { ChartConfigurationSection, type ChartConfigState } from './ChartConfigurationSection';

interface ViewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view?: ViewDTO;
  onSuccess?: () => void;
}

export function ViewFormDialog({ open, onOpenChange, view, onSuccess }: ViewFormDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tables, setTables] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const isEditMode = !!view;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tableId, setTableId] = useState<number | undefined>();
  const [viewType, setViewType] = useState<'grid' | 'metric' | 'chart' | 'form'>('grid');

  // Metric view configuration
  const [selectedFieldId, setSelectedFieldId] = useState<number | undefined>();
  const [aggregationType, setAggregationType] = useState<AggregationType>('sum');
  const [customLabel, setCustomLabel] = useState('');
  const [formatType, setFormatType] = useState<FormatType>('number');
  const [decimals, setDecimals] = useState(2);

  // Grid view configuration
  const [gridFilters, setGridFilters] = useState<GridFilterConfig[]>([]);
  const [gridSorting, setGridSorting] = useState<GridSortConfig[]>([]);
  const [gridFieldMappings, setGridFieldMappings] = useState<GridFieldMapping[]>([]);
  const [gridDefaultPageSize, setGridDefaultPageSize] = useState<number>(50);

  // Chart view configuration
  const [chartConfig, setChartConfig] = useState<ChartConfigState>({
    chartType: 'bar',
    dataMode: 'raw',
    yAxisFieldIds: [],
    aggregations: [],
  });

  // Load tables on mount
  useEffect(() => {
    if (open) {
      loadTables();
    }
  }, [open]);

  // Load fields when table is selected
  useEffect(() => {
    if (tableId) {
      loadFields(tableId);
    }
  }, [tableId]);

  // Convert view filters from fieldId to field names once fields are loaded
  useEffect(() => {
    if (view && view.viewType === 'grid' && fields.length > 0 && gridFilters.length === 0) {
      // Create a map of fieldId -> fieldName
      const fieldIdToNameMap = new Map(fields.map(f => [f.id, f.name]));

      // Convert filters
      const filterConfigs = view.filters.map(f => ({
        field: fieldIdToNameMap.get(f.fieldId) || '',
        operator: f.operator as any,
        value: f.value ?? null, // Convert undefined to null
      })).filter(f => f.field !== ''); // Remove filters for fields that no longer exist

      setGridFilters(filterConfigs);
    }
  }, [view, fields, gridFilters.length]);

  // Reset form when view changes
  useEffect(() => {
    if (view) {
      setName(view.name);
      setDescription(view.description || '');
      setTableId(view.tableId);
      setViewType(view.viewType);

      // Load metric configuration if it's a metric view
      if (view.viewType === 'metric' && view.viewConfig.type === 'metric') {
        const metricConfig = view.viewConfig as any;
        if (metricConfig.aggregation) {
          setSelectedFieldId(metricConfig.aggregation.fieldId);
          setAggregationType(metricConfig.aggregation.aggregationType);
          setCustomLabel(metricConfig.aggregation.label || '');
          setFormatType(metricConfig.aggregation.formatType || 'number');
          setDecimals(metricConfig.aggregation.decimals || 2);
        }
      }

      // Load grid configuration if it's a grid view
      if (view.viewType === 'grid') {
        // Load filters - convert fieldId to field name
        // We'll need to wait for fields to load first
        setGridFilters([]); // Will be populated after fields load

        // Load sorting
        setGridSorting(view.sorting);

        // Load field mappings
        if (view.fieldMappings) {
          setGridFieldMappings(view.fieldMappings);
        } else {
          setGridFieldMappings([]);
        }

        // Load page size from view config
        const gridConfig = view.viewConfig as any;
        if (gridConfig.defaultPageSize) {
          setGridDefaultPageSize(gridConfig.defaultPageSize);
        } else {
          setGridDefaultPageSize(50);
        }
      }

      // Load chart configuration if it's a chart view
      if (view.viewType === 'chart' && view.viewConfig.type === 'chart') {
        const chartConfigData = view.viewConfig as any;
        setChartConfig({
          chartType: chartConfigData.chartType || 'bar',
          dataMode: chartConfigData.dataMode || 'raw',
          xAxisFieldId: chartConfigData.xAxisFieldId,
          yAxisFieldIds: chartConfigData.yAxisFieldIds || [],
          groupByFieldId: chartConfigData.groupByFieldId,
          aggregations: chartConfigData.aggregations || [],
          maxDataPoints: chartConfigData.maxDataPoints,
          sortBy: chartConfigData.sortBy,
          sortDirection: chartConfigData.sortDirection,
        });
      }
    } else {
      setName('');
      setDescription('');
      setTableId(undefined);
      setViewType('grid');
      setSelectedFieldId(undefined);
      setAggregationType('sum');
      setCustomLabel('');
      setFormatType('number');
      setDecimals(2);
      setGridFilters([]);
      setGridSorting([]);
      setGridFieldMappings([]);
      setGridDefaultPageSize(50);
      setChartConfig({
        chartType: 'bar',
        dataMode: 'raw',
        yAxisFieldIds: [],
        aggregations: [],
      });
    }
  }, [view]);

  const loadTables = async () => {
    try {
      setLoadingTables(true);
      const tablesData = await getTables();
      setTables(tablesData);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.error('Failed to load tables');
    } finally {
      setLoadingTables(false);
    }
  };

  const loadFields = async (selectedTableId: number) => {
    try {
      setLoadingFields(true);
      const fieldsData = await getFields(selectedTableId);
      setFields(fieldsData);
    } catch (error) {
      console.error('Error loading fields:', error);
      toast.error('Failed to load fields');
    } finally {
      setLoadingFields(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!tableId) {
      setError('Table selection is required');
      return;
    }

    // Validate metric view configuration
    if (viewType === 'metric') {
      if (!selectedFieldId) {
        setError('Field selection is required for metric views');
        return;
      }
    }

    // Validate chart view configuration
    if (viewType === 'chart') {
      if (chartConfig.dataMode === 'raw') {
        if (!chartConfig.xAxisFieldId || chartConfig.yAxisFieldIds.length === 0) {
          setError('Chart view in raw mode requires X axis and at least one Y axis field');
          return;
        }
      } else if (chartConfig.dataMode === 'aggregated') {
        if (!chartConfig.groupByFieldId || chartConfig.aggregations.length === 0) {
          setError('Chart view in aggregated mode requires Group By field and at least one aggregation');
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Build viewType and viewConfig based on selected type
      let viewTypeVO: ViewType;
      let viewConfigVO: ViewConfig;

      switch (viewType) {
        case 'metric':
          viewTypeVO = ViewType.metric();
          viewConfigVO = ViewConfig.createMetric({
            aggregation: {
              fieldId: selectedFieldId!,
              aggregationType,
              label: customLabel || undefined,
              formatType,
              decimals,
            },
          });
          break;
        case 'chart':
          viewTypeVO = ViewType.chart();
          viewConfigVO = ViewConfig.createChart({
            chartType: chartConfig.chartType,
            dataMode: chartConfig.dataMode,
            xAxisFieldId: chartConfig.xAxisFieldId,
            yAxisFieldIds: chartConfig.yAxisFieldIds,
            groupByFieldId: chartConfig.groupByFieldId,
            aggregations: chartConfig.aggregations,
            maxDataPoints: chartConfig.maxDataPoints,
            sortBy: chartConfig.sortBy,
            sortDirection: chartConfig.sortDirection,
          });
          break;
        case 'grid':
        default:
          viewTypeVO = ViewType.grid();
          viewConfigVO = ViewConfig.createGrid({
            defaultPageSize: gridDefaultPageSize,
          });
          break;
      }

      const result = isEditMode
        ? await updateView({
            id: view!.id,
            name: name.trim(),
            description: description.trim() || undefined,
            filters: viewType === 'grid' ? gridFilters : undefined,
            sorting: viewType === 'grid' ? gridSorting : undefined,
            fieldMappings: viewType === 'grid' && gridFieldMappings.length > 0 ? gridFieldMappings : undefined,
            pagination: viewType === 'grid' ? { pageSize: gridDefaultPageSize } : undefined,
          })
        : await createView({
            tableId,
            name: name.trim(),
            description: description.trim() || undefined,
            filters: viewType === 'grid' ? gridFilters : undefined,
            sorting: viewType === 'grid' ? gridSorting : undefined,
            fieldMappings: viewType === 'grid' && gridFieldMappings.length > 0 ? gridFieldMappings : undefined,
            viewType: viewTypeVO,
            viewConfig: viewConfigVO,
          });

      if (!result.success) {
        setError(result.error || 'Failed to save view');
        toast.error(result.error || "Failed to save view");
        return;
      }

      toast.success(isEditMode ? "View updated successfully" : "View created successfully");

      if (onSuccess) {
        onSuccess();
      }

      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit View' : 'Create View'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the view name and description. To change view type or configuration, create a new view.'
              : 'Create a view with filters and sorting. Select the view type and configure settings below.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[60vh]">
            <div className="pr-4">
              <div className="space-y-4 p-1">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Active Customers"
                  disabled={isSubmitting}
                />
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this view shows..."
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>

              {/* Table Selection (only for new views) */}
              {!isEditMode && (
                <div className="space-y-2">
                  <Label htmlFor="table">
                    Table <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={tableId?.toString()}
                    onValueChange={(value) => setTableId(parseInt(value))}
                    disabled={isSubmitting || loadingTables}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingTables ? "Loading tables..." : "Select a table"} />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id.toString()}>
                          {table.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show current table in edit mode */}
              {isEditMode && view && (
                <div className="space-y-2">
                  <Label>Table</Label>
                  <div className="text-sm text-muted-foreground">
                    Table ID: {view.tableId}
                  </div>
                </div>
              )}

              {/* Show current view type in edit mode */}
              {isEditMode && view && (
                <div className="space-y-2">
                  <Label>View Type</Label>
                  <div>
                    <Badge variant="secondary" className="capitalize">
                      {view.viewType.replace(/-/g, ' ')}
                    </Badge>
                  </div>
                </div>
              )}

              {/* View Type Selection (only for new views) */}
              {!isEditMode && (
                <>
                  <div className="border-t pt-4 mt-4" />
                  <ViewTypeSelector
                    value={viewType}
                    onChange={setViewType}
                    disabled={isSubmitting}
                  />
                </>
              )}

              {/* Metric Configuration */}
              {viewType === 'metric' && tableId && (
                <MetricConfigurationSection
                  fields={fields}
                  loadingFields={loadingFields}
                  selectedFieldId={selectedFieldId}
                  onFieldChange={setSelectedFieldId}
                  aggregationType={aggregationType}
                  onAggregationTypeChange={setAggregationType}
                  customLabel={customLabel}
                  onCustomLabelChange={setCustomLabel}
                  formatType={formatType}
                  onFormatTypeChange={setFormatType}
                  decimals={decimals}
                  onDecimalsChange={setDecimals}
                  isSubmitting={isSubmitting}
                />
              )}

              {/* Grid Configuration */}
              {viewType === 'grid' && tableId && (
                <GridConfigurationSection
                  fields={fields}
                  loadingFields={loadingFields}
                  filters={gridFilters}
                  onFiltersChange={setGridFilters}
                  sorting={gridSorting}
                  onSortingChange={setGridSorting}
                  fieldMappings={gridFieldMappings}
                  onFieldMappingsChange={setGridFieldMappings}
                  defaultPageSize={gridDefaultPageSize}
                  onDefaultPageSizeChange={setGridDefaultPageSize}
                  isSubmitting={isSubmitting}
                />
              )}

              {/* Chart Configuration */}
              {viewType === 'chart' && tableId && (
                <ChartConfigurationSection
                  fields={fields}
                  loadingFields={loadingFields}
                  config={chartConfig}
                  onConfigChange={setChartConfig}
                  isSubmitting={isSubmitting}
                />
              )}

              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create View'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
