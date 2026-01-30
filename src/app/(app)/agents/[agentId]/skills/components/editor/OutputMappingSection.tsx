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
import type { OutputDefinition, InputDefinition, OutputMappingConfig, FieldMapping, TableMapping, FieldSource, RowIdSource } from '@/app/mappers/skill-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { getTables } from '@/app/actions/tables';
import { getFields } from '@/app/actions/fields';
import { getRowsDSG } from '@/app/actions/rows';
import type { OutputFieldDef } from '@/lib/constants/task-output-schemas';

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
 * Create a FieldSource from skill input name
 */
function createSkillInputSource(name: string): FieldSource {
  return { type: 'skill_input', name };
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
  } else if (source.type === 'skill_input') {
    return `[input] ${source.name}`;
  } else {
    return `Table #${source.order} → ${source.field}`;
  }
}

/**
 * Serialize FieldSource to string for Select value
 */
function serializeFieldSource(source: FieldSource): string {
  if (source.type === 'skill_output') {
    return `output:${source.name}`;
  } else if (source.type === 'skill_input') {
    return `input:${source.name}`;
  } else {
    return `table:${source.order}:${source.field}`;
  }
}

/**
 * Deserialize string to FieldSource
 */
function deserializeFieldSource(value: string): FieldSource | null {
  if (value.startsWith('output:')) {
    return { type: 'skill_output', name: value.slice(7) };
  } else if (value.startsWith('input:')) {
    return { type: 'skill_input', name: value.slice(6) };
  } else if (value.startsWith('table:')) {
    const parts = value.slice(6).split(':');
    if (parts.length >= 2) {
      return { type: 'table_ref', order: parseInt(parts[0]), field: parts.slice(1).join(':') };
    }
  }
  // Backwards compat: handle old 'skill:' prefix
  if (value.startsWith('skill:')) {
    return { type: 'skill_output', name: value.slice(6) };
  }
  return null;
}

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
  } else if (value.startsWith('table:')) {
    const parts = value.slice(6).split(':');
    if (parts.length >= 2) {
      return { type: 'table_ref', tableRef: { order: parseInt(parts[0]), field: parts.slice(1).join(':') } };
    }
  } else if (value.startsWith('static:')) {
    return { type: 'static', staticId: value.slice(7) };
  }
  return undefined;
}

interface FieldSourceSelectorProps {
  value: FieldSource | null;
  onChange: (source: FieldSource) => void;
  skillOutputs: OutputFieldDef[];
  skillInputs?: InputDefinition[];
  previousTableMappings: TableMapping[];
  tableFieldsMap: Map<number, FieldDTO[]>;
  disabled?: boolean;
}

function FieldSourceSelector({
  value,
  onChange,
  skillOutputs,
  skillInputs = [],
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
        {/* Skill Inputs group */}
        {skillInputs.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-[10px]">Skill Inputs</SelectLabel>
            {skillInputs.map((input) => (
              <SelectItem key={`input:${input.name}`} value={`input:${input.name}`}>
                {input.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* Skill Outputs group */}
        <SelectGroup>
          <SelectLabel className="text-[10px]">Skill Outputs</SelectLabel>
          {skillOutputs.map((output) => (
            <SelectItem key={`output:${output.field}`} value={`output:${output.field}`}>
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
  skillInputs?: InputDefinition[];
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
  skillInputs = [],
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
        skillInputs={skillInputs}
        previousTableMappings={previousTableMappings}
        tableFieldsMap={tableFieldsMap}
        disabled={isReadOnly}
      />

      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />

      {/* Target field selector */}
      <Select
        value={mapping.targetFieldId?.toString()}
        onValueChange={(value) => {
          const fieldId = parseInt(value);
          const field = targetFields.find(f => f.id === fieldId);
          onUpdate({
            ...mapping,
            targetFieldId: fieldId,
            // AIDEV-NOTE: Include field type metadata so Python knows how to format values
            // Critical for relation fields which need [{"id": row_id, "value": ""}] format
            targetFieldMetadata: field ? {
              fieldType: field.type,
              fieldName: field.name,
              options: (field.metadata as { options?: Array<{ name: string }> })?.options?.map(o => o.name) || []
            } : undefined
          });
        }}
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
  skillInputs?: InputDefinition[];
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
  skillInputs = [],
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

  // Auto-map: match skill outputs to table fields by name
  const handleAutoMap = () => {
    const autoMappings: FieldMapping[] = [];
    const existingTargetIds = new Set(tableMapping.mappings.map(m => m.targetFieldId));

    skillOutputs.forEach((output) => {
      const matchingField = targetFields.find(
        f => f.name.toLowerCase() === output.field.toLowerCase() && !existingTargetIds.has(f.id)
      );
      if (matchingField) {
        autoMappings.push({
          source: { type: 'skill_output', name: output.field },
          targetFieldId: matchingField.id,
          // AIDEV-NOTE: Include field type metadata so Python knows how to format values
          targetFieldMetadata: {
            fieldType: matchingField.type,
            fieldName: matchingField.name,
            options: (matchingField.metadata as { options?: Array<{ name: string }> })?.options?.map(o => o.name) || []
          }
        });
        existingTargetIds.add(matchingField.id);
      }
    });

    if (autoMappings.length > 0) {
      onUpdate({
        ...tableMapping,
        mappings: [...tableMapping.mappings, ...autoMappings]
      });
    }
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
          {tableMapping.mode && (
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
              {tableMapping.mode === 'multi_row' ? 'multi' : 'single'}
            </span>
          )}
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
          {/* Table, action, and mode selectors */}
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
              onValueChange={(value) => onUpdate({ ...tableMapping, rowAction: value as 'create' | 'update' | 'upsert' })}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-7 w-[90px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="upsert">Upsert</SelectItem>
              </SelectContent>
            </Select>

            {/* Per-table mode selector */}
            <Select
              value={tableMapping.mode || 'single_row'}
              onValueChange={(value) => onUpdate({ ...tableMapping, mode: value as 'single_row' | 'multi_row' })}
              disabled={isReadOnly}
            >
              <SelectTrigger className="h-7 w-[80px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single_row">Single</SelectItem>
                <SelectItem value="multi_row">Multi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row ID source selector for update/upsert mode */}
          {(tableMapping.rowAction === 'update' || tableMapping.rowAction === 'upsert') && (
            <div className="flex items-center gap-2">
              <Label className="text-[10px] text-muted-foreground">Row ID from:</Label>
              <Select
                value={serializeRowIdSource(tableMapping.rowIdSource)}
                onValueChange={(v) => onUpdate({ ...tableMapping, rowIdSource: deserializeRowIdSource(v) })}
                disabled={isReadOnly}
              >
                <SelectTrigger className="h-7 w-[160px] text-[11px]">
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="source_row">Source Row</SelectItem>
                  {skillInputs.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">Skill Inputs</SelectLabel>
                      {skillInputs.map((input) => (
                        <SelectItem key={`input:${input.name}`} value={`input:${input.name}`}>
                          Input: {input.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {skillOutputs.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">Skill Outputs</SelectLabel>
                      {skillOutputs.map((output) => (
                        <SelectItem key={`output:${output.field}`} value={`output:${output.field}`}>
                          Output: {output.field}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {previousTableMappings.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">Table References</SelectLabel>
                      {previousTableMappings.map((tm) => (
                        <SelectItem key={`table:${tm.order}:row_id`} value={`table:${tm.order}:row_id`}>
                          Table #{tm.order} → row_id
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Field mappings */}
          <div className="space-y-1.5">
            {tableMapping.mappings.map((mapping, index) => (
              <FieldMappingRow
                key={index}
                mapping={mapping}
                skillOutputs={skillOutputs}
                skillInputs={skillInputs}
                previousTableMappings={previousTableMappings}
                targetFields={targetFields}
                tableFieldsMap={tableFieldsMap}
                onUpdate={(m) => handleUpdateMapping(index, m)}
                onRemove={() => handleRemoveMapping(index)}
                isReadOnly={isReadOnly}
              />
            ))}
            {!isReadOnly && tableMapping.targetTableId > 0 && (
              <div className="flex items-center gap-2">
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
                {targetFields.length > 0 && tableMapping.mappings.length === 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAutoMap}
                    className="h-6 px-2 text-[11px]"
                  >
                    Auto-map
                  </Button>
                )}
              </div>
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
  outputs: OutputDefinition[];
  onOutputsChange: (outputs: OutputDefinition[]) => void;
  skillOutputs?: OutputDefinition[];
  skillInputs?: InputDefinition[];
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
  skillOutputs,
  skillInputs = [],
  isReadOnly
}: OutputMappingSectionProps) {
  const [tables, setTables] = useState<TableDTO[]>([]);
  const [tableFieldsMap, setTableFieldsMap] = useState<Map<number, FieldDTO[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Get the first output (we support one output mapping config per skill for now)
  const output = outputs[0];
  const outputMapping = output?.outputMapping;

  // Get available source fields from skill output definitions
  const sourceFields = useMemo((): OutputFieldDef[] => {
    if (!skillOutputs || skillOutputs.length === 0) return [];
    return skillOutputs.map((skillOutput) => ({
      field: skillOutput.name,
      type: mapSkillOutputTypeToFieldType(skillOutput.type),
      description: `Skill output: ${skillOutput.name}`
    }));
  }, [skillOutputs]);

  // Check if mapping is supported (requires skill outputs)
  const supportsMapping = useMemo(() => {
    return skillOutputs && skillOutputs.length > 0;
  }, [skillOutputs]);

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

      // AIDEV-NOTE: Enrich mappings with targetFieldMetadata if missing (fixes relation field wrapping)
      // This ensures existing mappings loaded from saved config get the field type metadata
      // that Python needs to format relation values as [{"id": row_id, "value": ""}]
      if (outputMapping?.tableMappings && newMap.size > 0) {
        let needsUpdate = false;
        const enrichedTableMappings = outputMapping.tableMappings.map(tm => {
          const tableFields = newMap.get(tm.targetTableId) || [];
          const enrichedMappings = tm.mappings.map(mapping => {
            // If targetFieldMetadata is missing but targetFieldId exists, look up the field
            if (!mapping.targetFieldMetadata && mapping.targetFieldId) {
              const field = tableFields.find(f => f.id === mapping.targetFieldId);
              if (field) {
                needsUpdate = true;
                return {
                  ...mapping,
                  targetFieldMetadata: {
                    fieldType: field.type,
                    fieldName: field.name,
                    options: (field.metadata as { options?: Array<{ name: string }> })?.options?.map(o => o.name) || []
                  }
                };
              }
            }
            return mapping;
          });
          return { ...tm, mappings: enrichedMappings };
        });

        // Only update if we actually enriched something to avoid infinite loop
        if (needsUpdate) {
          const newOutputs = outputs.map((o, i) =>
            i === 0 ? { ...o, outputMapping: { ...outputMapping, tableMappings: enrichedTableMappings } } : o
          );
          onOutputsChange(newOutputs);
        }
      }
    };

    if (tableIds.size > 0) {
      fetchFields();
    }
  // Note: We intentionally exclude outputs and onOutputsChange from deps to avoid infinite loop
  // The enrichment only needs to run when tableMappings structure changes, not on every callback update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(outputMapping?.tableMappings?.map(tm => ({ id: tm.targetTableId, mappings: tm.mappings.map(m => m.targetFieldId) })))]);

  // Show info message if no outputs defined
  if (!skillOutputs || skillOutputs.length === 0) {
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

        {!loading && tables.length > 0 && !isReadOnly && (
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
                  skillInputs={skillInputs}
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
