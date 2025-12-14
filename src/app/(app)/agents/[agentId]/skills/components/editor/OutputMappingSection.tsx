'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Database, ArrowRight, Info, Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { SkillOutput, OutputMappingConfig, FieldMapping } from '@/app/mappers/skill-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import { getRowsDSG } from '@/app/actions/rows';
import {
  getOutputFieldsForTask,
  taskSupportsFieldMapping,
  suggestMappingMode,
  type OutputFieldDef
} from '@/lib/constants/task-output-schemas';

interface FieldMappingRowProps {
  mapping: FieldMapping;
  sourceFields: OutputFieldDef[];
  targetFields: FieldDTO[];
  onUpdate: (mapping: FieldMapping) => void;
  onRemove: () => void;
  isReadOnly?: boolean;
}

function FieldMappingRow({
  mapping,
  sourceFields,
  targetFields,
  onUpdate,
  onRemove,
  isReadOnly
}: FieldMappingRowProps) {
  return (
    <div className="flex items-center gap-2 p-2 rounded border bg-background">
      {/* Source field selector */}
      <Select
        value={mapping.sourceField}
        onValueChange={(value) => onUpdate({ ...mapping, sourceField: value })}
        disabled={isReadOnly}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Output field..." />
        </SelectTrigger>
        <SelectContent>
          {sourceFields.map((field) => (
            <SelectItem key={field.field} value={field.field}>
              <div className="flex flex-col">
                <span>{field.field}</span>
                {field.description && (
                  <span className="text-xs text-muted-foreground">{field.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* Target field selector */}
      <Select
        value={mapping.targetFieldId?.toString()}
        onValueChange={(value) => onUpdate({ ...mapping, targetFieldId: parseInt(value) })}
        disabled={isReadOnly || targetFields.length === 0}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Target field..." />
        </SelectTrigger>
        <SelectContent>
          {targetFields.map((field) => (
            <SelectItem key={field.id} value={field.id.toString()}>
              <div className="flex items-center gap-1">
                <span>{field.name}</span>
                <span className="text-xs text-muted-foreground">({field.type})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Remove button */}
      {!isReadOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface OutputMappingSectionProps {
  outputs: SkillOutput[];
  onOutputsChange: (outputs: SkillOutput[]) => void;
  taskType?: string;  // The task type for getting available output fields
  isReadOnly?: boolean;
}

/**
 * Output Mapping Section (Redesigned)
 *
 * Allows configuring path-based field mappings for skill outputs.
 * - Single row mode: Map top result to fields on one row
 * - Multi row mode: Create a row per array item (e.g., object detection)
 */
export function OutputMappingSection({
  outputs,
  onOutputsChange,
  taskType,
  isReadOnly
}: OutputMappingSectionProps) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [rows, setRows] = useState<Array<{ id: string; [key: string]: any }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);

  // Get the first output (we support one output mapping config per skill for now)
  const output = outputs[0];
  const outputMapping = output?.outputMapping;

  // Get available source fields based on task type
  const sourceFields = useMemo(() => {
    if (!taskType) return [];
    return getOutputFieldsForTask(taskType);
  }, [taskType]);

  // Check if this task type supports field mapping
  const supportsMapping = taskType ? taskSupportsFieldMapping(taskType) : false;

  // Fetch tables on mount
  useEffect(() => {
    getTables()
      .then(setTables)
      .finally(() => setLoading(false));
  }, []);

  // Fetch fields when table is selected
  const selectedTableId = outputMapping?.mappings[0]?.targetTableId;
  useEffect(() => {
    if (selectedTableId) {
      setLoadingFields(true);
      getFields(selectedTableId)
        .then((result) => {
          if (Array.isArray(result)) {
            setFields(result);
          }
        })
        .finally(() => setLoadingFields(false));
    } else {
      setFields([]);
    }
  }, [selectedTableId]);

  // Fetch rows when table is selected (for update mode row picker)
  useEffect(() => {
    if (selectedTableId && outputMapping?.rowAction === 'update') {
      getRowsDSG(selectedTableId, 50)
        .then((result) => setRows(result.rows || []))
        .catch(() => setRows([]));
    } else {
      setRows([]);
    }
  }, [selectedTableId, outputMapping?.rowAction]);

  // Don't show section if task doesn't support mapping or no outputs
  if (!output || !supportsMapping || sourceFields.length === 0) {
    return null;
  }

  const updateOutputMapping = (newMapping: OutputMappingConfig | undefined) => {
    const newOutputs = outputs.map((o, i) =>
      i === 0 ? { ...o, outputMapping: newMapping } : o
    );
    onOutputsChange(newOutputs);
  };

  const handleModeChange = (mode: 'single_row' | 'multi_row') => {
    updateOutputMapping({
      mode,
      rowAction: 'create',
      mappings: outputMapping?.mappings || []
    });
  };

  const handleTableChange = (tableId: string) => {
    const id = parseInt(tableId);
    // Update all mappings to use the new table
    const newMappings = (outputMapping?.mappings || []).map((m) => ({
      ...m,
      targetTableId: id
    }));
    updateOutputMapping({
      mode: outputMapping?.mode || suggestMappingMode(taskType || ''),
      rowAction: outputMapping?.rowAction || 'create',
      mappings: newMappings.length > 0 ? newMappings : [{ sourceField: '', targetTableId: id, targetFieldId: 0 }]
    });
  };

  const handleRowActionChange = (action: 'create' | 'update') => {
    if (!outputMapping) return;
    updateOutputMapping({
      ...outputMapping,
      rowAction: action,
      rowId: action === 'create' ? undefined : outputMapping.rowId
    });
  };

  const handleRowIdChange = (rowId: string) => {
    if (!outputMapping) return;
    updateOutputMapping({
      ...outputMapping,
      rowId
    });
  };

  const handleAddMapping = () => {
    const tableId = selectedTableId || 0;
    const newMapping: FieldMapping = {
      sourceField: '',
      targetTableId: tableId,
      targetFieldId: 0
    };
    updateOutputMapping({
      mode: outputMapping?.mode || suggestMappingMode(taskType || ''),
      rowAction: outputMapping?.rowAction || 'create',
      mappings: [...(outputMapping?.mappings || []), newMapping]
    });
  };

  const handleUpdateMapping = (index: number, mapping: FieldMapping) => {
    if (!outputMapping) return;
    const newMappings = [...outputMapping.mappings];
    newMappings[index] = mapping;
    updateOutputMapping({
      ...outputMapping,
      mappings: newMappings
    });
  };

  const handleRemoveMapping = (index: number) => {
    if (!outputMapping) return;
    const newMappings = outputMapping.mappings.filter((_, i) => i !== index);
    if (newMappings.length === 0) {
      updateOutputMapping(undefined);
    } else {
      updateOutputMapping({
        ...outputMapping,
        mappings: newMappings
      });
    }
  };

  const getRowLabel = (row: { id: string; [key: string]: any }) => {
    const textField = fields.find((f) => f.type === 'text');
    if (textField && row[textField.name]) {
      const value = String(row[textField.name]);
      return value.length > 30 ? value.substring(0, 30) + '...' : value;
    }
    return `Row ${row.id.substring(0, 8)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Output Mapping</Label>
        <div className="group relative">
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          <div className="invisible group-hover:visible absolute left-0 top-5 z-50 w-64 rounded-md bg-popover p-2 text-xs text-popover-foreground shadow-md border">
            Map output fields to table columns. Single row maps the top result; multi-row creates a row per item.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground p-3 border rounded-lg">
          Loading tables...
        </div>
      ) : tables.length === 0 ? (
        <div className="text-sm text-muted-foreground p-3 border rounded-lg">
          No tables available. Create a table first.
        </div>
      ) : (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          {/* Mode selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <RadioGroup
              value={outputMapping?.mode || suggestMappingMode(taskType || '')}
              onValueChange={(value) => handleModeChange(value as 'single_row' | 'multi_row')}
              className="flex gap-4"
              disabled={isReadOnly}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single_row" id="single_row" />
                <Label htmlFor="single_row" className="text-sm cursor-pointer">
                  Single Row (top result)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multi_row" id="multi_row" />
                <Label htmlFor="multi_row" className="text-sm cursor-pointer">
                  Multiple Rows (all results)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Table selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Target Table</Label>
            <Select
              value={selectedTableId?.toString()}
              onValueChange={handleTableChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select table..." />
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

          {/* Row action (single_row mode only) */}
          {outputMapping?.mode === 'single_row' && selectedTableId && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Action</Label>
              <div className="flex gap-2">
                <Select
                  value={outputMapping.rowAction || 'create'}
                  onValueChange={(value) => handleRowActionChange(value as 'create' | 'update')}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create new row</SelectItem>
                    <SelectItem value="update">Update existing</SelectItem>
                  </SelectContent>
                </Select>

                {outputMapping.rowAction === 'update' && (
                  <Select
                    value={outputMapping.rowId}
                    onValueChange={handleRowIdChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select row..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {getRowLabel(row)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Field mappings */}
          {selectedTableId && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Field Mappings</Label>
              <div className="space-y-2">
                {(outputMapping?.mappings || []).map((mapping, index) => (
                  <FieldMappingRow
                    key={index}
                    mapping={mapping}
                    sourceFields={sourceFields}
                    targetFields={fields}
                    onUpdate={(m) => handleUpdateMapping(index, m)}
                    onRemove={() => handleRemoveMapping(index)}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </div>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMapping}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Field Mapping
                </Button>
              )}
            </div>
          )}

          {/* Clear all button */}
          {outputMapping && !isReadOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => updateOutputMapping(undefined)}
            >
              Clear All Mappings
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
