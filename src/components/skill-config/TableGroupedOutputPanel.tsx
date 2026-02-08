'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Table2, Database, Plus, X, Info, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());

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

  const handleUpdateTableMapping = (index: number, tm: TableMapping) => {
    if (!outputMapping) return;
    const newMappings = [...outputMapping.tableMappings];
    newMappings[index] = tm;
    updateOutputMapping({ ...outputMapping, tableMappings: newMappings });
  };

  const handleRemoveTableMapping = (index: number) => {
    if (!outputMapping) return;
    const removedMapping = outputMapping.tableMappings[index];

    // Collect output names referenced by this table mapping's field mappings
    const outputNamesToRemove = new Set<string>();
    removedMapping.mappings.forEach((fm) => {
      if (fm.source?.type === 'skill_output' && fm.source.name) {
        outputNamesToRemove.add(fm.source.name);
      }
    });

    const newTableMappings = outputMapping.tableMappings
      .filter((_, i) => i !== index)
      .map((tm, i) => ({ ...tm, order: i + 1 }));

    // Remove the output definitions that were mapped to this table
    const newOutputs = outputs.filter((o) => !outputNamesToRemove.has(o.name));

    // Update mapping on first output (or clear if none left)
    const finalOutputs = newOutputs.map((o, i) =>
      i === 0
        ? {
            ...o,
            outputMapping:
              newTableMappings.length > 0
                ? { ...outputMapping, tableMappings: newTableMappings }
                : undefined,
          }
        : o
    );

    onOutputsChange(finalOutputs);
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

    // Auto-expand the table group so user sees newly added fields
    setExpandedTables((prev) => new Set(prev).add(tableId));

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

  const toggleTableCollapse = (tableId: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  const handleClearAll = () => {
    onOutputsChange([]);
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
                const tableName = table?.name || `Table #${tm.targetTableId}`;
                const isCollapsed = !expandedTables.has(tm.targetTableId);

                return (
                  <div
                    key={tm.order}
                    className="rounded-lg border bg-blue-50/30 dark:bg-blue-900/10 p-2.5"
                  >
                    {/* Group header */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleTableCollapse(tm.targetTableId)}
                    >
                      <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
                        <Table2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span
                          className="text-xs font-medium text-blue-700 dark:text-blue-400 truncate max-w-[160px]"
                          title={tableName}
                        >
                          To: {tableName}
                        </span>
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                          {tm.rowAction}
                        </span>
                        {tm.mode && (
                          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                            {tm.mode === 'multi_row' ? 'multi' : 'single'}
                          </span>
                        )}
                        {isCollapsed && tm.rowAction === 'upsert' && tm.matchFieldIds && tm.matchFieldIds.length > 0 && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 px-1.5 py-0.5 bg-blue-100/50 dark:bg-blue-900/30 rounded">
                            match: {tm.matchFieldIds
                              .map((id) => (tableFieldsMap.get(tm.targetTableId) || []).find((f) => f.id === id)?.name || `#${id}`)
                              .join(', ')}
                          </span>
                        )}
                        {isCollapsed && (
                          <span className="text-[10px] text-muted-foreground">
                            ({tm.mappings.length} field{tm.mappings.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!isReadOnly && (
                          <button
                            type="button"
                            className="h-5 w-5 rounded text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTableMapping(index);
                            }}
                            title="Remove table group"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        {isCollapsed ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Collapsible content */}
                    {!isCollapsed && (
                      <>
                        <div className="mt-2">
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
                            renderContentOnly
                          />
                        </div>
                        {!isReadOnly && tm.targetTableId > 0 && (
                          <FieldPickerPopover
                            tableId={tm.targetTableId}
                            buttonLabel="+ Add output fields"
                            onSelectFields={(fields) =>
                              handleAddOutputsToTable(tm.targetTableId, fields)
                            }
                          />
                        )}
                      </>
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
            <AddToTableButton
              tables={tables}
              onAddFields={(tableId, fields) => handleAddOutputsToTable(tableId, fields)}
            />
          )}
          {outputs.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
            >
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Button to add outputs to a new table (table picker → field picker) */
function AddToTableButton({
  tables,
  onAddFields,
}: {
  tables: TableDTO[];
  onAddFields: (tableId: number, fields: FieldDTO[]) => void;
}) {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  if (selectedTableId) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">
          {tables.find((t) => t.id === selectedTableId)?.name}:
        </span>
        <FieldPickerPopover
          tableId={selectedTableId}
          buttonLabel="Pick fields"
          onSelectFields={(fields) => {
            onAddFields(selectedTableId, fields);
            setSelectedTableId(null);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSelectedTableId(null)}
          className="h-5 px-1"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      onValueChange={(v) => {
        setSelectedTableId(parseInt(v));
      }}
    >
      <SelectTrigger className="h-6 w-[140px] text-[10px] text-muted-foreground">
        <SelectValue placeholder="+ Add to table" />
      </SelectTrigger>
      <SelectContent>
        {tables.map((table) => (
          <SelectItem key={table.id} value={table.id.toString()}>
            {table.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
