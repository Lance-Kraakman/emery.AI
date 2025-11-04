'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { AggregationType } from '@/ddd/domain/views/value-objects/aggregation-config';

export interface ChartConfigState {
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  dataMode: 'raw' | 'aggregated';

  // Raw mode
  xAxisFieldId?: number;
  yAxisFieldIds: number[];

  // Aggregated mode
  groupByFieldId?: number;
  aggregations: Array<{
    fieldId: number;
    aggregationType: AggregationType;
    label?: string;
  }>;

  // Options
  maxDataPoints?: number;
  sortBy?: 'x' | 'y';
  sortDirection?: 'asc' | 'desc';
}

interface ChartConfigurationSectionProps {
  fields: FieldDTO[];
  loadingFields: boolean;
  config: ChartConfigState;
  onConfigChange: (config: ChartConfigState) => void;
  isSubmitting?: boolean;
}

export function ChartConfigurationSection({
  fields,
  loadingFields,
  config,
  onConfigChange,
  isSubmitting = false,
}: ChartConfigurationSectionProps) {

  const handleChartTypeChange = (chartType: ChartConfigState['chartType']) => {
    onConfigChange({ ...config, chartType });
  };

  const handleDataModeChange = (dataMode: ChartConfigState['dataMode']) => {
    onConfigChange({ ...config, dataMode });
  };

  const handleXAxisChange = (fieldId: number) => {
    onConfigChange({ ...config, xAxisFieldId: fieldId });
  };

  const handleAddYAxis = (fieldId: number) => {
    onConfigChange({
      ...config,
      yAxisFieldIds: [...config.yAxisFieldIds, fieldId],
    });
  };

  const handleRemoveYAxis = (index: number) => {
    onConfigChange({
      ...config,
      yAxisFieldIds: config.yAxisFieldIds.filter((_, i) => i !== index),
    });
  };

  const handleGroupByChange = (fieldId: number) => {
    onConfigChange({ ...config, groupByFieldId: fieldId });
  };

  const handleAddAggregation = () => {
    if (fields.length === 0) return;
    const numericField = numericFields[0] || fields[0];
    onConfigChange({
      ...config,
      aggregations: [
        ...config.aggregations,
        {
          fieldId: numericField.id,
          aggregationType: 'sum',
        },
      ],
    });
  };

  const handleRemoveAggregation = (index: number) => {
    onConfigChange({
      ...config,
      aggregations: config.aggregations.filter((_, i) => i !== index),
    });
  };

  const handleUpdateAggregation = (index: number, updates: Partial<ChartConfigState['aggregations'][0]>) => {
    const newAggs = [...config.aggregations];
    newAggs[index] = { ...newAggs[index], ...updates };
    onConfigChange({ ...config, aggregations: newAggs });
  };

  if (loadingFields) {
    return <div className="text-sm text-muted-foreground">Loading fields...</div>;
  }

  const numericFields = fields.filter(f => f.type === 'number');

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Chart Configuration</Label>
        <p className="text-xs text-muted-foreground">
          Configure chart type, data mode, and axes
        </p>
      </div>

      {/* Chart Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Chart Type</Label>
        <div className="flex gap-2">
          {(['bar', 'line', 'pie', 'area', 'scatter'] as const).map((type) => (
            <Button
              key={type}
              variant={config.chartType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleChartTypeChange(type)}
              disabled={isSubmitting}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Data Mode Toggle */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Data Mode</Label>
        <div className="flex gap-2">
          <Button
            variant={config.dataMode === 'raw' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleDataModeChange('raw')}
            disabled={isSubmitting}
          >
            Raw Data
          </Button>
          <Button
            variant={config.dataMode === 'aggregated' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleDataModeChange('aggregated')}
            disabled={isSubmitting}
          >
            Aggregated
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {config.dataMode === 'raw'
            ? 'Plot row data directly from the table'
            : 'Group and aggregate data (e.g., SUM sales by category)'}
        </p>
      </div>

      {/* Raw Mode Configuration */}
      {config.dataMode === 'raw' && (
        <div className="space-y-4 p-3 border rounded-lg bg-muted/30">
          {/* X Axis */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">X Axis Field</Label>
            <Select
              value={config.xAxisFieldId?.toString()}
              onValueChange={(val) => handleXAxisChange(parseInt(val))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select X axis field..." />
              </SelectTrigger>
              <SelectContent>
                {fields.map(field => (
                  <SelectItem key={field.id} value={field.id.toString()}>
                    {field.name} ({field.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Y Axis(es) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Y Axis Fields</Label>
              <Select onValueChange={(val) => handleAddYAxis(parseInt(val))}>
                <SelectTrigger className="w-[140px] h-7">
                  <SelectValue placeholder="Add Y axis..." />
                </SelectTrigger>
                <SelectContent>
                  {numericFields.map(field => (
                    <SelectItem key={field.id} value={field.id.toString()}>
                      {field.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {config.yAxisFieldIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {config.yAxisFieldIds.map((fieldId, index) => {
                  const field = fields.find(f => f.id === fieldId);
                  return (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {field?.name || `Field ${fieldId}`}
                      <button
                        onClick={() => handleRemoveYAxis(index)}
                        className="ml-1 hover:bg-destructive/10 rounded-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No Y axis fields selected</p>
            )}
          </div>
        </div>
      )}

      {/* Aggregated Mode Configuration */}
      {config.dataMode === 'aggregated' && (
        <div className="space-y-4 p-3 border rounded-lg bg-muted/30">
          {/* Group By */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Group By Field</Label>
            <Select
              value={config.groupByFieldId?.toString()}
              onValueChange={(val) => handleGroupByChange(parseInt(val))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select group by field..." />
              </SelectTrigger>
              <SelectContent>
                {fields.map(field => (
                  <SelectItem key={field.id} value={field.id.toString()}>
                    {field.name} ({field.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This field becomes the X axis (e.g., category, date)
            </p>
          </div>

          {/* Aggregations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Aggregations (Y Axis)</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={handleAddAggregation}
                disabled={isSubmitting}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

            {config.aggregations.length > 0 ? (
              <div className="space-y-2">
                {config.aggregations.map((agg, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Field</Label>
                      <Select
                        value={agg.fieldId.toString()}
                        onValueChange={(val) => handleUpdateAggregation(index, { fieldId: parseInt(val) })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {numericFields.map(field => (
                            <SelectItem key={field.id} value={field.id.toString()}>
                              {field.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Function</Label>
                      <Select
                        value={agg.aggregationType}
                        onValueChange={(val: AggregationType) => handleUpdateAggregation(index, { aggregationType: val })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum</SelectItem>
                          <SelectItem value="avg">Average</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                          <SelectItem value="min">Min</SelectItem>
                          <SelectItem value="max">Max</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleRemoveAggregation(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No aggregations configured</p>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-muted-foreground">
        {config.dataMode === 'raw' && (
          <span>
            Will plot {config.yAxisFieldIds.length} series on {config.chartType} chart
          </span>
        )}
        {config.dataMode === 'aggregated' && (
          <span>
            Will aggregate {config.aggregations.length} metric(s) grouped by {
              fields.find(f => f.id === config.groupByFieldId)?.name || 'field'
            }
          </span>
        )}
      </div>
    </div>
  );
}
