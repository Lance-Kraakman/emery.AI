'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Database, ArrowRight, Info, Plus, X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { SkillOutput, OutputMappingConfig, FieldMapping, TableMapping, FieldSource } from '@/app/mappers/skill-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import { getRowsDSG } from '@/app/actions/rows';
import {
  getOutputFieldsForTask,
  taskSupportsFieldMapping,
  type OutputFieldDef
} from '@/lib/constants/task-output-schemas';

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

/**
 * Create a FieldSource from skill output name
 */
function createSkillOutputSource(name: string): FieldSource {
  return { type: 'skill_output', name };
}

/**
 * Create a FieldSource from table reference
 */
function createTableRefSource(order: number, field: string): FieldSource {
  return { type: 'table_ref', order, field };
}

/**
 * Get display label for a FieldSource
 */
function getFieldSourceLabel(source: FieldSource): string {
  if (source.type === 'skill_output') {
    return source.name;
  } else {
    return `Table #${source.order} → ${source.field}`;
  }
}

/**
 * Serialize FieldSource to string for Select value
 */
function serializeFieldSource(source: FieldSource): string {
  if (source.type === 'skill_output') {
    return `skill:${source.name}`;
  } else {
    return `table:${source.order}:${source.field}`;
  }
}

/**
 * Deserialize string to FieldSource
 */
function deserializeFieldSource(value: string): FieldSource | null {
  if (value.startsWith('skill:')) {
    return { type: 'skill_output', name: value.slice(6) };
  } else if (value.startsWith('table:')) {
    const parts = value.slice(6).split(':');
    if (parts.length >= 2) {
      return { type: 'table_ref', order: parseInt(parts[0]), field: parts.slice(1).join(':') };
    }
  }
  return null;
}

interface FieldSourceSelectorProps {
  value: FieldSource | null;
  onChange: (source: FieldSource) => void;
  skillOutputs: OutputFieldDef[];
  previousTableMappings: TableMapping[];
  tableFieldsMap: Map<number, FieldDTO[]>;
  disabled?: boolean;
}

function FieldSourceSelector({
  value,
  onChange,
  skillOutputs,
  previousTableMappings,
  tableFieldsMap,
  disabled
}: FieldSourceSelectorProps) {
  const serializedValue = value ? serializeFieldSource(value) : '';

  return (
    <Select
      value={serializedValue}
      onValueChange={(v) => {
        const source = deserializeFieldSource(v);
        if (source) onChange(source);
      }}
      disabled={disabled}
    >
      <SelectTrigger className="w-[150px] h-7 text-[11px]">
        <SelectValue placeholder="Select source..." />
      </SelectTrigger>
      <SelectContent>
        {/* Skill Outputs group */}
        <SelectGroup>
          <SelectLabel className="text-[10px]">Skill Outputs</SelectLabel>
          {skillOutputs.map((output) => (
            <SelectItem key={`skill:${output.field}`} value={`skill:${output.field}`}>
              {output.field}
            </SelectItem>
          ))}
        </SelectGroup>

        {/* Table References group (from previous mappings) */}
        {previousTableMappings.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[10px]">Table References</SelectLabel>
            {previousTableMappings.map((tm) => {
              const tableFields = tableFieldsMap.get(tm.targetTableId) || [];
              return (
                <React.Fragment key={`table-${tm.order}`}>
                  <SelectItem value={`table:${tm.order}:row_id`}>
                    Table #{tm.order} → row_id
                  </SelectItem>
                  {tableFields.map((field) => (
                    <SelectItem key={`table:${tm.order}:${field.name}`} value={`table:${tm.order}:${field.name}`}>
                      Table #{tm.order} → {field.name}
                    </SelectItem>
                  ))}
                </React.Fragment>
              );
            })}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}

interface FieldMappingRowProps {
  mapping: FieldMapping;
  skillOutputs: OutputFieldDef[];
  previousTableMappings: TableMapping[];
  targetFields: FieldDTO[];
  tableFieldsMap: Map<number, FieldDTO[]>;
  onUpdate: (mapping: FieldMapping) => void;
  onRemove: () => void;
  isReadOnly?: boolean;
}

function FieldMappingRow({
  mapping,
  skillOutputs,
  previousTableMappings,
  targetFields,
  tableFieldsMap,
  onUpdate,
  onRemove,
  isReadOnly
}: FieldMappingRowProps) {
  // Check if target field is a relation type
  const targetField = targetFields.find(f => f.id === mapping.targetFieldId);
  const isRelationField = targetField?.type === 'relation';

  // Default appendMode to true for relation fields if not explicitly set
  const effectiveAppendMode = mapping.appendMode ?? isRelationField;

  return (
    <div className="flex items-center gap-1.5">
      {/* Source selector (typed) */}
      <FieldSourceSelector
        value={mapping.source}
        onChange={(source) => onUpdate({ ...mapping, source })}
        skillOutputs={skillOutputs}
        previousTableMappings={previousTableMappings}
        tableFieldsMap={tableFieldsMap}
        disabled={isReadOnly}
      />

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

      {/* Append/Replace toggle for relation fields */}
      {isRelationField && (
        <Select
          value={effectiveAppendMode ? 'append' : 'replace'}
          onValueChange={(v) => onUpdate({ ...mapping, appendMode: v === 'append' })}
          disabled={isReadOnly}
        >
          <SelectTrigger className="w-[80px] h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="append">Append</SelectItem>
            <SelectItem value="replace">Replace</SelectItem>
          </SelectContent>
        </Select>
      )}

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

interface TableMappingCardProps {
  tableMapping: TableMapping;
  tables: TableDTO[];
  tableFieldsMap: Map<number, FieldDTO[]>;
  skillOutputs: OutputFieldDef[];
  previousTableMappings: TableMapping[];
  onUpdate: (tm: TableMapping) => void;
  onRemove: () => void;
  isReadOnly?: boolean;
  dragHandleProps?: {
    attributes: Record<string, any>;
    listeners: Record<string, any>;
  };
}

function TableMappingCard({
  tableMapping,
  tables,
  tableFieldsMap,
  skillOutputs,
  previousTableMappings,
  onUpdate,
  onRemove,
  isReadOnly,
  dragHandleProps
}: TableMappingCardProps) {
  const [expanded, setExpanded] = useState(true);
  const targetFields = tableFieldsMap.get(tableMapping.targetTableId) || [];
  const tableName = tables.find(t => t.id === tableMapping.targetTableId)?.name || 'Unknown';

  const handleAddMapping = () => {
    const newMapping: FieldMapping = {
      source: { type: 'skill_output', name: '' },
      targetFieldId: 0
    };
    onUpdate({
      ...tableMapping,
      mappings: [...tableMapping.mappings, newMapping]
    });
  };

  const handleUpdateMapping = (index: number, mapping: FieldMapping) => {
    const newMappings = [...tableMapping.mappings];
    newMappings[index] = mapping;
    onUpdate({ ...tableMapping, mappings: newMappings });
  };

  const handleRemoveMapping = (index: number) => {
    const newMappings = tableMapping.mappings.filter((_, i) => i !== index);
    onUpdate({ ...tableMapping, mappings: newMappings });
  };

  return (
    <Card className="border-muted">
      <CardHeader className="py-2 px-3 flex flex-row items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          {!isReadOnly && dragHandleProps && (
            <div
              {...dragHandleProps.attributes}
              {...dragHandleProps.listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
          )}
          <span className="text-xs font-medium">#{tableMapping.order}</span>
          <span className="text-xs">{tableName}</span>
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {tableMapping.rowAction}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isReadOnly && (
            <button
              type="button"
              className="h-5 w-5 rounded text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="py-2 px-3 space-y-2">
          {/* Table and action selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={tableMapping.targetTableId?.toString()}
              onValueChange={(value) => onUpdate({ ...tableMapping, targetTableId: parseInt(value), mappings: [] })}
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

            <Select
              value={tableMapping.rowAction}
              onValueChange={(value) => onUpdate({ ...tableMapping, rowAction: value as 'create' | 'update' })}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-7 w-[90px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Field mappings */}
          <div className="space-y-1.5">
            {tableMapping.mappings.map((mapping, index) => (
              <FieldMappingRow
                key={index}
                mapping={mapping}
                skillOutputs={skillOutputs}
                previousTableMappings={previousTableMappings}
                targetFields={targetFields}
                tableFieldsMap={tableFieldsMap}
                onUpdate={(m) => handleUpdateMapping(index, m)}
                onRemove={() => handleRemoveMapping(index)}
                isReadOnly={isReadOnly}
              />
            ))}
            {!isReadOnly && tableMapping.targetTableId > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddMapping}
                className="h-6 px-2 text-[11px]"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Field
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Sortable wrapper for TableMappingCard
interface SortableTableMappingCardProps extends Omit<TableMappingCardProps, 'dragHandleProps'> {
  id: number;
}

function SortableTableMappingCard({ id, ...props }: SortableTableMappingCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TableMappingCard
        {...props}
        dragHandleProps={{ attributes, listeners: listeners || {} }}
      />
    </div>
  );
}

interface OutputMappingSectionProps {
  outputs: SkillOutput[];
  onOutputsChange: (outputs: SkillOutput[]) => void;
  taskType?: string;
  skillOutputs?: SkillOutput[];
  executionType?: 'agent' | 'operation';
  isReadOnly?: boolean;
}

/**
 * Output Mapping Section (Multi-Table with Typed References)
 *
 * Supports:
 * - Multiple table mappings (ordered)
 * - Typed field sources (skill_output or table_ref)
 * - Cross-table references for relations
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
  const [tableFieldsMap, setTableFieldsMap] = useState<Map<number, FieldDTO[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Get the first output (we support one output mapping config per skill for now)
  const output = outputs[0];
  const outputMapping = output?.outputMapping;

  // Get available source fields based on execution type
  const sourceFields = useMemo((): OutputFieldDef[] => {
    if (executionType === 'operation' && taskType) {
      return getOutputFieldsForTask(taskType);
    } else if (executionType === 'agent' && skillOutputs && skillOutputs.length > 0) {
      return skillOutputs.map((skillOutput) => ({
        field: skillOutput.name,
        type: mapSkillOutputTypeToFieldType(skillOutput.type),
        description: `Agent output: ${skillOutput.name}`
      }));
    }
    return [];
  }, [executionType, taskType, skillOutputs]);

  // Check if mapping is supported
  const supportsMapping = useMemo(() => {
    if (executionType === 'operation') {
      return taskType ? taskSupportsFieldMapping(taskType) : false;
    } else {
      return skillOutputs && skillOutputs.length > 0;
    }
  }, [executionType, taskType, skillOutputs]);

  // DnD sensors for table mapping reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for table mapping reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !outputMapping) return;

    if (active.id !== over.id) {
      const tableMappings = outputMapping.tableMappings;
      const oldIndex = tableMappings.findIndex((tm) => tm.order === active.id);
      const newIndex = tableMappings.findIndex((tm) => tm.order === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(tableMappings, oldIndex, newIndex);
      // Recalculate order values (1, 2, 3...)
      const updated = reordered.map((tm, i) => ({ ...tm, order: i + 1 }));

      const newOutputs = outputs.map((o, i) =>
        i === 0 ? { ...o, outputMapping: { ...outputMapping, tableMappings: updated } } : o
      );
      onOutputsChange(newOutputs);
    }
  };

  // Fetch tables on mount
  useEffect(() => {
    getTables()
      .then(setTables)
      .finally(() => setLoading(false));
  }, []);

  // Fetch fields for all tables used in mappings
  useEffect(() => {
    const tableIds = new Set<number>();
    outputMapping?.tableMappings?.forEach(tm => {
      if (tm.targetTableId) tableIds.add(tm.targetTableId);
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
      setTableFieldsMap(newMap);
    };

    if (tableIds.size > 0) {
      fetchFields();
    }
  }, [outputMapping?.tableMappings]);

  // Show info message if no outputs defined (agent mode only)
  if (executionType === 'agent' && (!skillOutputs || skillOutputs.length === 0)) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Database className="h-3.5 w-3.5" />
        <span>Add outputs above to enable output mapping</span>
      </div>
    );
  }

  // Don't show section if not supported
  if (!output || !supportsMapping || sourceFields.length === 0) {
    return null;
  }

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
      mappings: []
    };

    updateOutputMapping({
      mode: outputMapping?.mode || 'single_row',
      tableMappings: [...currentMappings, newTableMapping]
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
      .map((tm, i) => ({ ...tm, order: i + 1 })); // Reorder

    if (newMappings.length === 0) {
      updateOutputMapping(undefined);
    } else {
      updateOutputMapping({ ...outputMapping, tableMappings: newMappings });
    }
  };

  const handleModeChange = (mode: 'single_row' | 'multi_row') => {
    updateOutputMapping({
      mode,
      tableMappings: outputMapping?.tableMappings || []
    });
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium">Output Mapping</Label>
          <div className="group relative">
            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            <div className="invisible group-hover:visible absolute left-0 top-4 z-50 w-64 rounded-md bg-popover p-2 text-[11px] text-popover-foreground shadow-md border">
              Map skill outputs to multiple tables. Use table references to link rows (e.g., Company → Contact relation).
            </div>
          </div>
        </div>

        {!loading && tables.length > 0 && (
          <>
            {/* Mode toggle */}
            <RadioGroup
              value={outputMapping?.mode || 'single_row'}
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

            {!isReadOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTableMapping}
                className="h-6 px-2 text-[11px]"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Table
              </Button>
            )}
          </>
        )}
      </div>

      {loading ? (
        <div className="text-[11px] text-muted-foreground py-1">Loading tables...</div>
      ) : tables.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-1">No tables available</div>
      ) : (
        /* Table mappings with drag-and-drop reordering */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={(outputMapping?.tableMappings || []).map(tm => tm.order)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {(outputMapping?.tableMappings || []).map((tm, index) => (
                <SortableTableMappingCard
                  key={tm.order}
                  id={tm.order}
                  tableMapping={tm}
                  tables={tables}
                  tableFieldsMap={tableFieldsMap}
                  skillOutputs={sourceFields}
                  previousTableMappings={outputMapping?.tableMappings?.slice(0, index) || []}
                  onUpdate={(updated) => handleUpdateTableMapping(index, updated)}
                  onRemove={() => handleRemoveTableMapping(index)}
                  isReadOnly={isReadOnly}
                />
              ))}

              {outputMapping && outputMapping.tableMappings.length > 0 && !isReadOnly && (
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => updateOutputMapping(undefined)}
                >
                  Clear all
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
