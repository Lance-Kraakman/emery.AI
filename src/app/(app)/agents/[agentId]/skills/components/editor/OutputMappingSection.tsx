'use client';

import React, { useState, useEffect } from 'react';
import { Database, ArrowRight, Plus, RefreshCw, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { SkillOutput, OutputMapping } from '@/app/mappers/skill-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';

// Compatible column types for each output type
const OUTPUT_TYPE_TO_FIELD_TYPES: Record<string, string[]> = {
  'text': ['text', 'document'],
  'image': ['file'],
  'audio': ['file'],
  'file': ['file'],
  'document': ['document'],
  'video': ['file'],
};

interface OutputMappingRowProps {
  output: SkillOutput;
  tables: TableDTO[];
  onMappingChange: (mapping: OutputMapping | undefined) => void;
  isReadOnly?: boolean;
}

function OutputMappingRow({ output, tables, onMappingChange, isReadOnly }: OutputMappingRowProps) {
  const [selectedTableId, setSelectedTableId] = useState<number | undefined>(output.mapping?.tableId);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Fetch fields when table is selected
  useEffect(() => {
    if (selectedTableId) {
      setLoadingFields(true);
      getFields(selectedTableId)
        .then(result => {
          if (Array.isArray(result)) {
            setFields(result);
          }
        })
        .finally(() => setLoadingFields(false));
    } else {
      setFields([]);
    }
  }, [selectedTableId]);

  // Filter fields by compatible types
  const compatibleTypes = OUTPUT_TYPE_TO_FIELD_TYPES[output.type || 'text'] || ['text'];
  const compatibleFields = fields.filter(f => compatibleTypes.includes(f.type));

  const handleTableChange = (tableId: string) => {
    const id = parseInt(tableId);
    setSelectedTableId(id);
    // Clear field selection when table changes
    onMappingChange(undefined);
  };

  const handleFieldChange = (fieldId: string) => {
    if (!selectedTableId) return;
    onMappingChange({
      tableId: selectedTableId,
      fieldId: parseInt(fieldId),
      mode: output.mapping?.mode || 'create',
      rowId: output.mapping?.rowId
    });
  };

  const handleModeChange = (mode: 'create' | 'update') => {
    if (!output.mapping) return;
    onMappingChange({
      ...output.mapping,
      mode,
      rowId: mode === 'create' ? undefined : output.mapping.rowId
    });
  };

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
      {/* Output name */}
      <div className="flex items-center gap-2 min-w-[100px]">
        <span className="text-sm font-medium">{output.name}</span>
        <span className="text-xs text-muted-foreground">({output.type || 'text'})</span>
      </div>

      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* Table selector */}
      <Select
        value={selectedTableId?.toString()}
        onValueChange={handleTableChange}
        disabled={isReadOnly}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Table..." />
        </SelectTrigger>
        <SelectContent>
          {tables.map(table => (
            <SelectItem key={table.id} value={table.id.toString()}>
              {table.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Field selector */}
      <Select
        value={output.mapping?.fieldId?.toString()}
        onValueChange={handleFieldChange}
        disabled={isReadOnly || !selectedTableId || loadingFields}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder={loadingFields ? 'Loading...' : 'Column...'} />
        </SelectTrigger>
        <SelectContent>
          {compatibleFields.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground">
              No compatible columns ({compatibleTypes.join(', ')})
            </div>
          ) : (
            compatibleFields.map(field => (
              <SelectItem key={field.id} value={field.id.toString()}>
                {field.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Mode toggle */}
      {output.mapping && (
        <div className="flex items-center gap-1 ml-2">
          <Button
            type="button"
            variant={output.mapping.mode === 'create' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handleModeChange('create')}
            disabled={isReadOnly}
            title="Create new row"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant={output.mapping.mode === 'update' ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => handleModeChange('update')}
            disabled={isReadOnly}
            title="Update existing row"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Clear button */}
      {output.mapping && !isReadOnly && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => {
            setSelectedTableId(undefined);
            onMappingChange(undefined);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

interface OutputMappingSectionProps {
  outputs: SkillOutput[];
  onOutputsChange: (outputs: SkillOutput[]) => void;
  isReadOnly?: boolean;
}

/**
 * Output Mapping Section
 *
 * Allows configuring how each skill output is saved to a table.
 * - Select target table and column for each output
 * - Choose mode: create new row or update existing row
 */
export function OutputMappingSection({ outputs, onOutputsChange, isReadOnly }: OutputMappingSectionProps) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch tables on mount
  useEffect(() => {
    getTables()
      .then(setTables)
      .finally(() => setLoading(false));
  }, []);

  const handleMappingChange = (outputIndex: number, mapping: OutputMapping | undefined) => {
    const newOutputs = [...outputs];
    newOutputs[outputIndex] = {
      ...newOutputs[outputIndex],
      mapping
    };
    onOutputsChange(newOutputs);
  };

  // Don't show section if no outputs
  if (outputs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Output Mapping</Label>
        <div className="group relative">
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          <div className="invisible group-hover:visible absolute left-0 top-5 z-50 w-56 rounded-md bg-popover p-2 text-xs text-popover-foreground shadow-md border">
            Save skill outputs directly to table columns. Choose create new row or update existing.
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
        <div className="space-y-2">
          {outputs.map((output, index) => (
            <OutputMappingRow
              key={output.name}
              output={output}
              tables={tables}
              onMappingChange={(mapping) => handleMappingChange(index, mapping)}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
