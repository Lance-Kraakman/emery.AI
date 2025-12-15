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

/**
 * Map skill output type to OutputFieldDef type for output mapping.
 * Used in agent mode to derive source fields from skill outputs.
 * OutputFieldDef requires: 'text' | 'number' | 'boolean' | 'relation' | 'file' | 'embedding'
 */
function mapSkillOutputTypeToFieldType(skillOutputType: string | undefined): OutputFieldDef['type'] {
  const typeMap: Record<string, OutputFieldDef['type']> = {
    'text': 'text',
    'number': 'number',
    'boolean': 'boolean',
    'image': 'file',    // URLs stored as file
    'file': 'file',
    'audio': 'file',    // URLs stored as file
    'video': 'file',    // URLs stored as file
    'document': 'file', // URLs stored as file
    'json': 'text',     // JSON serialized as text
  };
  return typeMap[skillOutputType || 'text'] || 'text';
}

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
    <div className="flex items-center gap-1.5">
      {/* Source field selector */}
      <Select
        value={mapping.sourceField}
        onValueChange={(value) => onUpdate({ ...mapping, sourceField: value })}
        disabled={isReadOnly}
      >
        <SelectTrigger className="w-[120px] h-7 text-[11px]">
          <SelectValue placeholder="Source..." />
        </SelectTrigger>
        <SelectContent>
          {sourceFields.map((field) => (
            <SelectItem key={field.field} value={field.field}>
              {field.field}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />

      {/* Target field selector */}
      <Select
        value={mapping.targetFieldId?.toString()}
        onValueChange={(value) => onUpdate({ ...mapping, targetFieldId: parseInt(value) })}
        disabled={isReadOnly || targetFields.length === 0}
      >
        <SelectTrigger className="w-[130px] h-7 text-[11px]">
          <SelectValue placeholder="Target..." />
        </SelectTrigger>
        <SelectContent>
          {targetFields.map((field) => (
            <SelectItem key={field.id} value={field.id.toString()}>
              <span>{field.name}</span>
              <span className="text-[10px] text-muted-foreground ml-1">({field.type})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Remove button */}
      {!isReadOnly && (
        <button
          type="button"
          className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

interface OutputMappingSectionProps {
  outputs: SkillOutput[];
  onOutputsChange: (outputs: SkillOutput[]) => void;
  taskType?: string;  // The task type for getting available output fields (operation mode)
  skillOutputs?: SkillOutput[];  // Skill outputs for agent mode (source fields from skill definition)
  executionType?: 'agent' | 'operation';  // Execution type to determine source field strategy
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
  skillOutputs,
  executionType = 'operation',
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

  // Get available source fields based on execution type
  // - Operation mode: use task schema fields
  // - Agent mode: use skill outputs as source fields (what the agent's submit_result() provides)
  const sourceFields = useMemo((): OutputFieldDef[] => {
    if (executionType === 'operation' && taskType) {
      // Operation mode: get fields from task output schema
      return getOutputFieldsForTask(taskType);
    } else if (executionType === 'agent' && skillOutputs && skillOutputs.length > 0) {
      // Agent mode: derive source fields from skill outputs
      // These are the fields the agent will provide via submit_result()
      return skillOutputs.map((skillOutput) => ({
        field: skillOutput.name,
        type: mapSkillOutputTypeToFieldType(skillOutput.type),
        description: `Agent output: ${skillOutput.name}`
      }));
    }
    return [];
  }, [executionType, taskType, skillOutputs]);

  // Check if mapping is supported
  // - Operation mode: check task schema support
  // - Agent mode: always supported if skill has outputs
  const supportsMapping = useMemo(() => {
    if (executionType === 'operation') {
      return taskType ? taskSupportsFieldMapping(taskType) : false;
    } else {
      // Agent mode: supported if skill has defined outputs
      return skillOutputs && skillOutputs.length > 0;
    }
  }, [executionType, taskType, skillOutputs]);

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

  // Show info message if no outputs defined (agent mode only)
  if (executionType === 'agent' && (!skillOutputs || skillOutputs.length === 0)) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Database className="h-3.5 w-3.5" />
        <span>Add outputs above to enable output mapping</span>
      </div>
    );
  }

  // Don't show section if task doesn't support mapping or no source fields
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
    <div className="space-y-2">
      {/* Compact header with inline config */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium">Output Mapping</Label>
          <div className="group relative">
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            <div className="invisible group-hover:visible absolute left-0 top-4 z-50 w-56 rounded-md bg-popover p-2 text-[11px] text-popover-foreground shadow-md border">
              Map outputs to table fields. Single row = top result; Multi = row per item.
            </div>
          </div>
        </div>

        {!loading && tables.length > 0 && (
          <>
            {/* Mode toggle */}
            <RadioGroup
              value={outputMapping?.mode || suggestMappingMode(taskType || '')}
              onValueChange={(value) => handleModeChange(value as 'single_row' | 'multi_row')}
              className="flex gap-1"
              disabled={isReadOnly}
            >
              <div className="flex items-center">
                <RadioGroupItem value="single_row" id="single_row" className="h-3 w-3" />
                <Label htmlFor="single_row" className="text-[11px] cursor-pointer pl-1">Single</Label>
              </div>
              <div className="flex items-center">
                <RadioGroupItem value="multi_row" id="multi_row" className="h-3 w-3" />
                <Label htmlFor="multi_row" className="text-[11px] cursor-pointer pl-1">Multi</Label>
              </div>
            </RadioGroup>

            {/* Table selector */}
            <Select
              value={selectedTableId?.toString()}
              onValueChange={handleTableChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-7 w-[130px] text-[11px]">
                <SelectValue placeholder="Table..." />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.id} value={table.id.toString()}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Row action (single_row mode only) */}
            {outputMapping?.mode === 'single_row' && selectedTableId && (
              <>
                <Select
                  value={outputMapping.rowAction || 'create'}
                  onValueChange={(value) => handleRowActionChange(value as 'create' | 'update')}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="h-7 w-[100px] text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                  </SelectContent>
                </Select>

                {outputMapping.rowAction === 'update' && (
                  <Select
                    value={outputMapping.rowId}
                    onValueChange={handleRowIdChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="h-7 w-[140px] text-[11px]">
                      <SelectValue placeholder="Row..." />
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
              </>
            )}
          </>
        )}
      </div>

      {loading ? (
        <div className="text-[11px] text-muted-foreground py-1">Loading tables...</div>
      ) : tables.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-1">No tables available</div>
      ) : selectedTableId && (
        /* Field mappings - compact rows */
        <div className="space-y-1.5 pl-5">
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
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddMapping}
                className="h-6 px-2 text-[11px]"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
              {outputMapping && (
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => updateOutputMapping(undefined)}
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
