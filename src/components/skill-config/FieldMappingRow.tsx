'use client';

import React from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldSourceSelector } from './FieldSourceSelector';
import type { FieldMapping, TableMapping, InputDefinition } from '@/app/mappers/skill-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { OutputFieldDef } from '@/lib/constants/task-output-schemas';

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

export function FieldMappingRow({
  mapping,
  skillOutputs,
  skillInputs = [],
  previousTableMappings,
  targetFields,
  tableFieldsMap,
  onUpdate,
  onRemove,
  isReadOnly,
}: FieldMappingRowProps) {
  // Check if target field is a relation type
  const targetField = targetFields.find((f) => f.id === mapping.targetFieldId);
  const isRelationField = targetField?.type === 'relation';

  // Default appendMode to true for relation fields if not explicitly set
  const effectiveAppendMode = mapping.appendMode ?? isRelationField;

  return (
    <div className="flex items-center gap-1">
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
          const field = targetFields.find((f) => f.id === fieldId);
          onUpdate({
            ...mapping,
            targetFieldId: fieldId,
            // AIDEV-NOTE: Include field type metadata so Python knows how to format values
            // Critical for relation fields which need [{"id": row_id, "value": ""}] format
            targetFieldMetadata: field
              ? {
                  fieldType: field.type,
                  fieldName: field.name,
                  options:
                    (field.metadata as { options?: Array<{ name: string }> })?.options?.map(
                      (o) => o.name
                    ) || [],
                  relatedTableId: field.relatedTableId || undefined,
                }
              : undefined,
          });
        }}
        disabled={isReadOnly || targetFields.length === 0}
      >
        <SelectTrigger className="w-[120px] h-6 text-[10px]">
          <SelectValue placeholder="Target..." />
        </SelectTrigger>
        <SelectContent>
          {targetFields.map((field) => (
            <SelectItem key={field.id} value={field.id.toString()}>
              <span>{field.name}</span>
              <span className="text-[9px] text-muted-foreground ml-1">({field.type})</span>
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
          <SelectTrigger className="w-[70px] h-6 text-[10px]">
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
