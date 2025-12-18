'use client';

/**
 * MultiSortField - Custom Puck field for DataBlock row sorting
 *
 * Provides multi-column sort configuration UI:
 * - Multiple sort conditions (add/remove/reorder)
 * - Field selector (from table fields)
 * - Direction toggle (ascending/descending)
 * - Optional dynamic sort from state container
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFields } from '@/app/actions/fields';
import { getView } from '@/app/actions/views';
import type { FieldDTO } from '@/app/mappers/field-mapper';

/**
 * A single sort condition
 */
export interface SortCondition {
  id: string;
  /** Field name to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Complete sort configuration
 */
export interface RowSortConfig {
  /** Static sort conditions */
  conditions: SortCondition[];
  /** Optional: Dynamic field from state (e.g., "filters.sortField") */
  dynamicField?: string;
  /** Optional: Dynamic direction from state (e.g., "filters.sortDirection") */
  dynamicDirection?: string;
}

/** Default empty sort configuration */
const DEFAULT_SORT_CONFIG: RowSortConfig = {
  conditions: [],
  dynamicField: undefined,
  dynamicDirection: undefined,
};

/** Create a new empty condition */
function createEmptyCondition(): SortCondition {
  return {
    id: crypto.randomUUID(),
    field: '',
    direction: 'asc',
  };
}

interface MultiSortFieldProps {
  value?: RowSortConfig;
  onChange: (value: RowSortConfig) => void;
  viewId?: number;
}

/**
 * MultiSortField - Configuration UI for row sorting
 */
export function MultiSortField({ value, onChange, viewId }: MultiSortFieldProps) {
  const config = value || DEFAULT_SORT_CONFIG;
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [showDynamic, setShowDynamic] = useState(
    Boolean(config.dynamicField || config.dynamicDirection)
  );

  // Load fields from view
  useEffect(() => {
    async function loadFields() {
      if (!viewId) {
        setFields([]);
        return;
      }

      setLoadingFields(true);
      try {
        // Get view to find table ID
        const view = await getView(viewId);
        if (!view?.tableId) {
          setFields([]);
          return;
        }

        // Get fields for the table
        const tableFields = await getFields(view.tableId);
        setFields(tableFields || []);
      } catch (error) {
        console.error('[MultiSortField] Failed to load fields:', error);
        setFields([]);
      } finally {
        setLoadingFields(false);
      }
    }

    loadFields();
  }, [viewId]);

  // Field options for dropdown
  const fieldOptions = useMemo(() => {
    return fields.map(f => ({
      value: f.name,
      label: f.name,
    }));
  }, [fields]);

  // Add a new condition
  const handleAddCondition = useCallback(() => {
    onChange({
      ...config,
      conditions: [...config.conditions, createEmptyCondition()],
    });
  }, [config, onChange]);

  // Remove a condition
  const handleRemoveCondition = useCallback((id: string) => {
    onChange({
      ...config,
      conditions: config.conditions.filter(c => c.id !== id),
    });
  }, [config, onChange]);

  // Update a condition
  const handleUpdateCondition = useCallback((id: string, updates: Partial<SortCondition>) => {
    onChange({
      ...config,
      conditions: config.conditions.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
  }, [config, onChange]);

  // Update dynamic field
  const handleDynamicFieldChange = useCallback((field: string) => {
    onChange({
      ...config,
      dynamicField: field || undefined,
    });
  }, [config, onChange]);

  // Update dynamic direction
  const handleDynamicDirectionChange = useCallback((direction: string) => {
    onChange({
      ...config,
      dynamicDirection: direction || undefined,
    });
  }, [config, onChange]);

  // Toggle dynamic mode
  const handleToggleDynamic = useCallback(() => {
    if (showDynamic) {
      // Turning off - clear dynamic values
      onChange({
        ...config,
        dynamicField: undefined,
        dynamicDirection: undefined,
      });
    }
    setShowDynamic(!showDynamic);
  }, [showDynamic, config, onChange]);

  if (!viewId) {
    return (
      <div className="text-muted-foreground text-sm p-2">
        Select a view first to configure sorting.
      </div>
    );
  }

  if (loadingFields) {
    return (
      <div className="text-muted-foreground text-sm p-2">
        Loading fields...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Static Sort Conditions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Sort Columns</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddCondition}
            className="h-6 px-2 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>

        {config.conditions.length === 0 ? (
          <div className="text-muted-foreground text-xs p-2 text-center border border-dashed rounded">
            No sort columns. Click "Add" to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {config.conditions.map((condition, index) => (
              <SortConditionRow
                key={condition.id}
                condition={condition}
                index={index}
                fields={fieldOptions}
                onUpdate={(updates) => handleUpdateCondition(condition.id, updates)}
                onRemove={() => handleRemoveCondition(condition.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dynamic Sort Toggle */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-medium">Dynamic Sort (from State)</Label>
          <Button
            variant={showDynamic ? "secondary" : "ghost"}
            size="sm"
            onClick={handleToggleDynamic}
            className="h-6 px-2 text-xs"
          >
            {showDynamic ? "Enabled" : "Enable"}
          </Button>
        </div>

        {showDynamic && (
          <div className="space-y-2 pl-2 border-l-2">
            <div>
              <Label className="text-xs text-muted-foreground">
                Field (state path, e.g., "filters.sortField")
              </Label>
              <Input
                value={config.dynamicField || ''}
                onChange={(e) => handleDynamicFieldChange(e.target.value)}
                placeholder="container.key"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Direction (state path, e.g., "filters.sortDirection")
              </Label>
              <Input
                value={config.dynamicDirection || ''}
                onChange={(e) => handleDynamicDirectionChange(e.target.value)}
                placeholder="container.key"
                className="h-8 text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Dynamic sort overrides static columns when state values are set.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Single sort condition row
 */
function SortConditionRow({
  condition,
  index,
  fields,
  onUpdate,
  onRemove,
}: {
  condition: SortCondition;
  index: number;
  fields: { value: string; label: string }[];
  onUpdate: (updates: Partial<SortCondition>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded border">
      {/* Priority indicator */}
      <div className="flex items-center text-muted-foreground">
        <GripVertical className="h-3 w-3" />
        <span className="text-xs w-4">{index + 1}</span>
      </div>

      {/* Field selector */}
      <Select
        value={condition.field}
        onValueChange={(value) => onUpdate({ field: value })}
      >
        <SelectTrigger className="h-8 flex-1 text-xs">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.value} value={f.value} className="text-xs">
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Direction toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onUpdate({ direction: condition.direction === 'asc' ? 'desc' : 'asc' })}
        className={cn(
          "h-8 w-8 p-0",
          condition.direction === 'desc' && "text-orange-500"
        )}
        title={condition.direction === 'asc' ? 'Ascending' : 'Descending'}
      >
        {condition.direction === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Create Puck custom field for sort configuration
 */
export function createSortField() {
  return {
    type: 'custom' as const,
    label: 'Sort',
    render: ({ value, onChange, field }: {
      value: RowSortConfig | undefined;
      onChange: (value: RowSortConfig) => void;
      field: { viewId?: number };
    }) => {
      // Get viewId from parent data (passed via resolveFields)
      const viewId = (field as any)?.viewId;
      return <MultiSortField value={value} onChange={onChange} viewId={viewId} />;
    },
  };
}

export default MultiSortField;
