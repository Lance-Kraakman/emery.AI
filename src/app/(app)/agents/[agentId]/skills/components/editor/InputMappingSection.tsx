'use client';

import React, { useState, useEffect } from 'react';
import { Database, ArrowLeft, Info, Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { InputDefinition, RowIdSource } from '@/app/mappers/skill-mapper';
import type { InputMappingConfig, InputFieldSource } from '@/ddd/domain/skills/entities/skill';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';

/**
 * Serialize RowIdSource to string for Select value
 */
function serializeRowIdSource(source: RowIdSource | undefined): string {
  if (!source) return '';
  switch (source.type) {
    case 'static': return `static:${source.staticId}`;
    case 'skill_input': return `input:${source.skillInput}`;
    case 'skill_output': return `output:${source.skillOutput}`;
    case 'table_ref': return `table:${source.tableRef?.order}:${source.tableRef?.field}`;
    case 'source_row': return 'source_row';
    default: return '';
  }
}

/**
 * Deserialize string to RowIdSource
 */
function deserializeRowIdSource(value: string): RowIdSource | undefined {
  if (!value) return undefined;
  if (value === 'source_row') {
    return { type: 'source_row' };
  } else if (value.startsWith('input:')) {
    return { type: 'skill_input', skillInput: value.slice(6) };
  } else if (value.startsWith('output:')) {
    return { type: 'skill_output', skillOutput: value.slice(7) };
  } else if (value.startsWith('static:')) {
    return { type: 'static', staticId: value.slice(7) };
  }
  return undefined;
}

interface InputMappingRowProps {
  input: InputDefinition;
  tables: TableDTO[];
  tableFieldsMap: Map<number, FieldDTO[]>;
  otherInputs: InputDefinition[];
  onUpdate: (input: InputDefinition) => void;
  onRemoveMapping: () => void;
  isReadOnly?: boolean;
}

function InputMappingRow({
  input,
  tables,
  tableFieldsMap,
  otherInputs,
  onUpdate,
  onRemoveMapping,
  isReadOnly
}: InputMappingRowProps) {
  const mapping = input.inputMapping;
  const selectedTableId = mapping?.source?.tableId;
  const selectedFieldId = mapping?.source?.fieldId;
  const rowSource = mapping?.source?.rowSource;

  const availableFields = selectedTableId ? (tableFieldsMap.get(selectedTableId) || []) : [];

  const handleTableChange = (tableId: number) => {
    const newMapping: InputMappingConfig = {
      source: {
        tableId,
        fieldId: 0,
        rowSource: { type: 'source_row' }
      }
    };
    onUpdate({ ...input, inputMapping: newMapping });
  };

  const handleFieldChange = (fieldId: number) => {
    if (!mapping) return;
    onUpdate({
      ...input,
      inputMapping: {
        source: {
          ...mapping.source,
          fieldId
        }
      }
    });
  };

  const handleRowSourceChange = (value: string) => {
    if (!mapping) return;
    const newRowSource = deserializeRowIdSource(value);
    if (newRowSource) {
      onUpdate({
        ...input,
        inputMapping: {
          source: {
            ...mapping.source,
            rowSource: newRowSource
          }
        }
      });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap py-1.5 border-b border-border/50 last:border-0">
      {/* Input name */}
      <div className="flex items-center gap-1.5 min-w-[100px]">
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
          {input.name}
        </code>
        {input.required && (
          <span className="text-[10px] text-orange-600">req</span>
        )}
      </div>

      <ArrowLeft className="h-3 w-3 text-muted-foreground shrink-0" />

      {/* Table selector */}
      <Select
        value={selectedTableId?.toString() || ''}
        onValueChange={(v) => handleTableChange(parseInt(v))}
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

      {/* Field selector */}
      <Select
        value={selectedFieldId?.toString() || ''}
        onValueChange={(v) => handleFieldChange(parseInt(v))}
        disabled={isReadOnly || !selectedTableId}
      >
        <SelectTrigger className="h-7 w-[120px] text-[11px]">
          <SelectValue placeholder="Field..." />
        </SelectTrigger>
        <SelectContent>
          {availableFields.map((field) => (
            <SelectItem key={field.id} value={field.id.toString()}>
              <span>{field.name}</span>
              <span className="text-[10px] text-muted-foreground ml-1">({field.type})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Row source selector */}
      <Select
        value={serializeRowIdSource(rowSource)}
        onValueChange={handleRowSourceChange}
        disabled={isReadOnly || !selectedTableId}
      >
        <SelectTrigger className="h-7 w-[140px] text-[11px]">
          <SelectValue placeholder="Row..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="source_row">Source Row</SelectItem>
          {otherInputs.length > 0 && (
            <SelectGroup>
              <SelectLabel className="text-[10px]">From Skill Input</SelectLabel>
              {otherInputs.map((inp) => (
                <SelectItem key={`input:${inp.name}`} value={`input:${inp.name}`}>
                  Input: {inp.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {/* Remove mapping button */}
      {!isReadOnly && (
        <button
          type="button"
          className="h-5 w-5 rounded text-muted-foreground hover:text-destructive flex items-center justify-center"
          onClick={onRemoveMapping}
          title="Remove mapping"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

interface InputMappingSectionProps {
  inputs: InputDefinition[];
  onInputsChange: (inputs: InputDefinition[]) => void;
  isReadOnly?: boolean;
}

/**
 * Input Mapping Section
 *
 * Configures how skill inputs are populated FROM table fields.
 * Each input can optionally read its value from a table field.
 */
export function InputMappingSection({
  inputs,
  onInputsChange,
  isReadOnly
}: InputMappingSectionProps) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [tableFieldsMap, setTableFieldsMap] = useState<Map<number, FieldDTO[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Inputs that have mappings configured
  const mappedInputs = inputs.filter(i => i.inputMapping?.source?.tableId);
  // Inputs that don't have mappings (can be added)
  const unmappedInputs = inputs.filter(i => !i.inputMapping?.source?.tableId);

  // Fetch tables on mount
  useEffect(() => {
    getTables()
      .then(setTables)
      .finally(() => setLoading(false));
  }, []);

  // Fetch fields for tables used in mappings
  useEffect(() => {
    const tableIds = new Set<number>();
    inputs.forEach(inp => {
      if (inp.inputMapping?.source?.tableId) {
        tableIds.add(inp.inputMapping.source.tableId);
      }
    });

    const fetchFields = async () => {
      const newMap = new Map<number, FieldDTO[]>();
      for (const tableId of tableIds) {
        try {
          const fields = await getFields(tableId);
          if (Array.isArray(fields)) {
            newMap.set(tableId, fields);
          }
        } catch (e) {
          console.error(`Failed to fetch fields for table ${tableId}:`, e);
        }
      }
      setTableFieldsMap(prev => {
        // Merge with existing to preserve previously fetched
        const merged = new Map(prev);
        newMap.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    };

    if (tableIds.size > 0) {
      fetchFields();
    }
  }, [inputs.map(i => i.inputMapping?.source?.tableId).join(',')]);

  // Fetch fields when a new table is selected
  const fetchFieldsForTable = async (tableId: number) => {
    if (tableFieldsMap.has(tableId)) return;
    try {
      const fields = await getFields(tableId);
      if (Array.isArray(fields)) {
        setTableFieldsMap(prev => new Map(prev).set(tableId, fields));
      }
    } catch (e) {
      console.error(`Failed to fetch fields for table ${tableId}:`, e);
    }
  };

  const handleUpdateInput = (index: number, updated: InputDefinition) => {
    // Fetch fields if a new table is selected
    if (updated.inputMapping?.source?.tableId) {
      fetchFieldsForTable(updated.inputMapping.source.tableId);
    }
    const newInputs = [...inputs];
    newInputs[index] = updated;
    onInputsChange(newInputs);
  };

  const handleRemoveMapping = (index: number) => {
    const newInputs = [...inputs];
    newInputs[index] = { ...newInputs[index], inputMapping: undefined };
    onInputsChange(newInputs);
  };

  const handleAddMapping = (inputName: string) => {
    const index = inputs.findIndex(i => i.name === inputName);
    if (index === -1) return;

    const newInputs = [...inputs];
    newInputs[index] = {
      ...newInputs[index],
      inputMapping: {
        source: {
          tableId: 0,
          fieldId: 0,
          rowSource: { type: 'source_row' }
        }
      }
    };
    onInputsChange(newInputs);
  };

  // Don't show section if no inputs
  if (inputs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium cursor-pointer">Input Mapping</Label>
          {mappedInputs.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">
              {mappedInputs.length}
            </span>
          )}
        </button>
        <div className="group relative">
          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
          <div className="invisible group-hover:visible absolute left-0 top-4 z-50 w-56 rounded-md bg-popover p-2 text-[11px] text-popover-foreground shadow-md border">
            Pre-populate skill inputs from table field values.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-[11px] text-muted-foreground py-1">Loading...</div>
      ) : tables.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-1">No tables available</div>
      ) : (
        <div className="space-y-1">
          {/* Mapped inputs */}
          {mappedInputs.map((input) => {
            const originalIndex = inputs.findIndex(i => i.name === input.name);
            return (
              <InputMappingRow
                key={input.name}
                input={input}
                tables={tables}
                tableFieldsMap={tableFieldsMap}
                otherInputs={inputs.filter(i => i.name !== input.name)}
                onUpdate={(updated) => handleUpdateInput(originalIndex, updated)}
                onRemoveMapping={() => handleRemoveMapping(originalIndex)}
                isReadOnly={isReadOnly}
              />
            );
          })}

          {/* Add mapping button for unmapped inputs */}
          {!isReadOnly && unmappedInputs.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Select
                value=""
                onValueChange={handleAddMapping}
              >
                <SelectTrigger className="h-7 w-[180px] text-[11px]">
                  <SelectValue placeholder="Add mapping for input..." />
                </SelectTrigger>
                <SelectContent>
                  {unmappedInputs.map((input) => (
                    <SelectItem key={input.name} value={input.name}>
                      {input.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
