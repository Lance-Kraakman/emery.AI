'use client';

import React from 'react';
import { Plus, ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { type FilterOperator, type FieldType } from '@/lib/types/filters';
import { FilterPopover } from '@/app/(app)/data/components/FilterPopover';
import { FilterChip } from '@/app/(app)/data/components/FilterChip';

/**
 * Filter configuration for Grid views
 * Matches the structure used in FilterConfig but uses field names
 */
export interface GridFilterConfig {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | null | Array<string | number | null>;
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

      {/* Filters Section - Using Data Grid Components */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Filters</Label>
          <FilterPopover
            trigger={
              <Button variant="outline" size="sm" className="h-7">
                <Plus className="h-3.5 w-3.5 mr-1" />
                {filters.length > 0 ? `Filters (${filters.length})` : 'Add Filter'}
              </Button>
            }
            fields={fields}
            activeFilters={filters}
            onAddFilter={(filter) => onFiltersChange([...filters, filter as GridFilterConfig])}
            onRemoveFilter={(index) => onFiltersChange(filters.filter((_, i) => i !== index))}
          />
        </div>

        {/* Filter Chips Display */}
        {filters.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {filters.map((filter, index) => (
              <FilterChip
                key={index}
                filter={filter}
                onRemove={() => onFiltersChange(filters.filter((_, i) => i !== index))}
              />
            ))}
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
