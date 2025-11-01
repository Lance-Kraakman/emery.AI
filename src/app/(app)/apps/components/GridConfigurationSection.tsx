'use client';

import React from 'react';
import { Plus, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import {
  type FilterOperator,
  type FieldType,
  OPERATORS_BY_FIELD_TYPE,
  operatorNeedsValue,
  getOperatorLabel
} from '@/lib/types/filters';

/**
 * Filter configuration for Grid views
 * Matches the structure used in FilterConfig but uses field names
 */
export interface GridFilterConfig {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | null;
}

/**
 * Sort configuration for Grid views
 * Uses field ID and direction with priority
 */
export interface GridSortConfig {
  fieldId: number;
  direction: 'asc' | 'desc';
  priority: number;
}

interface GridConfigurationSectionProps {
  fields: FieldDTO[];
  loadingFields: boolean;

  // Filter configuration
  filters: GridFilterConfig[];
  onFiltersChange: (filters: GridFilterConfig[]) => void;

  // Sort configuration
  sorting: GridSortConfig[];
  onSortingChange: (sorting: GridSortConfig[]) => void;

  isSubmitting?: boolean;
}

export function GridConfigurationSection({
  fields,
  loadingFields,
  filters,
  onFiltersChange,
  sorting,
  onSortingChange,
  isSubmitting = false,
}: GridConfigurationSectionProps) {
  // Filter state
  const [newFilterField, setNewFilterField] = React.useState<string>('');
  const [newFilterOperator, setNewFilterOperator] = React.useState<FilterOperator>('eq');
  const [newFilterValue, setNewFilterValue] = React.useState<string>('');

  // Sort state
  const [newSortFieldId, setNewSortFieldId] = React.useState<number | undefined>();

  const selectedFilterField = fields.find(f => f.name === newFilterField);
  const filterFieldType = (selectedFilterField?.type as FieldType) || 'text';
  const availableFilterOperators = OPERATORS_BY_FIELD_TYPE[filterFieldType];

  // Reset operator when filter field changes
  React.useEffect(() => {
    if (newFilterField && !availableFilterOperators.find(op => op.value === newFilterOperator)) {
      setNewFilterOperator(availableFilterOperators[0]?.value || 'eq');
    }
  }, [newFilterField, availableFilterOperators, newFilterOperator]);

  const needsFilterValue = operatorNeedsValue(newFilterOperator);

  // Add filter
  const handleAddFilter = () => {
    if (!newFilterField) return;
    if (needsFilterValue && !newFilterValue) return;

    let processedValue: any = newFilterValue;

    // Type conversion
    if (needsFilterValue) {
      if (filterFieldType === 'number') {
        processedValue = parseFloat(newFilterValue);
        if (isNaN(processedValue)) return;
      } else if (filterFieldType === 'boolean') {
        processedValue = newFilterValue === 'true';
      } else if (filterFieldType === 'date') {
        processedValue = newFilterValue;
      }
    } else {
      processedValue = null;
    }

    onFiltersChange([
      ...filters,
      {
        field: newFilterField,
        operator: newFilterOperator,
        value: processedValue,
      },
    ]);

    // Reset form
    setNewFilterField('');
    setNewFilterOperator('eq');
    setNewFilterValue('');
  };

  // Remove filter
  const handleRemoveFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
  };

  // Add sort
  const handleAddSort = () => {
    if (!newSortFieldId) return;

    // Check if field already has sorting
    if (sorting.find(s => s.fieldId === newSortFieldId)) {
      return;
    }

    onSortingChange([
      ...sorting,
      {
        fieldId: newSortFieldId,
        direction: 'asc',
        priority: sorting.length,
      },
    ]);

    setNewSortFieldId(undefined);
  };

  // Remove sort
  const handleRemoveSort = (fieldId: number) => {
    const newSorting = sorting
      .filter(s => s.fieldId !== fieldId)
      .map((s, index) => ({ ...s, priority: index })); // Re-index priorities
    onSortingChange(newSorting);
  };

  // Toggle sort direction
  const handleToggleSortDirection = (fieldId: number) => {
    onSortingChange(
      sorting.map(s =>
        s.fieldId === fieldId
          ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
          : s
      )
    );
  };

  // Move sort up/down in priority
  const handleMoveSortPriority = (fieldId: number, direction: 'up' | 'down') => {
    const currentIndex = sorting.findIndex(s => s.fieldId === fieldId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sorting.length) return;

    const newSorting = [...sorting];
    [newSorting[currentIndex], newSorting[newIndex]] = [newSorting[newIndex], newSorting[currentIndex]];

    // Update priorities
    onSortingChange(newSorting.map((s, index) => ({ ...s, priority: index })));
  };

  const formatFilterValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  if (loadingFields) {
    return <div className="text-sm text-muted-foreground">Loading fields...</div>;
  }

  return (
    <div className="space-y-6 border-t pt-4 mt-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Grid View Configuration</Label>
        <p className="text-xs text-muted-foreground">
          Configure which data to display and how to sort it
        </p>
      </div>

      {/* Filters Section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Filters</Label>

        {/* Add Filter Form */}
        <div className="space-y-2 p-3 bg-secondary/20 rounded-md">
          <Label className="text-xs text-muted-foreground">Add Filter</Label>

          {/* Field Selector */}
          <Select value={newFilterField} onValueChange={setNewFilterField} disabled={isSubmitting}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select field..." />
            </SelectTrigger>
            <SelectContent>
              {fields.map(field => (
                <SelectItem key={field.id} value={field.name}>
                  <span className="font-medium">{field.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({field.type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator & Value Row */}
          {newFilterField && (
            <div className="flex gap-2">
              <Select
                value={newFilterOperator}
                onValueChange={(value) => setNewFilterOperator(value as FilterOperator)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableFilterOperators.map(op => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {needsFilterValue && (
                <>
                  {filterFieldType === 'boolean' ? (
                    <Select value={newFilterValue} onValueChange={setNewFilterValue} disabled={isSubmitting}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Value..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={filterFieldType === 'number' ? 'number' : filterFieldType === 'date' ? 'date' : 'text'}
                      value={newFilterValue}
                      onChange={(e) => setNewFilterValue(e.target.value)}
                      placeholder="Value..."
                      className="h-9 flex-1"
                      disabled={isSubmitting}
                    />
                  )}
                </>
              )}

              <Button
                size="sm"
                onClick={handleAddFilter}
                disabled={!newFilterField || (needsFilterValue && !newFilterValue) || isSubmitting}
                className="h-9"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Active Filters List */}
        {filters.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Active Filters ({filters.length})</Label>
            {filters.map((filter, index) => {
              const field = fields.find(f => f.name === filter.field);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between text-sm px-3 py-2 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                >
                  <span className="flex-1 truncate">
                    <span className="font-medium">{filter.field}</span>
                    <span className="text-muted-foreground mx-1.5">
                      {getOperatorLabel(filter.operator)}
                    </span>
                    {filter.operator !== 'is_null' && filter.operator !== 'is_not_null' && (
                      <span>{formatFilterValue(filter.value, field?.type || 'text')}</span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemoveFilter(index)}
                    disabled={isSubmitting}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-md">
            No filters configured. Add filters to control which rows are displayed.
          </p>
        )}
      </div>

      {/* Sorting Section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Sorting</Label>

        {/* Add Sort Form */}
        <div className="flex gap-2">
          <Select
            value={newSortFieldId?.toString()}
            onValueChange={(value) => setNewSortFieldId(parseInt(value))}
            disabled={isSubmitting}
          >
            <SelectTrigger className="h-9 flex-1">
              <SelectValue placeholder="Select field to sort..." />
            </SelectTrigger>
            <SelectContent>
              {fields
                .filter(field => !sorting.find(s => s.fieldId === field.id))
                .map(field => (
                  <SelectItem key={field.id} value={field.id.toString()}>
                    <span className="font-medium">{field.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({field.type})</span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={handleAddSort}
            disabled={!newSortFieldId || isSubmitting}
            className="h-9"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Sort
          </Button>
        </div>

        {/* Active Sorting List */}
        {sorting.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Sort Order ({sorting.length})</Label>
            {sorting.map((sort, index) => {
              const field = fields.find(f => f.id === sort.fieldId);
              return (
                <div
                  key={sort.fieldId}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => handleMoveSortPriority(sort.fieldId, 'up')}
                      disabled={index === 0 || isSubmitting}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => handleMoveSortPriority(sort.fieldId, 'down')}
                      disabled={index === sorting.length - 1 || isSubmitting}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <GripVertical className="h-4 w-4 text-muted-foreground" />

                  <span className="flex-1 font-medium text-sm">
                    {field?.name || `Field ID: ${sort.fieldId}`}
                  </span>

                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => !isSubmitting && handleToggleSortDirection(sort.fieldId)}
                  >
                    {sort.direction === 'asc' ? 'A → Z' : 'Z → A'}
                  </Badge>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemoveSort(sort.fieldId)}
                    disabled={isSubmitting}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4 bg-muted/20 rounded-md">
            No sorting configured. Data will be displayed in default order.
          </p>
        )}
      </div>
    </div>
  );
}
