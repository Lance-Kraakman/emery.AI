'use client'

import React from 'react'
import type { FieldDTO } from '@/app/mappers/field-mapper';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import FileUpload from '../FileUpload';
import RelationField from './RelationField';

interface FieldInputProps {
  field: FieldDTO;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
  organizationId?: number;
  tableId?: number;
}

export default function FieldInput({ 
  field, 
  value, 
  onChange, 
  disabled = false,
  organizationId,
  tableId 
}: FieldInputProps) {
  switch (field.type) {
    case 'number':
      return (
        <Input
          type="number"
          name={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          disabled={disabled}
        />
      );
    case 'boolean':
      return (
        <div className="flex items-center">
          <Checkbox
            name={field.name}
            checked={Boolean(value)}
            onCheckedChange={onChange}
            disabled={disabled}
          />
        </div>
      );
    case 'date':
      return (
        <Input
          type="date"
          name={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
    case 'file':
      if (!organizationId || !tableId) {
        console.warn('FileUpload requires organizationId and tableId');
        return <div className="text-destructive text-sm">File upload configuration error</div>;
      }
      return (
        <FileUpload
          value={value}
          onChange={onChange}
          organizationId={organizationId}
          tableId={tableId}
          fieldId={field.id}
        />
      );
    case 'relation':
      if (!organizationId) {
        console.warn('RelationField requires organizationId');
        return <div className="text-destructive text-sm">Relation field configuration error</div>;
      }
      return (
        <RelationField
          value={value}
          onChange={onChange}
          relatedTableId={field.relatedTableId ?? null}
          workspaceId={organizationId}
          disabled={disabled}
        />
      );
    default:
      return (
        <Input
          type="text"
          name={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      );
  }
}
