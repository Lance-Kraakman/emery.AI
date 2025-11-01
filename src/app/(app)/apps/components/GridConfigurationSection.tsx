'use client';

import React from 'react';
import { Plus, X, ArrowUp, ArrowDown, ChevronsUpDown, Filter as FilterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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

/**
 * Field mapping configuration for Grid views
 * Controls column visibility and order
 */
export interface GridFieldMapping {
  sourceFieldId: number;
  displayName: string;
  visible: boolean;
  order: number;
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

  // Field mappings (column visibility/order)
  fieldMappings: GridFieldMapping[];
  onFieldMappingsChange: (mappings: GridFieldMapping[]) => void;

  // Pagination
  defaultPageSize: number;
  onDefaultPageSizeChange: (size: number) => void;

  isSubmitting?: boolean;
}

/**
 * Get field type badge variant
 */
function getFieldTypeBadgeVariant(type: string): 'default' | 'secondary' | 'outline' {
  const typeMap: Record<string, 'default' | 'secondary' | 'outline'> = {
    text: 'secondary',
    number: 'outline',
    boolean: 'default',
    date: 'outline',
  };
  return typeMap[type] || 'secondary';
}

export function GridConfigurationSection({
  fields,
  loadingFields,
  filters,
  onFiltersChange,
  sorting,
  onSortingChange,
  fieldMappings,
  onFieldMappingsChange,
  defaultPageSize,
  onDefaultPageSizeChange,
  isSubmitting = false,
}: GridConfigurationSectionProps) {
  // Track filter editor state
  const [isAddingFilter, setIsAddingFilter] = React.useState(false);
  const [editingFilterIndex, setEditingFilterIndex] = React.useState<number | null>(null);
  const [newFilterField, setNewFilterField] = React.useState<string>('');
  const [newFilterOperator, setNewFilterOperator] = React.useState<FilterOperator>('eq');
  const [newFilterValue, setNewFilterValue] = React.useState<string>('');

  // Get sort info for a field
  const getSortForField = (fieldId: number) => {
    return sorting.find(s => s.fieldId === fieldId);
  };

  // Get field mapping for a field
  const getFieldMapping = (fieldId: number) => {
    return fieldMappings.find(fm => fm.sourceFieldId === fieldId);
  };

  // Toggle field visibility
  const handleToggleFieldVisibility = (fieldId: number) => {
    const existingMapping = getFieldMapping(fieldId);
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    if (existingMapping) {
      // Toggle visibility
      onFieldMappingsChange(
        fieldMappings.map(fm =>
          fm.sourceFieldId === fieldId ? { ...fm, visible: !fm.visible } : fm
        )
      );
    } else {
      // Add new mapping (visible by default when explicitly set)
      onFieldMappingsChange([
        ...fieldMappings,
        {
          sourceFieldId: fieldId,
          displayName: field.name,
          visible: false, // User is toggling it, so set to false (hiding it)
          order: fieldMappings.length,
        },
      ]);
    }
  };

  // Check if field is visible
  const isFieldVisible = (fieldId: number) => {
    const mapping = getFieldMapping(fieldId);
    // Default to visible if no mapping exists
    return mapping ? mapping.visible : true;
  };;

  // Toggle sort for a field
  const handleToggleSort = (fieldId: number) => {
    const existingSort = getSortForField(fieldId);

    if (!existingSort) {
      // Add new sort
      onSortingChange([
        ...sorting,
        { fieldId, direction: 'asc', priority: sorting.length },
      ]);
    } else if (existingSort.direction === 'asc') {
      // Change to desc
      onSortingChange(
        sorting.map(s => s.fieldId === fieldId ? { ...s, direction: 'desc' } : s)
      );
    } else {
      // Remove sort
      const newSorting = sorting
        .filter(s => s.fieldId !== fieldId)
        .map((s, index) => ({ ...s, priority: index }));
      onSortingChange(newSorting);
    }
  };

  // Start adding a new filter
  const handleStartAddFilter = () => {
    if (fields.length === 0) return;
    const firstField = fields[0];
    const fieldType = (firstField.type as FieldType) || 'text';
    const defaultOp = OPERATORS_BY_FIELD_TYPE[fieldType][0]?.value || 'eq';

    setNewFilterField(firstField.name);
    setNewFilterOperator(defaultOp);
    setNewFilterValue('');
    setIsAddingFilter(true);
    setEditingFilterIndex(null);
  };

  // Start editing existing filter
  const handleStartEditFilter = (index: number) => {
    const filter = filters[index];
    setNewFilterField(filter.field);
    setNewFilterOperator(filter.operator);
    setNewFilterValue(String(filter.value || ''));
    setEditingFilterIndex(index);
    setIsAddingFilter(false);
  };

  // Update operator when field changes
  const handleFilterFieldChange = (fieldName: string) => {
    setNewFilterField(fieldName);
    const field = fields.find(f => f.name === fieldName);
    const fieldType = (field?.type as FieldType) || 'text';
    const defaultOp = OPERATORS_BY_FIELD_TYPE[fieldType][0]?.value || 'eq';
    setNewFilterOperator(defaultOp);
    setNewFilterValue('');
  };

  // Save filter (add or update)
  const handleSaveFilter = () => {
    const field = fields.find(f => f.name === newFilterField);
    if (!field) return;

    const fieldType = (field.type as FieldType) || 'text';
    const needsValue = operatorNeedsValue(newFilterOperator);

    if (needsValue && !newFilterValue) {
      return; // Don't save if value is required but missing
    }

    let processedValue: any = newFilterValue;

    if (needsValue) {
      if (fieldType === 'number') {
        processedValue = parseFloat(newFilterValue);
        if (isNaN(processedValue)) return;
      } else if (fieldType === 'boolean') {
        processedValue = newFilterValue === 'true';
      }
    } else {
      processedValue = null;
    }

    const newFilter: GridFilterConfig = {
      field: newFilterField,
      operator: newFilterOperator,
      value: processedValue,
    };

    if (editingFilterIndex !== null) {
      // Update existing filter
      const newFilters = [...filters];
      newFilters[editingFilterIndex] = newFilter;
      onFiltersChange(newFilters);
    } else {
      // Add new filter
      onFiltersChange([...filters, newFilter]);
    }

    handleCancelFilterEdit();
  };

  // Remove filter
  const handleRemoveFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index));
    if (editingFilterIndex === index) {
      handleCancelFilterEdit();
    }
  };

  // Cancel filter edit
  const handleCancelFilterEdit = () => {
    setIsAddingFilter(false);
    setEditingFilterIndex(null);
    setNewFilterField('');
    setNewFilterOperator('eq');
    setNewFilterValue('');
  };

  // Format filter label for display
  const formatFilterLabel = (filter: GridFilterConfig) => {
    const operatorLabel = getOperatorLabel(filter.operator);
    const needsValue = operatorNeedsValue(filter.operator);

    if (needsValue && filter.value !== null && filter.value !== undefined) {
      return `${filter.field} ${operatorLabel} ${filter.value}`;
    }
    return `${filter.field} ${operatorLabel}`;
  };

  if (loadingFields) {
    return <div className="text-sm text-muted-foreground">Loading fields...</div>;
  }

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Grid View Configuration</Label>
        <p className="text-xs text-muted-foreground">
          Configure which fields to show, how to filter and sort
        </p>
      </div>

      {/* Fields Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-xs">
              <th className="text-center px-3 py-2 font-medium w-16">Visible</th>
              <th className="text-left px-3 py-2 font-medium">Field</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-center px-3 py-2 font-medium w-20">Sort</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const sortInfo = getSortForField(field.id);

              return (
                <tr key={field.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={isFieldVisible(field.id)}
                      onCheckedChange={() => handleToggleFieldVisibility(field.id)}
                      disabled={isSubmitting}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-sm font-medium">{field.name}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={getFieldTypeBadgeVariant(field.type)} className="text-xs">
                      {field.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleToggleSort(field.id);
                      }}
                      disabled={isSubmitting}
                    >
                      {!sortInfo && <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      {sortInfo?.direction === 'asc' && (
                        <div className="flex items-center gap-0.5">
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                          {sorting.length > 1 && (
                            <span className="text-[10px] font-medium text-primary">
                              {sortInfo.priority + 1}
                            </span>
                          )}
                        </div>
                      )}
                      {sortInfo?.direction === 'desc' && (
                        <div className="flex items-center gap-0.5">
                          <ArrowDown className="h-3.5 w-3.5 text-primary" />
                          {sorting.length > 1 && (
                            <span className="text-[10px] font-medium text-primary">
                              {sortInfo.priority + 1}
                            </span>
                          )}
                        </div>
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Filters Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Filters</Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={handleStartAddFilter}
            disabled={isSubmitting || isAddingFilter || editingFilterIndex !== null}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Filter
          </Button>
        </div>

        {/* Horizontal Filter Chips */}
        {filters.length > 0 || isAddingFilter || editingFilterIndex !== null ? (
          <div className="border rounded-lg p-2 min-h-[40px] flex flex-wrap items-center gap-2">
            {filters.map((filter, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="h-7 px-2 py-1 text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={() => handleStartEditFilter(index)}
              >
                <FilterIcon className="h-3 w-3 mr-1" />
                {formatFilterLabel(filter)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFilter(index);
                  }}
                  disabled={isSubmitting}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}

            {/* Filter Editor (inline when adding/editing) */}
            {(isAddingFilter || editingFilterIndex !== null) && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded border border-primary/20">
                <Select
                  value={newFilterField}
                  onValueChange={handleFilterFieldChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map(field => (
                      <SelectItem key={field.id} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={newFilterOperator}
                  onValueChange={(value) => setNewFilterOperator(value as FilterOperator)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const field = fields.find(f => f.name === newFilterField);
                      const fieldType = (field?.type as FieldType) || 'text';
                      return OPERATORS_BY_FIELD_TYPE[fieldType].map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>

                {operatorNeedsValue(newFilterOperator) && (() => {
                  const field = fields.find(f => f.name === newFilterField);
                  const fieldType = (field?.type as FieldType) || 'text';

                  return fieldType === 'boolean' ? (
                    <Select
                      value={newFilterValue}
                      onValueChange={setNewFilterValue}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue placeholder="Value" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                      value={newFilterValue}
                      onChange={(e) => setNewFilterValue(e.target.value)}
                      placeholder="Value..."
                      className="h-7 w-32 text-xs"
                      disabled={isSubmitting}
                    />
                  );
                })()}

                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleSaveFilter}
                    disabled={isSubmitting || (operatorNeedsValue(newFilterOperator) && !newFilterValue)}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={handleCancelFilterEdit}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">No filters applied</p>
          </div>
        )}
      </div>

      {/* Page Size Configuration */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Display Settings</Label>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="pageSize" className="text-xs text-muted-foreground whitespace-nowrap">
              Default rows per page:
            </Label>
            <Select
              value={defaultPageSize.toString()}
              onValueChange={(value) => onDefaultPageSizeChange(parseInt(value))}
              disabled={isSubmitting}
            >
              <SelectTrigger id="pageSize" className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div>
          <span className="font-medium">{fieldMappings.filter(fm => !fm.visible).length}</span> hidden column{fieldMappings.filter(fm => !fm.visible).length !== 1 ? 's' : ''}
        </div>
        <div>
          <span className="font-medium">{sorting.length}</span> sort rule{sorting.length !== 1 ? 's' : ''}
        </div>
        <div>
          <span className="font-medium">{filters.length}</span> filter{filters.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
