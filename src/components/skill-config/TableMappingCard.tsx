'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FieldMappingRow } from './FieldMappingRow';
import { serializeRowIdSource, deserializeRowIdSource } from './mapping-serializers';
import type { TableMapping, FieldMapping, InputDefinition } from '@/app/mappers/skill-mapper';
import type { TableDTO } from '@/app/mappers/table-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { OutputFieldDef } from '@/lib/constants/task-output-schemas';

export interface TableMappingCardProps {
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
  /** Hide the table selector when the table is implicit from a group heading */
  hideTableSelector?: boolean;
  /** When true, render only the inner content without Card/CardHeader/CardContent wrappers */
  renderContentOnly?: boolean;
}

export function TableMappingCard({
  tableMapping,
  tables,
  tableFieldsMap,
  skillOutputs,
  skillInputs = [],
  previousTableMappings,
  onUpdate,
  onRemove,
  isReadOnly,
  dragHandleProps,
  hideTableSelector = false,
  renderContentOnly = false,
}: TableMappingCardProps) {
  const [expanded, setExpanded] = useState(true);
  const targetFields = tableFieldsMap.get(tableMapping.targetTableId) || [];
  const tableName = tables.find((t) => t.id === tableMapping.targetTableId)?.name || 'Unknown';

  const handleAddMapping = () => {
    const newMapping: FieldMapping = {
      source: { type: 'skill_output', name: '' },
      targetFieldId: 0,
    };
    onUpdate({
      ...tableMapping,
      mappings: [...tableMapping.mappings, newMapping],
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
    const existingTargetIds = new Set(tableMapping.mappings.map((m) => m.targetFieldId));

    skillOutputs.forEach((output) => {
      const matchingField = targetFields.find(
        (f) => f.name.toLowerCase() === output.field.toLowerCase() && !existingTargetIds.has(f.id)
      );
      if (matchingField) {
        autoMappings.push({
          source: { type: 'skill_output', name: output.field },
          targetFieldId: matchingField.id,
          // AIDEV-NOTE: Include field type metadata so Python knows how to format values
          targetFieldMetadata: {
            fieldType: matchingField.type,
            fieldName: matchingField.name,
            options:
              (matchingField.metadata as { options?: Array<{ name: string }> })?.options?.map(
                (o) => o.name
              ) || [],
          },
        });
        existingTargetIds.add(matchingField.id);
      }
    });

    if (autoMappings.length > 0) {
      onUpdate({
        ...tableMapping,
        mappings: [...tableMapping.mappings, ...autoMappings],
      });
    }
  };

  const innerContent = (
    <div className="space-y-2">
      {/* Table, action, and mode selectors */}
      <div className="flex items-center gap-2 flex-wrap">
        {!hideTableSelector && (
          <Select
            value={tableMapping.targetTableId?.toString()}
            onValueChange={(value) =>
              onUpdate({ ...tableMapping, targetTableId: parseInt(value), mappings: [] })
            }
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
        )}

        <Select
          value={tableMapping.rowAction}
          onValueChange={(value) =>
            onUpdate({
              ...tableMapping,
              rowAction: value as 'create' | 'update' | 'upsert',
            })
          }
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
          onValueChange={(value) =>
            onUpdate({
              ...tableMapping,
              mode: value as 'single_row' | 'multi_row',
            })
          }
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

      {/* Row ID source selector for update mode */}
      {tableMapping.rowAction === 'update' && (
        <div className="flex items-center gap-2">
          <Label className="text-[10px] text-muted-foreground">Row ID from:</Label>
          <Select
            value={serializeRowIdSource(tableMapping.rowIdSource)}
            onValueChange={(v) =>
              onUpdate({ ...tableMapping, rowIdSource: deserializeRowIdSource(v) })
            }
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
                    <SelectItem
                      key={`table:${tm.order}:row_id`}
                      value={`table:${tm.order}:row_id`}
                    >
                      Table #{tm.order} → row_id
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Match fields selector for upsert mode (multi-select) */}
      {tableMapping.rowAction === 'upsert' && (
        <div className="flex items-center gap-2 flex-wrap">
          <Label className="text-[10px] text-muted-foreground shrink-0">Match on:</Label>
          {targetFields.map((field) => {
            const isSelected = tableMapping.matchFieldIds?.includes(field.id) ?? false;
            return (
              <button
                key={field.id}
                type="button"
                disabled={isReadOnly}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                    : 'bg-muted/30 border-transparent text-muted-foreground hover:border-muted-foreground/30'
                }`}
                onClick={() => {
                  const current = tableMapping.matchFieldIds || [];
                  const updated = isSelected
                    ? current.filter((id) => id !== field.id)
                    : [...current, field.id];
                  onUpdate({ ...tableMapping, matchFieldIds: updated.length > 0 ? updated : undefined });
                }}
              >
                {field.name}
              </button>
            );
          })}
          {(!tableMapping.matchFieldIds || tableMapping.matchFieldIds.length === 0) && (
            <span className="text-[10px] text-muted-foreground/60 italic">click fields to select</span>
          )}
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
    </div>
  );

  if (renderContentOnly) {
    return expanded ? innerContent : null;
  }

  return (
    <Card className="border-muted">
      <CardHeader
        className="py-2 px-3 flex flex-row items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
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
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="py-2 px-3">
          {innerContent}
        </CardContent>
      )}
    </Card>
  );
}
