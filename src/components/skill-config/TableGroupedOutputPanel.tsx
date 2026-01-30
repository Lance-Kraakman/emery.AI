'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Table2, Database, Plus, X, Info } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableTableMappingCard } from './SortableTableMappingCard';
import { ManualOutputItem } from './ManualOutputItem';
import { FieldPickerPopover } from './FieldPickerPopover';
import { fieldTypeToOutputType } from './field-type-maps';
import { useTableFields } from './hooks/useTableFields';
import { getTables } from '@/app/actions/tables';
import type {
  OutputDefinition,
  InputDefinition,
  OutputMappingConfig,
  TableMapping,
  FieldMapping,
} from '@/app/mappers/skill-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import type { OutputFieldDef } from '@/lib/constants/task-output-schemas';

interface TableGroupedOutputPanelProps {
  outputs: OutputDefinition[];
  inputs: InputDefinition[];
  onOutputsChange: (outputs: OutputDefinition[]) => void;
  isReadOnly?: boolean;
}

/**
 * Map skill output type to OutputFieldDef type for output mapping.
 */
function mapSkillOutputTypeToFieldType(skillOutputType: string | undefined): OutputFieldDef['type'] {
  const typeMap: Record<string, OutputFieldDef['type']> = {
    'text': 'text',
    'number': 'number',
    'boolean': 'boolean',
    'date': 'text',
    'json': 'text',
    'email': 'text',
    'phone': 'text',
    'single-select': 'text',
    'multi-select': 'text',
    'image': 'file',
    'file': 'file',
    'audio': 'file',
    'video': 'file',
    'document': 'file',
  };
  return typeMap[skillOutputType || 'text'] || 'text';
}

export function TableGroupedOutputPanel({
  outputs,
  inputs,
  onOutputsChange,
  isReadOnly = false,
}: TableGroupedOutputPanelProps) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [showAddManual, setShowAddManual] = useState(false);
  const [newOutputName, setNewOutputName] = useState('');

  // Load tables
  useEffect(() => {
    getTables()
      .then(setTables)
      .finally(() => setTablesLoading(false));
  }, []);

  // Output mapping lives on outputs[0]
  const output = outputs[0];
  const outputMapping = output?.outputMapping;

  // Source fields from skill output definitions
  const sourceFields = useMemo((): OutputFieldDef[] => {
    return outputs.map((o) => ({
      field: o.name,
      type: mapSkillOutputTypeToFieldType(o.type),
      description: `Skill output: ${o.name}`,
    }));
  }, [outputs]);

  // Collect table IDs from output mappings
  const mappedTableIds = useMemo(() => {
    return (outputMapping?.tableMappings || [])
      .map((tm) => tm.targetTableId)
      .filter((id) => id > 0);
  }, [outputMapping]);

  const { tableFieldsMap } = useTableFields(mappedTableIds);

  // Group outputs: those with table mappings vs manual
  const manualOutputs = useMemo(() => {
    if (!outputMapping?.tableMappings?.length) return outputs;
    // Outputs that have mappings are "table-connected"
    // For outputs, the mapping config is on outputs[0].outputMapping.tableMappings
    // Manual outputs = outputs that don't have any field referencing them in table mappings
    const mappedOutputNames = new Set<string>();
    outputMapping.tableMappings.forEach((tm) => {
      tm.mappings.forEach((fm) => {
        if (fm.source?.type === 'skill_output' && fm.source.name) {
          mappedOutputNames.add(fm.source.name);
        }
      });
    });
    return outputs.filter((o) => !mappedOutputNames.has(o.name));
  }, [outputs, outputMapping]);

  // DnD sensors for table mapping reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- Metadata enrichment (critical for relation field handling) ---
  useEffect(() => {
    if (!outputMapping?.tableMappings || tableFieldsMap.size === 0) return;

    let needsUpdate = false;
    const enrichedTableMappings = outputMapping.tableMappings.map((tm) => {
      const tableFields = tableFieldsMap.get(tm.targetTableId) || [];
      const enrichedMappings = tm.mappings.map((mapping) => {
        if (!mapping.targetFieldMetadata && mapping.targetFieldId) {
          const field = tableFields.find((f) => f.id === mapping.targetFieldId);
          if (field) {
            needsUpdate = true;
            return {
              ...mapping,
              targetFieldMetadata: {
                fieldType: field.type,
                fieldName: field.name,
                options:
                  (field.metadata as { options?: Array<{ name: string }> })?.options?.map(
                    (o) => o.name
                  ) || [],
              },
            };
          }
        }
        return mapping;
      });
      return { ...tm, mappings: enrichedMappings };
    });

    if (needsUpdate) {
      const newOutputs = outputs.map((o, i) =>
        i === 0 ? { ...o, outputMapping: { ...outputMapping, tableMappings: enrichedTableMappings } } : o
      );
      onOutputsChange(newOutputs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(
      outputMapping?.tableMappings?.map((tm) => ({
        id: tm.targetTableId,
        mappings: tm.mappings.map((m) => m.targetFieldId),
      }))
    ),
    tableFieldsMap.size,
  ]);

  // --- Handlers ---

  const updateOutputMapping = (newMapping: OutputMappingConfig | undefined) => {
    const newOutputs = outputs.map((o, i) =>
      i === 0 ? { ...o, outputMapping: newMapping } : o
    );
    onOutputsChange(newOutputs);
  };

  const handleAddTableMapping = () => {
    const currentMappings = outputMapping?.tableMappings || [];
    const newOrder = currentMappings.length + 1;
    const newTableMapping: TableMapping = {
      order: newOrder,
      targetTableId: 0,
      rowAction: 'create',
      mappings: [],
    };

    updateOutputMapping({
      mode: outputMapping?.mode || 'single_row',
      tableMappings: [...currentMappings, newTableMapping],
    });
  };

  const handleUpdateTableMapping = (index: number, tm: TableMapping) => {
    if (!outputMapping) return;
    const newMappings = [...outputMapping.tableMappings];
    newMappings[index] = tm;
    updateOutputMapping({ ...outputMapping, tableMappings: newMappings });
  };

  const handleRemoveTableMapping = (index: number) => {
    if (!outputMapping) return;
    const newMappings = outputMapping.tableMappings
      .filter((_, i) => i !== index)
      .map((tm, i) => ({ ...tm, order: i + 1 }));

    if (newMappings.length === 0) {
      updateOutputMapping(undefined);
    } else {
      updateOutputMapping({ ...outputMapping, tableMappings: newMappings });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !outputMapping) return;

    if (active.id !== over.id) {
      const tableMappings = outputMapping.tableMappings;
      const oldIndex = tableMappings.findIndex((tm) => tm.order === active.id);
      const newIndex = tableMappings.findIndex((tm) => tm.order === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(tableMappings, oldIndex, newIndex);
      const updated = reordered.map((tm, i) => ({ ...tm, order: i + 1 }));

      const newOutputs = outputs.map((o, i) =>
        i === 0 ? { ...o, outputMapping: { ...outputMapping, tableMappings: updated } } : o
      );
      onOutputsChange(newOutputs);
    }
  };

  const handleAddOutputsToTable = (tableId: number, fields: FieldDTO[]) => {
    const existingNames = new Set(outputs.map((o) => o.name));
    const newOutputDefs: OutputDefinition[] = [];
    const newFieldMappings: FieldMapping[] = [];

    fields.forEach((field) => {
      const outputType = fieldTypeToOutputType[field.type as FieldType];
      if (outputType === null) return;

      let name = field.name.toLowerCase().replace(/\s+/g, '_');
      if (existingNames.has(name)) {
        let suffix = 2;
        while (existingNames.has(`${name}_${suffix}`)) suffix++;
        name = `${name}_${suffix}`;
      }
      existingNames.add(name);

      newOutputDefs.push({ name, type: outputType || 'text' });
      newFieldMappings.push({
        source: { type: 'skill_output', name },
        targetFieldId: field.id,
        targetFieldMetadata: {
          fieldType: field.type,
          fieldName: field.name,
          options:
            (field.metadata as { options?: Array<{ name: string }> })?.options?.map(
              (o) => o.name
            ) || [],
        },
      });
    });

    if (newOutputDefs.length === 0) return;

    // Add new output definitions
    const updatedOutputs = [...outputs, ...newOutputDefs];

    // Add/merge table mapping
    const currentMappings = outputMapping?.tableMappings || [];
    const existingTableMapping = currentMappings.find((tm) => tm.targetTableId === tableId);

    let updatedTableMappings: TableMapping[];
    if (existingTableMapping) {
      updatedTableMappings = currentMappings.map((tm) =>
        tm.targetTableId === tableId
          ? { ...tm, mappings: [...tm.mappings, ...newFieldMappings] }
          : tm
      );
    } else {
      updatedTableMappings = [
        ...currentMappings,
        {
          order: currentMappings.length + 1,
          targetTableId: tableId,
          rowAction: 'create' as const,
          mappings: newFieldMappings,
        },
      ];
    }

    // Update first output with new mapping config
    const finalOutputs = updatedOutputs.map((o, i) =>
      i === 0
        ? {
            ...o,
            outputMapping: {
              mode: outputMapping?.mode || ('single_row' as const),
              tableMappings: updatedTableMappings,
            },
          }
        : o
    );

    onOutputsChange(finalOutputs);
  };

  const handleRemoveOutput = (outputName: string) => {
    onOutputsChange(outputs.filter((o) => o.name !== outputName));
  };

  const handleAddManualOutput = () => {
    const name = newOutputName.trim();
    if (!name || outputs.some((o) => o.name === name)) return;
    onOutputsChange([...outputs, { name, type: 'text' }]);
    setNewOutputName('');
    setShowAddManual(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium">Outputs</Label>
          <div className="group relative">
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            <div className="invisible group-hover:visible absolute left-0 top-4 z-50 w-56 rounded-md bg-popover p-2 text-[11px] text-popover-foreground shadow-md border">
              Map skill outputs to table fields. Use table references to link rows across tables.
            </div>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">{outputs.length} total</span>
      </div>

      {/* Table-grouped output mappings */}
      {outputMapping && outputMapping.tableMappings.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={outputMapping.tableMappings.map((tm) => tm.order)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {outputMapping.tableMappings.map((tm, index) => {
                const table = tables.find((t) => t.id === tm.targetTableId);
                return (
                  <div key={tm.order}>
                    {/* "To: TableName" header */}
                    {tm.targetTableId > 0 && table && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Table2 className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                          To: {table.name}
                        </span>
                      </div>
                    )}
                    <SortableTableMappingCard
                      id={tm.order}
                      tableMapping={tm}
                      tables={tables}
                      tableFieldsMap={tableFieldsMap}
                      skillOutputs={sourceFields}
                      skillInputs={inputs}
                      previousTableMappings={outputMapping.tableMappings.slice(0, index)}
                      onUpdate={(updated) => handleUpdateTableMapping(index, updated)}
                      onRemove={() => handleRemoveTableMapping(index)}
                      isReadOnly={isReadOnly}
                      hideTableSelector={tm.targetTableId > 0}
                    />
                    {/* Add fields from same table */}
                    {!isReadOnly && tm.targetTableId > 0 && (
                      <FieldPickerPopover
                        tableId={tm.targetTableId}
                        buttonLabel="+ Add output fields"
                        onSelectFields={(fields) =>
                          handleAddOutputsToTable(tm.targetTableId, fields)
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* No outputs message */}
      {outputs.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Database className="h-3.5 w-3.5" />
          <span>No outputs defined yet</span>
        </div>
      )}

      {/* Manual outputs */}
      {manualOutputs.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground">Manual outputs</Label>
          <div className="flex flex-wrap gap-1">
            {manualOutputs.map((output) => (
              <ManualOutputItem
                key={output.name}
                output={output}
                onRemove={() => handleRemoveOutput(output.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add manual output form */}
      {showAddManual && (
        <div className="flex items-center gap-1.5">
          <Input
            value={newOutputName}
            onChange={(e) => setNewOutputName(e.target.value)}
            placeholder="output_name"
            className="h-7 text-xs w-32"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddManualOutput();
              if (e.key === 'Escape') setShowAddManual(false);
            }}
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddManualOutput}
            className="h-6 px-2 text-[11px]"
            disabled={!newOutputName.trim()}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddManual(false)}
            className="h-6 px-1 text-[11px]"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Action buttons */}
      {!isReadOnly && (
        <div className="flex items-center gap-2">
          {!showAddManual && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAddManual(true)}
              className="h-6 px-2 text-[11px] text-muted-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add output
            </Button>
          )}
          {!tablesLoading && tables.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddTableMapping}
              className="h-6 px-2 text-[11px]"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add table target
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
