'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { serializeFieldSource, deserializeFieldSource } from './mapping-serializers';
import type { FieldSource, TableMapping, InputDefinition } from '@/app/mappers/skill-mapper';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { OutputFieldDef } from '@/lib/constants/task-output-schemas';

interface FieldSourceSelectorProps {
  value: FieldSource | null;
  onChange: (source: FieldSource) => void;
  skillOutputs: OutputFieldDef[];
  skillInputs?: InputDefinition[];
  previousTableMappings: TableMapping[];
  tableFieldsMap: Map<number, FieldDTO[]>;
  disabled?: boolean;
}

export function FieldSourceSelector({
  value,
  onChange,
  skillOutputs,
  skillInputs = [],
  previousTableMappings,
  tableFieldsMap,
  disabled,
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
      <SelectTrigger className="w-[140px] h-6 text-[10px]">
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
