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
import { createView, updateView } from '@/app/actions/views';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ViewType } from '@/ddd/domain/views/value-objects/view-type';
import { ViewConfig } from '@/ddd/domain/views/value-objects/view-config';
import type { AggregationType, FormatType } from '@/ddd/domain/views/value-objects/aggregation-config';
import { ViewTypeSelector } from '@/app/(app)/apps/components/ViewTypeSelector';
import { MetricConfigurationSection } from '@/app/(app)/apps/components/MetricConfigurationSection';
import { GridConfigurationSection, type GridFilterConfig, type GridSortConfig, type GridFieldMapping } from '@/app/(app)/apps/components/GridConfigurationSection';
import { ChartConfigurationSection, type ChartConfigState } from '@/app/(app)/apps/components/ChartConfigurationSection';

interface ViewConfigurationFormProps {
  view?: ViewDTO;
  supportedViewTypes?: Array<'grid' | 'metric' | 'chart' | 'form'>;
  preSelectedTableId?: number;
  onSuccess?: (view: ViewDTO) => void;
  onCancel?: () => void;
}

export function ViewConfigurationForm({
  view,
  supportedViewTypes,
  preSelectedTableId,
  onSuccess,
  onCancel,
}: ViewConfigurationFormProps) {
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
  const [tableId, setTableId] = useState<number | undefined>(preSelectedTableId);
  const [viewType, setViewType] = useState<'grid' | 'metric' | 'chart' | 'form'>(
    supportedViewTypes?.[0] || 'grid'
  );

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
    loadTables();
  }, []);

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
      if (!preSelectedTableId) {
        setTableId(undefined);
      }
      setViewType(supportedViewTypes?.[0] || 'grid');
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
  }, [view, preSelectedTableId, supportedViewTypes]);

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
    e.stopPropagation(); // Prevent event bubbling

    // Prevent double submission
    if (isSubmitting) {
      console.log('[ViewConfigurationForm] Already submitting, ignoring');
      return;
    }

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
        case 'form':
          // Create form with all table fields by default
          // AIDEV-NOTE: This creates a working form immediately with all fields.
          // Users can later customize via form builder UI (to be implemented).
          viewTypeVO = ViewType.form();
          viewConfigVO = ViewConfig.createForm({
            pages: [
              {
                id: crypto.randomUUID(),
                title: 'Form',
                description: undefined,
                order: 0,
                fields: fields.map((field, index) => ({
                  fieldId: field.id,
                  order: index,
                  label: field.name,
                  helpText: undefined,
                  placeholder: undefined,
                  required: field.required || false,
                  visible: true,
                })),
              },
            ],
            submitButtonText: 'Submit',
            successMessage: 'Form submitted successfully!',
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

      if (onSuccess && result.data) {
        onSuccess(result.data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if view type selector should be shown
  const showViewTypeSelector = !isEditMode && (!supportedViewTypes || supportedViewTypes.length > 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Accordion type="multiple" defaultValue={["basic", "config"]} className="w-full space-y-2">
        {/* Basic Info Section */}
        <AccordionItem value="basic" className="border rounded-md px-3">
          <AccordionTrigger className="text-sm py-2 hover:no-underline">
            Basic Info
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            {/* Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Active Customers"
                disabled={isSubmitting}
                className="h-8 text-sm"
              />
            </div>

            {/* Description Field */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this view..."
                rows={2}
                disabled={isSubmitting}
                className="text-sm"
              />
            </div>

            {/* Table Selection (only for new views without pre-selected table) */}
            {!isEditMode && !preSelectedTableId && (
              <div className="space-y-1.5">
                <Label htmlFor="table" className="text-xs">
                  Table <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={tableId?.toString()}
                  onValueChange={(value) => setTableId(parseInt(value))}
                  disabled={isSubmitting || loadingTables}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={loadingTables ? "Loading..." : "Select table"} />
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

            {/* Show current table in edit mode or when pre-selected */}
            {((isEditMode && view) || preSelectedTableId) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Table</Label>
                <div className="text-xs text-muted-foreground">
                  {preSelectedTableId
                    ? tables.find(t => t.id === preSelectedTableId)?.name || `Table ID: ${preSelectedTableId}`
                    : view && (tables.find(t => t.id === view.tableId)?.name || `Table ID: ${view.tableId}`)
                  }
                </div>
              </div>
            )}

            {/* Show current view type in edit mode */}
            {isEditMode && view && (
              <div className="space-y-1.5">
                <Label className="text-xs">View Type</Label>
                <div>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {view.viewType.replace(/-/g, ' ')}
                  </Badge>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* View Type Selection (only for new views when multiple types supported) */}
        {showViewTypeSelector && (
          <AccordionItem value="type" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              View Type
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <ViewTypeSelector
                value={viewType}
                onChange={setViewType}
                disabled={isSubmitting}
                supportedTypes={supportedViewTypes}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Configuration Section */}
        {tableId && (
          <AccordionItem value="config" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              Configuration
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-3">
              {/* Metric Configuration */}
              {viewType === 'metric' && (
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
              {viewType === 'grid' && (
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
              {viewType === 'chart' && (
                <ChartConfigurationSection
                  fields={fields}
                  loadingFields={loadingFields}
                  config={chartConfig}
                  onConfigChange={setChartConfig}
                  isSubmitting={isSubmitting}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-2 rounded-md text-xs">
          {error}
        </div>
      )}

      {/* Action Buttons - Stack Vertically */}
      <div className="flex flex-col gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting} className="w-full h-8 text-sm">
          {isSubmitting && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
          {isEditMode ? 'Save Changes' : 'Create View'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full h-8 text-sm"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
