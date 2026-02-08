'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Database, Plus, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { WriteConfig, WriteFieldMapping, UpdateMatchConfig, InputDefinition } from '@/ddd/domain/skills/entities/skill';
import type { WorkflowVariable } from '@/components/workflow-canvas/WorkflowVariableInput';

interface WriteConfigFormProps {
  value: WriteConfig | undefined;
  onChange: (config: WriteConfig | undefined) => void;
  workflowVariables: WorkflowVariable[];
  onInputDefinitionsChange: (inputs: InputDefinition[]) => void;
  disabled?: boolean;
}

/**
 * Form for configuring direct table write execution (executionType='write').
 * Allows selecting a target table, row action (create/update), and mapping skill inputs to fields.
 */
export function WriteConfigForm({
  value,
  onChange,
  workflowVariables,
  onInputDefinitionsChange,
  disabled
}: WriteConfigFormProps) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tables on mount
  useEffect(() => {
    async function loadTables() {
      setIsLoadingTables(true);
      setError(null);
      try {
        const tablesData = await getTables();
        setTables(tablesData || []);
      } catch (err) {
        console.error('Error loading tables:', err);
        setError('Failed to load tables');
      }
      setIsLoadingTables(false);
    }
    loadTables();
  }, []);

  // Load fields when table changes
  useEffect(() => {
    async function loadFields() {
      if (!value?.targetTableId) {
        setFields([]);
        return;
      }
      setIsLoadingFields(true);
      try {
        const fieldsData = await getFields(value.targetTableId);
        // Filter out the synthetic 'id' field for mapping (it's auto-generated)
        setFields(fieldsData.filter(f => f.name !== 'id'));
      } catch (err) {
        console.error('Error loading fields:', err);
        setFields([]);
      }
      setIsLoadingFields(false);
    }
    loadFields();
  }, [value?.targetTableId]);

  // Get selected table info
  const selectedTable = useMemo(() => {
    return tables.find(t => t.id === value?.targetTableId);
  }, [tables, value?.targetTableId]);

  // Handle table selection
  const handleTableSelect = (tableId: string) => {
    const id = parseInt(tableId);
    if (isNaN(id)) {
      onChange(undefined);
      onInputDefinitionsChange([]);
      return;
    }

    // Initialize with empty config
    onChange({
      targetTableId: id,
      rowAction: 'create',
      fieldMappings: [],
      updateMatch: undefined
    });
  };

  // Handle row action change
  const handleRowActionChange = (action: 'create' | 'update') => {
    if (!value) return;
    onChange({
      ...value,
      rowAction: action,
      updateMatch: action === 'update' ? value.updateMatch : undefined
    });
  };

  // Auto-map workflow variables to table fields
  const handleAutoCreateInputs = () => {
    if (!fields.length) return;

    const mappings: WriteFieldMapping[] = [];

    for (const field of fields) {
      // Normalize field name for matching (lowercase, underscores)
      const normalizedFieldName = field.name.toLowerCase().replace(/\s+/g, '_');

      // Find a workflow variable that matches this field name
      // Match either by suffix (e.g., "read_123.name" matches "name")
      // or by exact name (e.g., "name" matches "name")
      const matchingVar = workflowVariables.find(v => {
        const varName = v.name.toLowerCase();
        // Check if variable ends with .fieldName or is exactly fieldName
        return varName.endsWith(`.${normalizedFieldName}`) || varName === normalizedFieldName;
      });

      if (matchingVar) {
        mappings.push({
          skillInputName: matchingVar.name, // Use full variable name like "read_123.name"
          targetFieldId: field.id,
        });
      }
    }

    onChange({
      ...value!,
      fieldMappings: mappings,
    });
  };

  // Map field type to skill input type
  const mapFieldTypeToSkillType = (fieldType: string): InputDefinition['type'] => {
    switch (fieldType) {
      case 'text':
      case 'rich-text':
        return 'text';
      case 'number':
      case 'currency':
      case 'percent':
        return 'number';
      case 'boolean':
      case 'checkbox':
        return 'boolean';
      case 'date':
      case 'datetime':
        return 'date';
      case 'email':
        return 'email';
      case 'phone':
        return 'phone';
      case 'single-select':
        return 'single-select';
      case 'multi-select':
        return 'multi-select';
      case 'file':
      case 'attachment':
        return 'file';
      case 'image':
        return 'image';
      default:
        return 'text';
    }
  };

  // Handle field mapping change
  const handleMappingChange = (targetFieldId: number, skillInputName: string | undefined) => {
    if (!value) return;

    let newMappings = [...value.fieldMappings];
    const existingIndex = newMappings.findIndex(m => m.targetFieldId === targetFieldId);

    if (skillInputName) {
      if (existingIndex >= 0) {
        newMappings[existingIndex] = { skillInputName, targetFieldId };
      } else {
        newMappings.push({ skillInputName, targetFieldId });
      }
    } else {
      // Remove mapping
      newMappings = newMappings.filter(m => m.targetFieldId !== targetFieldId);
    }

    onChange({
      ...value,
      fieldMappings: newMappings
    });
  };

  // Handle update match config
  const handleUpdateMatchChange = (config: Partial<UpdateMatchConfig> | undefined) => {
    if (!value) return;

    if (!config) {
      onChange({
        ...value,
        updateMatch: undefined
      });
      return;
    }

    onChange({
      ...value,
      updateMatch: {
        skillInputName: config.skillInputName || value.updateMatch?.skillInputName || '',
        targetFieldId: config.targetFieldId ?? value.updateMatch?.targetFieldId ?? 0
      }
    });
  };

  // Get mapping for a field
  const getMappingForField = (fieldId: number): string | undefined => {
    return value?.fieldMappings.find(m => m.targetFieldId === fieldId)?.skillInputName;
  };

  // Clear configuration
  const handleClear = () => {
    onChange(undefined);
    onInputDefinitionsChange([]);
    setFields([]);
  };

  if (isLoadingTables) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading tables...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive flex items-center justify-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table Selection */}
      {!value?.targetTableId ? (
        <div className="border rounded-lg p-3">
          <Label className="text-xs font-medium mb-1.5 block">Target Table</Label>
          <Select
            value=""
            onValueChange={handleTableSelect}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select a table..." />
            </SelectTrigger>
            <SelectContent>
              {tables.length === 0 ? (
                <SelectItem value="no-tables" disabled>
                  No tables available
                </SelectItem>
              ) : (
                tables.map((table) => (
                  <SelectItem key={table.id} value={table.id.toString()}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      {table.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Select the table where data will be written.
          </p>
        </div>
      ) : (
        /* Selected Table Configuration */
        <div className="border rounded-lg p-3 bg-primary/5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span className="font-medium text-sm">{selectedTable?.name || 'Table'}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {fields.length} fields
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Map variables to table fields.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Row Action Toggle */}
          <div className="mb-3">
            <Label className="text-xs font-medium mb-1.5 block">Row Action</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleRowActionChange('create')}
                disabled={disabled}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border transition-all text-xs',
                  value?.rowAction === 'create'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background hover:bg-accent/50'
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="font-medium">Create</span>
              </button>
              <button
                type="button"
                onClick={() => handleRowActionChange('update')}
                disabled={disabled}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border transition-all text-xs',
                  value?.rowAction === 'update'
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background hover:bg-accent/50'
                )}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="font-medium">Update</span>
              </button>
            </div>
          </div>

          {/* Update Match Config (only for update action) */}
          {value?.rowAction === 'update' && (
            <div className="mb-3 p-2 bg-background rounded-md border">
              <Label className="text-xs font-medium mb-1 block">Match Row By</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">
                Select input and field to match row.
              </p>
              <div className="flex items-center gap-2">
                <Select
                  value={value.updateMatch?.skillInputName || ''}
                  onValueChange={(val) => handleUpdateMatchChange({ skillInputName: val })}
                  disabled={disabled}
                >
                  <SelectTrigger className="flex-1 h-8">
                    <SelectValue placeholder="Variable..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowVariables.map(v => (
                      <SelectItem key={v.name} value={v.name}>
                        {v.label || v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">=</span>
                <Select
                  value={value.updateMatch?.targetFieldId?.toString() || ''}
                  onValueChange={(val) => handleUpdateMatchChange({ targetFieldId: parseInt(val) })}
                  disabled={disabled}
                >
                  <SelectTrigger className="flex-1 h-8">
                    <SelectValue placeholder="Table field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map(field => (
                      <SelectItem key={field.id} value={field.id.toString()}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Field Mappings */}
          {isLoadingFields ? (
            <div className="text-xs text-muted-foreground text-center py-2">
              Loading fields...
            </div>
          ) : fields.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">
              No fields found in this table.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Field Mappings</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoCreateInputs}
                  disabled={disabled}
                  className="text-[10px] h-6 px-2"
                >
                  Auto-map
                </Button>
              </div>
              <div className="space-y-1.5">
                {fields.map((field) => {
                  const currentMapping = getMappingForField(field.id);
                  // Check if current mapping exists in available variables
                  const isOrphanedMapping = currentMapping &&
                    !workflowVariables.some(v => v.name === currentMapping);

                  return (
                    <div key={field.id} className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <Select
                          value={currentMapping || '__none__'}
                          onValueChange={(val) => {
                            handleMappingChange(
                              field.id,
                              val === '__none__' ? undefined : val
                            );
                          }}
                          disabled={disabled}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">—</span>
                            </SelectItem>
                            {/* Show orphaned mapping so it displays correctly */}
                            {isOrphanedMapping && (
                              <SelectItem value={currentMapping}>
                                <span className="text-amber-600">{currentMapping} (missing)</span>
                              </SelectItem>
                            )}
                            {workflowVariables.map(v => (
                              <SelectItem key={v.name} value={v.name}>
                                {v.label || v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <span className="text-muted-foreground text-xs">→</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-xs truncate">{field.name}</span>
                          {field.required && (
                            <span className="text-[9px] text-destructive">*</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
